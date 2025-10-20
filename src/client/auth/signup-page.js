// Signup page specific functionality
import { supabase } from '../config/config.js';

// Check if user is already logged in and redirect to dashboard
const checkAuthentication = async () => {
  try {
    // console.log removed for security

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (session && !error) {
      // console.log removed for security

      // Get user metadata
      const user = session.user;
      const role = user?.user_metadata?.role || '';
      const name = user?.user_metadata?.name || '';

      // Check if user has completed registration
      if (role && name) {
        // console.log removed for security
        window.location.href = '/dashboard';
        return;
      } else {
        // console.log removed for security
        window.location.href = '/oauth-continuation';
        return;
      }
    } else {
      // console.log removed for security
    }
  } catch (error) {
    console.error('💥 Authentication check failed:', error);
    // If there's an error, let the user proceed with signup
  }
};

// Initialize signup page
const initializeSignupPage = () => {
  // Run authentication check when page loads
  checkAuthentication();

  // Wire password strength meter
  attachPasswordStrengthMeter();

  // Listen for auth state changes to update UI dynamically
  supabase.auth.onAuthStateChange((event, session) => {
    // console.log removed for security
    if (event === 'SIGNED_IN' && session) {
      checkAuthentication();
    }
  });

  // Wire Terms & Privacy Modals
  try {
    const termsCheckbox = document.getElementById('terms-checkbox');
    const openers = document.querySelectorAll('[data-open-modal]');
    const closeButtons = document.querySelectorAll('[data-close-modal]');

    openers.forEach(opener => {
      opener.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = opener.getAttribute('data-open-modal');
        const modal = document.getElementById(targetId);
        if (modal) modal.classList.add('open');
      });
    });

    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) modal.classList.remove('open');
      });
    });

    // Accept buttons
    const acceptTerms = document.querySelector('[data-accept-terms]');
    if (acceptTerms) {
      acceptTerms.addEventListener('click', () => {
        const modal = acceptTerms.closest('.modal');
        if (modal) modal.classList.remove('open');
        if (termsCheckbox) termsCheckbox.checked = true;
      });
    }

    const acceptPrivacy = document.querySelector('[data-accept-privacy]');
    if (acceptPrivacy) {
      acceptPrivacy.addEventListener('click', () => {
        const modal = acceptPrivacy.closest('.modal');
        if (modal) modal.classList.remove('open');
        if (termsCheckbox) termsCheckbox.checked = true; // consent covers both
      });
    }
  } catch (err) {
    // console.log removed for security
  }
};

// --- Live password strength meter wiring ---
function attachPasswordStrengthMeter() {
  try {
    const passwordInput = document.getElementById('regPassword');
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');

    if (!passwordInput || !strengthFill || !strengthText) return;

    const classList = ['weak', 'fair', 'good', 'strong'];

    const calcScore = (pwd) => {
      let score = 0;
      if (!pwd) return 0;
      if (pwd.length >= 8) score++;
      if (pwd.length >= 12) score++;
      if (/[a-z]/.test(pwd)) score++;
      if (/[A-Z]/.test(pwd)) score++;
      if (/\d/.test(pwd)) score++;
      if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) score++;
      // penalties
      if (/(.)\1{2,}/.test(pwd)) score -= 1;
      if (/123456|abcdef|qwerty|asdfgh|zxcvbn/i.test(pwd)) score -= 2;
      return Math.max(0, Math.min(4, score));
    };

    const labelFor = (score) => {
      switch (true) {
        case score <= 1: return 'Weak';
        case score === 2: return 'Fair';
        case score === 3: return 'Good';
        default: return 'Strong';
      }
    };

    const classFor = (score) => {
      if (score <= 1) return 'weak';
      if (score === 2) return 'fair';
      if (score === 3) return 'good';
      return 'strong';
    };

    const update = () => {
      const pwd = passwordInput.value || '';
      // Do not evaluate if empty or less than 8 chars
      if (pwd.length < 8) {
        strengthFill.classList.remove('weak','fair','good','strong');
        strengthText.classList.remove('weak','fair','good','strong');
        strengthFill.style.width = '0%';
        strengthText.textContent = 'Password strength';
        return;
      }
      const score = calcScore(pwd);
      const cls = classFor(score);
      // reset
      strengthFill.classList.remove('weak','fair','good','strong');
      strengthText.classList.remove('weak','fair','good','strong');
      // Apply base width 0 first
      strengthFill.style.width = '0%';
      // apply classes
      strengthFill.classList.add(cls);
      strengthText.classList.add(cls);
      // Map class to width explicitly in case CSS not applied yet
      const widthMap = { weak: '25%', fair: '50%', good: '75%', strong: '100%' };
      strengthFill.style.width = widthMap[cls];
      strengthText.textContent = `Password strength: ${labelFor(score)}`;
    };

    passwordInput.addEventListener('input', update);
    update();
  } catch (_) {}
}


// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSignupPage);
} else {
  initializeSignupPage();
}
