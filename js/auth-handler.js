import { supabase } from "./api/database.js";
import { 
    validatePhoneNumber, 
    validatePassword,
    generateCSRFToken
} from './utils/security.js';
import { 
    getRecaptchaResponse, 
    resetRecaptcha 
} from './recaptcha.js';

// Function to handle login
export async function handleLogin(formData) {
    const { phone, password } = formData;
    
    // Validate inputs
    if (!validatePhoneNumber(phone)) {
        showToast('Invalid phone number format');
        return false;
    }
    
    if (!validatePassword(password)) {
        showToast('Invalid password format');
        return false;
    }

    // Check reCAPTCHA
    const recaptchaToken = getRecaptchaResponse();
    if (!recaptchaToken) {
        showToast('Please complete the reCAPTCHA verification');
        return false;
    }

    try {
        // Verify reCAPTCHA token
        const verificationResult = await verifyRecaptcha(recaptchaToken);
        if (!verificationResult.success) {
            showToast('reCAPTCHA verification failed');
            resetRecaptcha();
            return false;
        }

        // Attempt login with Supabase
        const { error } = await supabase.auth.signInWithPassword({
            phone: `+63${phone}`,
            password: password
        });

        if (error) {
            showToast(error.message);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Login error:', error);
        showToast('An error occurred during login');
        return false;
    }
}

// Function to handle signup
export async function handleSignup(formData) {
    const { fullName, phone, password, confirmPassword } = formData;
    
    // Validate inputs
    if (!validatePhoneNumber(phone)) {
        showToast('Invalid phone number format');
        return false;
    }
    
    if (!validatePassword(password)) {
        showToast('Password must be at least 8 characters');
        return false;
    }

    if (password !== confirmPassword) {
        showToast('Passwords do not match');
        return false;
    }

    // Check reCAPTCHA
    const recaptchaToken = getRecaptchaResponse();
    if (!recaptchaToken) {
        showToast('Please complete the reCAPTCHA verification');
        return false;
    }

    try {
        // Verify reCAPTCHA token
        const verificationResult = await verifyRecaptcha(recaptchaToken);
        if (!verificationResult.success) {
            showToast('reCAPTCHA verification failed');
            resetRecaptcha();
            return false;
        }

        // Attempt signup with Supabase
        const { error } = await supabase.auth.signUp({
            phone: `+63${phone}`,
            password: password,
            data: {
                full_name: fullName
            }
        });

        if (error) {
            showToast(error.message);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Signup error:', error);
        showToast('An error occurred during signup');
        return false;
    }
}

// Function to handle OTP request
export async function handleOTPRequest(phone) {
    // Validate phone number
    if (!validatePhoneNumber(phone)) {
        showToast('Invalid phone number format');
        return false;
    }

    // Check reCAPTCHA
    const recaptchaToken = getRecaptchaResponse();
    if (!recaptchaToken) {
        showToast('Please complete the reCAPTCHA verification');
        return false;
    }

    try {
        // Verify reCAPTCHA token
        const verificationResult = await verifyRecaptcha(recaptchaToken);
        if (!verificationResult.success) {
            showToast('reCAPTCHA verification failed');
            resetRecaptcha();
            return false;
        }

        // Request OTP from Supabase
        const { error } = await supabase.auth.signInWithOtp({
            phone: `+63${phone}`
        });

        if (error) {
            showToast(error.message);
            return false;
        }

        return true;
    } catch (error) {
        console.error('OTP request error:', error);
        showToast('An error occurred while requesting OTP');
        return false;
    }
}

// Helper function to verify reCAPTCHA token with server
async function verifyRecaptcha(token) {
    try {
        const response = await fetch('/verify-recaptcha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': generateCSRFToken()
            },
            body: JSON.stringify({ token })
        });

        if (!response.ok) {
            throw new Error('reCAPTCHA verification request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('reCAPTCHA verification error:', error);
        return { success: false };
    }
}

// Helper function to show toast messages
function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    if (!toast) return;
      toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => toast.style.display = 'none', 3000);
}
