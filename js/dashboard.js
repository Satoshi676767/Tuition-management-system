import { supabase } from './supabase.js';

async function requireLogin() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.replace('index.html');
        throw new Error('Please log in first.');
    }

    return session;
}

function setupLogout() {
    const button = document.getElementById('logoutButton');
    if (!button) return;

    button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Logging out...';

        try {
            await supabase.auth.signOut({ scope: 'local' });
        } catch (error) {
            console.error('Logout error:', error);
        }

        Object.keys(localStorage)
            .filter(key => key.startsWith('sb-') && key.endsWith('-auth-token'))
            .forEach(key => localStorage.removeItem(key));

        window.location.replace('index.html');
    });
}

function monthlyFee(studentClass) {
    return Number(studentClass) <= 5 ? 500 : 800;
}

function pad(number) {
    return String(number).padStart(2, '0');
}

function getMonthKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function getMonthStart(date = new Date()) {
    return `${getMonthKey(date)}-01`;
}

function getNextMonthStart(date = new Date()) {
    return getMonthStart(new Date(date.getFullYear(), date.getMonth() + 1, 1));
}

function getMonthName(date = new Date()) {
    return date.toLocaleDateString('en-IN', { month: 'long' });
}

function getTodayString() {
    const today = new Date();
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

function formatCurrency(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

function formatTime(timeString) {
    if (!timeString) return '';

    const [hourString, minuteString] = timeString.slice(0, 5).split(':');
    const hour = Number(hourString);
    const minute = minuteString || '00';

    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function showMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = type ? `message ${type}` : 'message';
}

function isPaidThisMonth(student, payments) {
    const key = getMonthKey();

    return payments.some(payment =>
        Number(payment.student_id) === Number(student.id) &&
        payment.status === 'paid' &&
        typeof payment.fee_month === 'string' &&
        payment.fee_month.startsWith(key)
    );
}

function getCountdownText(now = new Date()) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = Math.max(0, nextMonth - now);

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function startMonthTimer() {
    const label = document.getElementById('timerLabel');
    const value = document.getElementById('timerValue');
    if (!label || !value) return;

    const startKey = getMonthKey();
    label.textContent = `${getMonthName()} fees reset in`;

    const tick = () => {
        const now = new Date();

        if (getMonthKey(now) !== startKey) {
            window.location.reload();
            return;
        }

        value.textContent = getCountdownText(now);
    };

    tick();
    setInterval(tick, 1000);
}

await requireLogin();
setupLogout();
startMonthTimer();

const unpaidList = document.getElementById('upcomingList');

let students = [];
let batches = [];
let payments = [];

async function loadData() {
    const [studentResult, paymentResult, batchResult] = await Promise.all([
        supabase.from('students').select('*').eq('is_active', true).order('student_name'),
        supabase.from('payments').select('*'),
        supabase.from('batches').select('id, batch_name, start_time, end_time').order('id')
    ]);

    if (studentResult.error) throw studentResult.error;
    if (paymentResult.error) throw paymentResult.error;
    if (batchResult.error) throw batchResult.error;

    students = studentResult.data || [];
    payments = paymentResult.data || [];
    batches = batchResult.data || [];
}

function updateStatistics() {
    const key = getMonthKey();

    const expected = students.reduce(
        (total, student) => total + monthlyFee(student.student_class), 0
    );

    const activeIds = new Set(students.map(student => Number(student.id)));

    const collected = payments
        .filter(payment =>
            payment.status === 'paid' &&
            typeof payment.fee_month === 'string' &&
            payment.fee_month.startsWith(key) &&
            activeIds.has(Number(payment.student_id))
        )
        .reduce((total, payment) => total + Number(payment.amount), 0);

    const pending = students
        .filter(student => !isPaidThisMonth(student, payments))
        .reduce((total, student) => total + monthlyFee(student.student_class), 0);

    document.getElementById('studentCount').textContent = students.length;
    document.getElementById('expectedFees').textContent = formatCurrency(expected);
    document.getElementById('collectedFees').textContent = formatCurrency(collected);
    document.getElementById('pendingFees').textContent = formatCurrency(pending);
}

function showUnpaid() {
    unpaidList.innerHTML = '';

    const unpaid = students.filter(student => !isPaidThisMonth(student, payments));

    if (unpaid.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'upcoming-empty';
        empty.textContent = students.length === 0
            ? 'No students yet. Add students from the Students page.'
            : `Everyone has paid for ${getMonthName()}.`;
        unpaidList.appendChild(empty);
        return;
    }

    unpaid.slice(0, 8).forEach(student => {
        const item = document.createElement('li');
        item.className = 'upcoming-item urgent';

        const info = document.createElement('div');

        const name = document.createElement('strong');
        name.textContent = student.student_name;

        const detail = document.createElement('span');
        const batch = batches.find(b => Number(b.id) === Number(student.batch_id));
        detail.textContent = `Class ${student.student_class} · ${batch ? batch.batch_name : 'No batch'}`;

        info.append(name, detail);

        const when = document.createElement('div');
        when.className = 'upcoming-when';

        const status = document.createElement('strong');
        status.textContent = 'Unpaid';

        const fee = document.createElement('span');
        fee.textContent = formatCurrency(monthlyFee(student.student_class));

        when.append(status, fee);
        item.append(info, when);
        unpaidList.appendChild(item);
    });

    if (unpaid.length > 8) {
        const more = document.createElement('li');
        more.className = 'upcoming-empty';
        more.textContent = `and ${unpaid.length - 8} more unpaid`;
        unpaidList.appendChild(more);
    }
}

try {
    await loadData();
    updateStatistics();
    showUnpaid();
} catch (error) {
    console.error('Dashboard error:', error);
    unpaidList.innerHTML = '';

    const failed = document.createElement('li');
    failed.className = 'upcoming-empty';
    failed.textContent = 'Could not load data: ' + error.message;
    unpaidList.appendChild(failed);
}
