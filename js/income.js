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


const overviewBody = document.getElementById('paymentOverview');
const historyBody = document.getElementById('paymentHistory');
const searchInput = document.getElementById('searchPayment');
const incomeMessage = document.getElementById('incomeMessage');

let students = [];
let batches = [];
let payments = [];

function monthLabel(dateString) {
    if (!dateString) return '—';

    const [year, month] = dateString.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric'
    });
}

function formatDate(dateString) {
    if (!dateString) return '—';

    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function computeIncome(studentList, paymentList) {
    const key = getMonthKey();
    const active = studentList.filter(student => student.is_active);
    const activeIds = new Set(active.map(student => Number(student.id)));

    const activePaid = paymentList.filter(payment =>
        payment.status === 'paid' && activeIds.has(Number(payment.student_id))
    );

    const total = activePaid.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const month = activePaid
        .filter(payment => typeof payment.fee_month === 'string' && payment.fee_month.startsWith(key))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const paid = active.filter(student => isPaidThisMonth(student, paymentList)).length;

    return { total, month, paid, unpaid: active.length - paid };
}

async function loadData() {
    const [studentResult, paymentResult, batchResult] = await Promise.all([
        supabase.from('students').select('*').order('student_name'),
        supabase.from('payments').select('*'),
        supabase.from('batches').select('id, batch_name').order('id')
    ]);

    if (studentResult.error) throw studentResult.error;
    if (paymentResult.error) throw paymentResult.error;
    if (batchResult.error) throw batchResult.error;

    students = studentResult.data || [];
    payments = paymentResult.data || [];
    batches = batchResult.data || [];
}

function makeCell(text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}

function makeBadge(paid, text) {
    const cell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = paid ? 'status-badge paid' : 'status-badge unpaid';
    badge.textContent = text;
    cell.appendChild(badge);
    return cell;
}

function showMessageRow(body, text) {
    body.innerHTML = '';

    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = text;
    row.appendChild(cell);
    body.appendChild(row);
}

function showStats() {
    const result = computeIncome(students, payments);

    document.getElementById('totalIncome').textContent = formatCurrency(result.total);
    document.getElementById('monthlyIncome').textContent = formatCurrency(result.month);
    document.getElementById('paidStudents').textContent = result.paid;
    document.getElementById('unpaidStudents').textContent = result.unpaid;
}

function showOverview() {
    const active = students.filter(student => student.is_active);

    if (active.length === 0) {
        showMessageRow(overviewBody, 'No active students yet.');
        return;
    }

    overviewBody.innerHTML = '';

    active.forEach(student => {
        const batch = batches.find(item => Number(item.id) === Number(student.batch_id));
        const paid = isPaidThisMonth(student, payments);
        const row = document.createElement('tr');

        row.append(
            makeCell(student.student_name),
            makeCell(`Class ${student.student_class}`),
            makeCell(batch ? batch.batch_name : 'No batch'),
            makeCell(formatCurrency(monthlyFee(student.student_class))),
            makeCell(`${getMonthName()} ${new Date().getFullYear()}`),
            makeBadge(paid, paid ? 'Paid' : 'Unpaid')
        );

        overviewBody.appendChild(row);
    });
}

function showHistory() {
    const search = searchInput.value.trim().toLowerCase();

    const rows = payments
        .map(payment => ({
            payment,
            student: students.find(item => Number(item.id) === Number(payment.student_id))
        }))
        .filter(({ student }) =>
            !search || (student && student.student_name.toLowerCase().includes(search))
        )
        .sort((a, b) =>
            String(b.payment.fee_month).localeCompare(String(a.payment.fee_month)) ||
            String(b.payment.payment_date).localeCompare(String(a.payment.payment_date))
        );

    if (rows.length === 0) {
        showMessageRow(
            historyBody,
            search ? 'No payments match your search.' : 'No payments recorded yet.'
        );
        return;
    }

    historyBody.innerHTML = '';

    rows.forEach(({ payment, student }) => {
        const row = document.createElement('tr');

        const name = student
            ? student.student_name + (student.is_active ? '' : ' (inactive)')
            : 'Unknown student';

        const paid = payment.status === 'paid';

        row.append(
            makeCell(name),
            makeCell(student ? `Class ${student.student_class}` : '—'),
            makeCell(monthLabel(payment.fee_month)),
            makeCell(formatDate(payment.payment_date)),
            makeCell(formatCurrency(payment.amount)),
            makeBadge(paid, paid ? 'Paid' : 'Unpaid')
        );

        historyBody.appendChild(row);
    });
}

await requireLogin();
setupLogout();
startMonthTimer();

searchInput.addEventListener('input', showHistory);

const clearButton = document.getElementById('clearHistoryButton');
const clearPanel = document.getElementById('clearPanel');
const clearInput = document.getElementById('clearConfirmInput');
const clearConfirm = document.getElementById('clearConfirmButton');
const clearCancel = document.getElementById('clearCancelButton');
const keepMonth = document.getElementById('keepThisMonth');

function closeClearPanel() {
    clearPanel.hidden = true;
    clearInput.value = '';
    clearConfirm.disabled = true;
}

clearButton.addEventListener('click', () => {
    clearPanel.hidden = false;
    clearInput.focus();
});

clearCancel.addEventListener('click', closeClearPanel);

clearInput.addEventListener('input', () => {
    clearConfirm.disabled = clearInput.value.trim().toUpperCase() !== 'CLEAR';
});

clearConfirm.addEventListener('click', async () => {
    clearConfirm.disabled = true;
    clearConfirm.textContent = 'Clearing...';

    let query = supabase.from('payments').delete();
    query = keepMonth.checked ? query.lt('fee_month', getMonthStart()) : query.gt('id', 0);

    const { data, error } = await query.select('id');

    clearConfirm.textContent = 'Clear history';

    if (error) {
        showMessage(incomeMessage, 'Could not clear history: ' + error.message, 'error');
        clearConfirm.disabled = false;
        return;
    }

    closeClearPanel();

    const removed = data ? data.length : 0;
    showMessage(incomeMessage, `History cleared. ${removed} record${removed === 1 ? '' : 's'} removed.`, 'success');

    try {
        await loadData();
        showStats();
        showOverview();
        showHistory();
    } catch (refreshError) {
        showMessage(incomeMessage, 'Cleared, but could not refresh: ' + refreshError.message, 'error');
    }
});

try {
    await loadData();
    showStats();
    showOverview();
    showHistory();
} catch (error) {
    console.error('Income page error:', error);
    showMessage(incomeMessage, 'Could not load data: ' + error.message, 'error');
    showMessageRow(overviewBody, 'Could not load data.');
    showMessageRow(historyBody, 'Could not load data.');
}
