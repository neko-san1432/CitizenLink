import { renderPrivacyNotice } from '../utils/privacyContent.js';

const initializePrivacyNotice = () => {
  renderPrivacyNotice('#privacy-notice-content', { headingTag: 'h2' });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePrivacyNotice);
} else {
  initializePrivacyNotice();
}

