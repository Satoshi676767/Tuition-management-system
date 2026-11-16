
import { supabase } from './supabase.js';

const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const loginButton = document.getElementById('loginButton');

// Check whether admin is already logged in
const { data: { session } } = await supabase.auth.getSession();

if (session) {
    window.location.href = 'dashboard.html';
}

// Handle admin login
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
    loginMessage.textContent = '';

    // Authenticate with Supabase
    const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (loginError) {
        loginMessage.textContent = loginError.message;
        loginMessage.className = 'message error';
        loginButton.disabled = false;
        loginButton.textContent = 'Sign In';
        return;
    }

    // Test database access after login
    const { data, error } = await supabase
        .from('batches')
        .select('*');

    if (error) {
        loginMessage.textContent = 'Database error: ' + error.message;
        loginMessage.className = 'message error';
        loginButton.disabled = false;
        loginButton.textContent = 'Sign In';
        return;
    }

    console.log('Supabase connected successfully!');
    console.log('Available batches:', data);

    window.location.href = 'dashboard.html';
});
