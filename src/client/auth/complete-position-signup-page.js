// Complete Position Signup page specific functionality

// Fetch CAPTCHA key for position signup
const fetchCaptchaKey = async () => {
  try {
    const response = await fetch('/api/captcha/oauth-key');
    const data = await response.json();

    if (data.success && data.key) {
      return data.key;
    } else {
      console.error('Failed to fetch CAPTCHA key:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Error fetching CAPTCHA key:', error);
    return null;
  }
};

// Initialize CAPTCHA on position signup page
const initializeCaptcha = async () => {
  const captchaContainer = document.getElementById('position-signup-captcha');

  if (!captchaContainer || !window.grecaptcha) {
    console.warn('CAPTCHA not available');
    return;
  }

  try {
    const siteKey = await fetchCaptchaKey();

    if (siteKey) {
      window.grecaptcha.ready(() => {
        window.grecaptcha.render(captchaContainer, {
          sitekey: siteKey
        });
      });
    }
  } catch (error) {
    console.error('Failed to initialize CAPTCHA:', error);
  }
};

// Initialize Complete Position Signup page
const initializeCompletePositionSignupPage = () => {
  // Initialize CAPTCHA
  initializeCaptcha();

  // Re-initialize CAPTCHA after a delay to handle async script loading
  setTimeout(initializeCaptcha, 1000);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCompletePositionSignupPage);
} else {
  initializeCompletePositionSignupPage();
}
