// OAuth continuation page specific functionality
// Fetch CAPTCHA key for OAuth continuation
const fetchCaptchaKey = async () => {
  try {
    const response = await fetch('/api/captcha/oauth-key');
    const data = await response.json();
    if (data.success && data.key) {
      return data.key;
    }
    console.error('Failed to fetch CAPTCHA key:', data.error);
    return null;
  } catch (error) {
    console.error('Error fetching CAPTCHA key:', error);
    return null;
  }
};
// Initialize CAPTCHA on OAuth continuation page
const initializeCaptcha = async () => {
  const captchaContainer = document.getElementById('oauth-complete-captcha');
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
// Initialize OAuth continuation page
const initializeOAuthContinuationPage = () => {
  // Initialize CAPTCHA
  initializeCaptcha();
  // Re-initialize CAPTCHA after a delay to handle async script loading
  setTimeout(initializeCaptcha, 1000);
};
// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOAuthContinuationPage);
} else {
  initializeOAuthContinuationPage();
}
