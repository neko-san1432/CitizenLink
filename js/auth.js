// Auth and UI functionality
import { supabase } from "./api/database";
import { 
  sanitizeInput, 
  validatePhoneNumber, 
  validatePassword,
  secureStorage,
  rateLimiter,
  generateCSRFToken
} from './utils/security';

// Initialize CSRF token on page load
const csrfToken = generateCSRFToken();
document.cookie = `csrf_token=${csrfToken}; SameSite=Strict; Secure`;

// Initialize UI elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const otpModal = document.getElementById('otp-modal');
const otpInputs = document.querySelectorAll('.otp-input');
const otpTimer = document.getElementById('otp-timer');
const verifyOtpButton = document.getElementById('verify-otp');
const resendOtpButton = document.getElementById('resend-otp');
const requestOtpButton = document.getElementById('request-otp');

// Tab switching functionality
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.getAttribute('data-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      }
    });
  });
});

// Toast notification function
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show';
  toast.classList.add(type === 'error' ? 'error' : 'success');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// OTP Modal Functions
function showOtpModal() {
  otpModal.classList.add('show');
  otpInputs[0].focus();
  startOtpTimer();
}

function hideOtpModal() {
  otpModal.classList.remove('show');
  otpInputs.forEach(input => input.value = '');
  verifyOtpButton.disabled = true;
}

function startOtpTimer() {
  resendOtpButton.disabled = true;
  let countdown = 30;
  const timerSpan = otpTimer.querySelector('span');
  
  const timer = setInterval(() => {
    countdown--;
    timerSpan.textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(timer);
      resendOtpButton.disabled = false;
      timerSpan.textContent = '0';
    }
  }, 1000);
}

// OTP Input Handling
otpInputs.forEach((input, index) => {
  input.addEventListener('keyup', (e) => {
    const currentInput = e.target;
    const nextInput = input.nextElementSibling;
    const prevInput = input.previousElementSibling;

    // Clear value if not a number
    if (isNaN(currentInput.value)) {
      currentInput.value = '';
      return;
    }

    // Auto-focus next input
    if (nextInput && currentInput.value !== '') {
      nextInput.focus();
    }

    // Handle backspace
    if (e.key === 'Backspace') {
      if (prevInput) {
        prevInput.focus();
      }
    }

    // Enable verify button if all inputs are filled
    const isComplete = Array.from(otpInputs).every(input => input.value.length === 1);
    verifyOtpButton.disabled = !isComplete;
  });

  // Handle paste event
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').split('');
    
    otpInputs.forEach((input, index) => {
      if (pastedData[index]) {
        input.value = pastedData[index];
        const isComplete = Array.from(otpInputs).every(input => input.value.length === 1);
        verifyOtpButton.disabled = !isComplete;
      }
    });
  });
});

// Login Form Handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      if (!rateLimiter.isAllowed('login')) {
        showToast('Too many attempts. Please try again later.', 'error');
        return;
      }

      const phone = sanitizeInput(document.getElementById('phone').value);
      const password = document.getElementById('password').value;

      if (!validatePhoneNumber(phone)) {
        showToast('Invalid phone number format', 'error');
        return;
      }

      const formattedPhone = `+63${phone}`;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password: password,
        options: { headers: { 'X-CSRF-Token': csrfToken } }
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          showToast('Invalid phone number or password', 'error');
        } else {
          throw error;
        }
        return;
      }

      if (data?.user) {
        secureStorage.setItem('user_session', {
          id: data.user.id,
          phone: formattedPhone,
          timestamp: Date.now()
        });

        const { error: otpError } = await supabase.auth.signInWithOtp({
          phone: formattedPhone
        });

        if (otpError) throw otpError;

        secureStorage.setItem('pendingVerification', {
          phone: formattedPhone,
          type: 'login'
        });

        showToast('Please verify your login with the OTP sent to your phone.');
        showOtpModal();
      }
    } catch (error) {
      console.error('Login error:', error.message);
      showToast(error.message || 'Failed to login. Please try again.', 'error');
    }
  });
}

// Signup Form Handler
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      const fullName = sanitizeInput(document.getElementById('fullName').value);
      const phone = sanitizeInput(document.getElementById('phone').value);
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      if (!fullName || fullName.length < 2) {
        showToast('Please enter a valid full name', 'error');
        return;
      }

      if (!validatePhoneNumber(phone)) {
        showToast('Invalid phone number format', 'error');
        return;
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        showToast(passwordValidation.errors[0], 'error');
        return;
      }
      
      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      const formattedPhone = `+63${phone}`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: { shouldCreateUser: true }
      });

      if (otpError) throw otpError;

      secureStorage.setItem('pendingVerification', {
        phone: formattedPhone,
        full_name: fullName,
        password: password,
        type: 'signup'
      });

      showToast('Please verify your phone number with the OTP sent to your phone.');
      showOtpModal();
    } catch (error) {
      console.error('Signup error:', error.message);
      showToast(error.message || 'Failed to create account. Please try again.', 'error');
    }
  });
}

// OTP Verification Handler
if (verifyOtpButton) {
  verifyOtpButton.addEventListener('click', async () => {
    try {
      if (!rateLimiter.isAllowed('verify-otp')) {
        showToast('Too many attempts. Please try again later.', 'error');
        return;
      }

      const otp = Array.from(otpInputs).map(input => input.value).join('');
      const pendingData = secureStorage.getItem('pendingVerification');
      
      if (!pendingData) {
        showToast('Verification session expired. Please try again.', 'error');
        hideOtpModal();
        return;
      }

      const { phone, type, full_name, password } = pendingData;

      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms'
      });

      if (error) throw error;

      if (type === 'signup') {
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
          data: { full_name: full_name }
        });

        if (updateError) throw updateError;
      }

      secureStorage.removeItem('pendingVerification');

      const successMessage = type === 'signup' 
        ? 'Account created successfully! Redirecting to login...'
        : 'Login successful! Redirecting...';

      showToast(successMessage);
      hideOtpModal();
      
      setTimeout(() => {
        window.location.href = type === 'signup' ? 'login.html' : 'citizen/dashboard.html';
      }, 1500);

    } catch (error) {
      console.error('Verification error:', error.message);
      showToast(error.message || 'Failed to verify OTP. Please try again.', 'error');
    }
  });
}

// Resend OTP Handler
if (resendOtpButton) {
  resendOtpButton.addEventListener('click', async () => {
    try {
      const pendingData = secureStorage.getItem('pendingVerification');
      
      if (!pendingData) {
        showToast('Verification session expired. Please try again.', 'error');
        hideOtpModal();
        return;
      }

      const { phone, type } = pendingData;

      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: type === 'signup' }
      });

      if (error) throw error;

      showToast('New OTP has been sent to your phone.');
      startOtpTimer();
    } catch (error) {
      console.error('Resend OTP error:', error.message);
      showToast(error.message || 'Failed to resend OTP. Please try again.', 'error');
    }
  });
}

// Request OTP button handler
if (requestOtpButton) {
  requestOtpButton.addEventListener('click', async () => {
    try {
      const phone = sanitizeInput(document.getElementById('phone').value);

      if (!validatePhoneNumber(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
      }

      const formattedPhone = `+63${phone}`;

      // Request OTP
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone
      });

      if (error) throw error;

      // Store the phone number for verification
      secureStorage.setItem('pendingVerification', {
        phone: formattedPhone,
        type: 'login-otp'
      });

      showToast('OTP has been sent to your phone');
      showOtpModal();

      // Disable the button for 30 seconds
      requestOtpButton.disabled = true;
      let countdown = 30;
      const originalText = requestOtpButton.textContent;
      
      const timer = setInterval(() => {
        requestOtpButton.textContent = `Request OTP (${countdown}s)`;
        countdown--;
        
        if (countdown < 0) {
          clearInterval(timer);
          requestOtpButton.disabled = false;
          requestOtpButton.textContent = originalText;
        }
      }, 1000);

    } catch (error) {
      console.error('Request OTP error:', error.message);
      showToast(error.message || 'Failed to send OTP. Please try again.', 'error');
    }
  });
}