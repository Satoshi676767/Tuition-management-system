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

const studentForm = document.getElementById('studentForm');
const editStudentId = document.getElementById('editStudentId');
const nameInput = document.getElementById('studentName');
const classInput = document.getElementById('studentClass');
const phoneInput = document.getElementById('studentPhone');
const batchSelect = document.getElementById('studentBatch');
const formTitle = document.getElementById('formTitle');
const saveButton = document.getElementById('saveStudentButton');
const cancelButton = document.getElementById('cancelEditButton');
const messageBox = document.getElementById('studentMessage');
const searchInput = document.getElementById('searchStudent');
const statsGrid = document.getElementById('statsGrid');
const batchContainer = document.getElementById('batchContainer');

let students = [];
let batches = [];
let payments = [];

async function loadBatches() {
    const { data, error } = await supabase
        .from('batches')
        .select('id, batch_name, start_time, end_time')
        .order('id');

    if (error) throw error;

    batches = data || [];
    batchSelect.innerHTML = '';

    if (batches.length === 0) {
        batchSelect.innerHTML = '<option value="">No batches found</option>';
        showMessage(messageBox, 'No batches were found in the batches table.', 'error');
        return;
    }

    batchSelect.innerHTML = '<option value="">Select batch</option>';

    batches.forEach(batch => {
        const option = document.createElement('option');
        option.value = batch.id;
        option.textContent =
            `${batch.batch_name} (${formatTime(batch.start_time)} - ${formatTime(batch.end_time)})`;
        batchSelect.appendChild(option);
    });
}

async function loadStudents() {
    const [studentResult, paymentResult] = await Promise.all([
        supabase.from('students').select('*').eq('is_active', true).order('student_name'),
        supabase.from('payments').select('*')
    ]);

    if (studentResult.error) throw studentResult.error;
    if (paymentResult.error) throw paymentResult.error;

    students = studentResult.data || [];
    payments = paymentResult.data || [];

    render();
}

function makeStatCard(title, value, note) {
    const card = document.createElement('div');
    card.className = 'stat-card';

    const label = document.createElement('p');
    label.textContent = title;

    const number = document.createElement('h2');
    number.textContent = value;

    const small = document.createElement('span');
    small.textContent = note;

    card.append(label, number, small);
    return card;
}

function renderStats() {
    statsGrid.innerHTML = '';

    const unpaidCount = students.filter(student => !isPaidThisMonth(student, payments)).length;

    statsGrid.appendChild(makeStatCard('Total Active Students', students.length, 'Currently enrolled'));
    statsGrid.appendChild(makeStatCard(`Unpaid in ${getMonthName()}`, unpaidCount, 'Still to pay this month'));

    batches.forEach(batch => {
        const count = students.filter(
            student => Number(student.batch_id) === Number(batch.id)
        ).length;

        statsGrid.appendChild(
            makeStatCard(
                batch.batch_name,
                count,
                `${formatTime(batch.start_time)} – ${formatTime(batch.end_time)}`
            )
        );
    });
}

function makeButton(text, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', () => onClick(button));
    return button;
}

function makeRow(student) {
    const row = document.createElement('tr');

    [
        student.student_name,
        `Class ${student.student_class}`,
        student.phone || '—',
        formatCurrency(monthlyFee(student.student_class))
    ].forEach(text => {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.appendChild(cell);
    });

    const paid = isPaidThisMonth(student, payments);

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = paid ? 'status-badge paid' : 'status-badge unpaid';
    badge.textContent = paid ? 'Paid' : 'Unpaid';
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    const actions = document.createElement('td');
    actions.className = 'actions-cell';

    actions.append(
        paid
            ? makeButton('Undo', 'small-button', button => undoPaid(student, button))
            : makeButton('Mark Paid', 'small-button pay-button', button => markPaid(student, button)),
        makeButton('Edit', 'small-button', () => startEdit(student)),
        makeButton('Deactivate', 'small-button danger-button', () => deactivateStudent(student))
    );

    row.appendChild(actions);
    return row;
}

function makeBatchSection(title, timing, list) {
    const section = document.createElement('div');
    section.className = 'batch-section';

    const heading = document.createElement('div');
    heading.className = 'section-heading';

    const left = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = title;
    const p = document.createElement('p');
    p.textContent = timing;
    left.append(h2, p);

    const count = document.createElement('span');
    count.textContent = `${list.length} Student${list.length === 1 ? '' : 's'}`;

    heading.append(left, count);
    section.appendChild(heading);

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Name</th><th>Class</th><th>Phone</th><th>Monthly Fee</th><th>' +
        getMonthName() + '</th><th>Actions</th></tr></thead>';

    const body = document.createElement('tbody');

    if (list.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.textContent = 'No students in this batch.';
        row.appendChild(cell);
        body.appendChild(row);
    } else {
        list.forEach(student => body.appendChild(makeRow(student)));
    }

    table.appendChild(body);
    wrapper.appendChild(table);
    section.appendChild(wrapper);

    return section;
}

function render() {
    renderStats();

    const search = searchInput.value.trim().toLowerCase();

    const visible = students.filter(student =>
        student.student_name.toLowerCase().includes(search) ||
        (student.phone || '').includes(search)
    );

    batchContainer.innerHTML = '';

    batches.forEach(batch => {
        const list = visible.filter(
            student => Number(student.batch_id) === Number(batch.id)
        );

        if (search && list.length === 0) return;

        batchContainer.appendChild(
            makeBatchSection(
                batch.batch_name,
                `${formatTime(batch.start_time)} – ${formatTime(batch.end_time)}`,
                list
            )
        );
    });

    const knownIds = new Set(batches.map(batch => Number(batch.id)));
    const orphans = visible.filter(student => !knownIds.has(Number(student.batch_id)));

    if (orphans.length > 0) {
        batchContainer.appendChild(
            makeBatchSection('No batch', 'Edit these students to assign a batch', orphans)
        );
    }

    if (batchContainer.children.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-note';
        empty.textContent = search ? 'No students match your search.' : 'No batches available yet.';
        batchContainer.appendChild(empty);
    }
}

function resetForm() {
    studentForm.reset();
    editStudentId.value = '';
    formTitle.textContent = 'Add New Student';
    saveButton.textContent = 'Add Student';
    cancelButton.hidden = true;
}

function startEdit(student) {
    editStudentId.value = student.id;
    nameInput.value = student.student_name;
    classInput.value = String(student.student_class);
    phoneInput.value = student.phone || '';
    batchSelect.value = String(student.batch_id || '');

    formTitle.textContent = 'Edit Student';
    saveButton.textContent = 'Save Changes';
    cancelButton.hidden = false;

    showMessage(messageBox, '', '');
    studentForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameInput.focus();
}

cancelButton.addEventListener('click', () => {
    resetForm();
    showMessage(messageBox, '', '');
});

studentForm.addEventListener('submit', async event => {
    event.preventDefault();

    const phone = phoneInput.value.trim();

    if (phone && !/^[0-9]{10}$/.test(phone)) {
        showMessage(messageBox, 'Phone number must be exactly 10 digits.', 'error');
        return;
    }

    if (!batchSelect.value) {
        showMessage(messageBox, 'Please select a batch.', 'error');
        return;
    }

    const record = {
        student_name: nameInput.value.trim(),
        student_class: Number(classInput.value),
        phone: phone || null,
        batch_id: Number(batchSelect.value)
    };

    const editing = Boolean(editStudentId.value);

    saveButton.disabled = true;
    saveButton.textContent = editing ? 'Saving...' : 'Adding...';

    try {
        if (editing) {
            const { error } = await supabase
                .from('students')
                .update(record)
                .eq('id', Number(editStudentId.value));

            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('students')
                .insert({ ...record, is_active: true });

            if (error) throw error;
        }

        resetForm();
        showMessage(messageBox, editing ? 'Student updated.' : 'Student added.', 'success');

        await loadStudents();

    } catch (error) {
        showMessage(messageBox, 'Could not save student: ' + error.message, 'error');
        saveButton.textContent = editing ? 'Save Changes' : 'Add Student';

    } finally {
        saveButton.disabled = false;
    }
});

async function markPaid(student, button) {
    if (isPaidThisMonth(student, payments)) {
        alert('This student has already paid for ' + getMonthName() + '.');
        return;
    }

    const amount = monthlyFee(student.student_class);

    const confirmed = confirm(
        `Mark ${formatCurrency(amount)} as paid for ${student.student_name} (${getMonthName()})?`
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = 'Saving...';

    const { error } = await supabase
        .from('payments')
        .upsert({
            student_id: student.id,
            fee_month: getMonthStart(),
            amount,
            status: 'paid',
            payment_date: getTodayString()
        }, { onConflict: 'student_id,fee_month' });

    if (error) {
        alert('Could not save payment: ' + error.message);
        button.disabled = false;
        button.textContent = 'Mark Paid';
        return;
    }

    await loadStudents();
}

async function undoPaid(student, button) {
    const confirmed = confirm(
        `Mark ${student.student_name} as unpaid for ${getMonthName()}?\n\nThis removes this month's payment record.`
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = 'Saving...';

    const { error } = await supabase
        .from('payments')
        .delete()
        .eq('student_id', student.id)
        .eq('status', 'paid')
        .gte('fee_month', getMonthStart())
        .lt('fee_month', getNextMonthStart());

    if (error) {
        alert('Could not undo payment: ' + error.message);
        button.disabled = false;
        button.textContent = 'Undo';
        return;
    }

    await loadStudents();
}

async function deactivateStudent(student) {
    const confirmed = confirm(
        `Deactivate ${student.student_name}?\n\nThey will be removed from active students and fee totals. Their payment records will be kept.`
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', student.id);

    if (error) {
        alert('Could not deactivate student: ' + error.message);
        return;
    }

    if (editStudentId.value === String(student.id)) resetForm();

    await loadStudents();
}

searchInput.addEventListener('input', render);

try {
    await loadBatches();
    await loadStudents();
} catch (error) {
    console.error('Students page error:', error);
    showMessage(messageBox, 'Could not load data: ' + error.message, 'error');
}
