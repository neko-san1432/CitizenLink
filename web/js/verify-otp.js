// OTP Verification Logic
class OTPVerifier {
    constructor() {
        this.otpInputs = document.querySelectorAll('.otp-input');
        this.otpForm = document.getElementById('otp-form');
        this.verifyBtn = document.getElementById('verify-btn');
        this.resendBtn = document.getElementById('resend-btn');
        this.countdown = document.getElementById('countdown');
        this.timerText = document.getElementById('timer-text');
        this.otpInstruction = document.getElementById('otp-instruction');
        
        this.countdownTime = 30;
        this.timer = null;
        this.isResendEnabled = false;
        
        this.init();
    }
    
    init() {
        this.setupOTPInputs();
        this.setupFormSubmission();
        this.startCountdown();
        this.loadEmail();
    }
    
    setupOTPInputs() {
        this.otpInputs.forEach((input, index) => {
            // Handle input
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                
                // Only allow numbers
                if (!/^\d*$/.test(value)) {
                    e.target.value = '';
                    return;
                }
                
                // Auto-focus next input
                if (value && index < this.otpInputs.length - 1) {
                    this.otpInputs[index + 1].focus();
                }
                
                // Update input styling
                this.updateInputStyle(input, value);
                
                // Check if all inputs are filled
                this.checkFormCompletion();
            });
            
            // Handle backspace
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    this.otpInputs[index - 1].focus();
                }
            });
            
            // Handle paste
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pastedData = e.clipboardData.getData('text');
                this.handlePaste(pastedData);
            });
        });
    }
    
    setupFormSubmission() {
        this.otpForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.verifyOTP();
        });
        
        this.resendBtn.addEventListener('click', () => {
            this.resendOTP();
        });
    }
    
    updateInputStyle(input, value) {
        input.classList.remove('filled', 'error');
        
        if (value) {
            input.classList.add('filled');
        }
    }
    
    checkFormCompletion() {
        const allFilled = Array.from(this.otpInputs).every(input => input.value);
        this.verifyBtn.disabled = !allFilled;
    }
    
    handlePaste(pastedData) {
        const numbers = pastedData.replace(/\D/g, '').slice(0, 6);
        
        if (numbers.length === 6) {
            this.otpInputs.forEach((input, index) => {
                input.value = numbers[index] || '';
                this.updateInputStyle(input, input.value);
            });
            this.checkFormCompletion();
            this.otpInputs[5].focus();
        }
    }
    
    startCountdown() {
        this.countdown.textContent = this.countdownTime;
        
        this.timer = setInterval(() => {
            this.countdownTime--;
            this.countdown.textContent = this.countdownTime;
            
            if (this.countdownTime <= 0) {
                this.enableResend();
                clearInterval(this.timer);
            }
        }, 1000);
    }
    
    enableResend() {
        this.isResendEnabled = true;
        this.resendBtn.disabled = false;
        this.timerText.textContent = '';
        this.countdown.style.display = 'none';
    }
    
    loadEmail() {
        // Get email from URL params or sessionStorage
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email') || sessionStorage.getItem('signup_email');
        
        if (email) {
            this.otpInstruction.textContent = `Your code was sent to ${this.maskEmail(email)}`;
        }
    }
    
    maskEmail(email) {
        // Mask email for privacy (e.g., j***@example.com)
        const [username, domain] = email.split('@');
        if (username.length > 2) {
            const maskedUsername = username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);
            return `${maskedUsername}@${domain}`;
        }
        return email;
    }
    
    // ===== DUMMY OTP VERIFICATION =====
    // This can be easily replaced with real API calls later
    async verifyOTP() {
        const otp = Array.from(this.otpInputs).map(input => input.value).join('');
        
        // Show loading state
        this.verifyBtn.disabled = true;
        this.verifyBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';
        
        try {
            // Simulate API call delay
            await this.simulateAPICall(1500);
            
            // DUMMY LOGIC: Accept any 6-digit OTP
            if (otp.length === 6 && /^\d{6}$/.test(otp)) {
                this.showSuccess('OTP verified successfully!');
                
                // Simulate redirect after success
                setTimeout(() => {
                                    // Store verification status
                sessionStorage.setItem('otp_verified', 'true');
                sessionStorage.setItem('user_email', sessionStorage.getItem('signup_email'));
                    
                    // Redirect to dashboard
                    window.location.href = '/dashboard';
                }, 1500);
            } else {
                this.showError('Invalid OTP. Please try again.');
                this.clearOTPInputs();
            }
        } catch (error) {
            this.showError('Verification failed. Please try again.');
        } finally {
            // Reset button state
            this.verifyBtn.disabled = false;
            this.verifyBtn.innerHTML = 'Verify';
        }
    }
    
    async resendOTP() {
        if (!this.isResendEnabled) return;
        
        // Show loading state
        this.resendBtn.disabled = true;
        this.resendBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Resending...';
        
        try {
            // Simulate API call delay
            await this.simulateAPICall(1000);
            
            // DUMMY LOGIC: Generate new OTP
            const newOTP = this.generateDummyOTP();
            
            this.showSuccess(`New OTP sent: ${newOTP}`);
            
            // Reset countdown
            this.countdownTime = 30;
            this.startCountdown();
            this.isResendEnabled = false;
            this.resendBtn.disabled = true;
            this.timerText.textContent = 'Resend code in ';
            this.countdown.style.display = 'inline';
            
        } catch (error) {
            this.showError('Failed to resend OTP. Please try again.');
        } finally {
            // Reset button state
            this.resendBtn.disabled = false;
            this.resendBtn.innerHTML = 'Didn\'t receive code? <span class="text-primary">Request again</span>';
        }
    }
    
    // ===== UTILITY FUNCTIONS =====
    generateDummyOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    
    async simulateAPICall(delay) {
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    
    clearOTPInputs() {
        this.otpInputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled', 'error');
        });
        this.verifyBtn.disabled = true;
        this.otpInputs[0].focus();
    }
    
    showSuccess(message) {
        this.showToast('Success', message, 'success');
    }
    
    showError(message) {
        this.showToast('Error', message, 'danger');
    }
    
    showToast(title, message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastTitle = document.getElementById('toast-title');
        const toastMessage = document.getElementById('toast-message');
        
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        // Update toast styling based on type
        toast.className = `toast text-${type}`;
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
}

// Initialize OTP verifier when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OTPVerifier();
});

// ===== FUTURE API INTEGRATION NOTES =====
/*
When you're ready to integrate with real APIs, replace these functions:

1. verifyOTP() - Replace with actual API call:
   - POST to /api/verify-otp
   - Send email and OTP
   - Handle real server response

2. resendOTP() - Replace with actual API call:
   - POST to /api/resend-otp
   - Send email
   - Handle real server response

3. Update error handling for real API responses
4. Add proper authentication tokens
5. Implement real email validation
6. Add rate limiting for OTP requests
*/
