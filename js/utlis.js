import { supabase } from './supabase.js';

// ==========================================
// LOGIN CHECK + LOGOUT
// ==========================================

export async function requireLogin() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.replace('index.html');
        throw new Error('Please log in first.');
    }

    return session;
}

export function setupLogout() {
    const button = document.getElementById('logoutButton');
    if (!button) return;

    button.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            alert('Could not log out: ' + error.message);
            return;
        }

        window.location.href = 'index.html';
    });
}


// ==========================================
// FEES (change the rule here, it updates everywhere)
// ==========================================

export function monthlyFee(studentClass) {
    return Number(studentClass) <= 5 ? 500 : 800;
}


// ==========================================
// DATES, TIME, CURRENCY
// ==========================================

export function getTodayString() {
    const today = new Date();

    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');
}

export function parseLocalDate(dateString) {
    if (!dateString) return null;

    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function addOneMonth(dateString, billingDay) {
    const date = parseLocalDate(dateString);
    if (!date) return null;

    const originalDay = Number(billingDay) || date.getDate();

    // Day 0 of (month + 2) = last day of the NEXT month
    const lastDayOfNextMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 2,
        0
    ).getDate();

    const next = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        Math.min(originalDay, lastDayOfNextMonth)
    );

    return [
        next.getFullYear(),
        String(next.getMonth() + 1).padStart(2, '0'),
        String(next.getDate()).padStart(2, '0')
    ].join('-');
}

export function formatDate(dateString) {
    const date = parseLocalDate(dateString);
    if (!date) return 'Not set';

    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

export function formatCurrency(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

export function formatTime(timeString) {
    if (!timeString) return '';

    const [hourString, minuteString] = timeString.slice(0, 5).split(':');
    const hour = Number(hourString);
    const minute = minuteString || '00';

    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function batchLabel(batch) {
    if (!batch) return 'Unknown';

    return `${batch.batch_name} (${formatTime(batch.start_time)} - ${formatTime(batch.end_time)})`;
}


// ==========================================
// PAYMENT STATUS
// ==========================================

export function hasPaidBefore(student, payments) {
    return payments.some(payment =>
        Number(payment.student_id) === Number(student.id) &&
        payment.status === 'paid'
    );
}

export function hasPaidCurrentCycle(student, payments) {
    if (!student.next_due_date) return false;

    return payments.some(payment =>
        Number(payment.student_id) === Number(student.id) &&
        payment.status === 'paid' &&
        payment.fee_month === student.next_due_date
    );
}

// Returns { text, urgent, days }
export function getDueStatus(student, payments) {
    if (!hasPaidBefore(student, payments)) {
        return { text: 'First payment not recorded', urgent: true, days: -Infinity };
    }

    if (hasPaidCurrentCycle(student, payments)) {
        return { text: 'Paid for this cycle', urgent: false, days: Infinity };
    }

    if (!student.next_due_date) {
        return { text: 'Date not available', urgent: false, days: Infinity };
    }

    const today = parseLocalDate(getTodayString());
    const dueDate = parseLocalDate(student.next_due_date);
    const days = Math.round((dueDate - today) / 86400000);

    if (days < 0) {
        return {
            text: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`,
            urgent: true,
            days
        };
    }
    if (days === 0) return { text: 'Due today', urgent: true, days };
    if (days === 1) return { text: 'Due tomorrow', urgent: true, days };

    return { text: `Due in ${days} days`, urgent: false, days };
}


// ==========================================
// SMALL UI HELPER
// ==========================================

export function showMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = type ? `message ${type}` : 'message';
}
