/**
 * Password Visibility Toggle Utility
 * Adds show/hide password functionality to all password input fields
 */

/**
 * Initialize password toggle for a single password input
 * @param {HTMLInputElement} passwordInput - The password input element
 */
function initPasswordToggle(passwordInput) {
  if (!passwordInput || passwordInput.type !== 'password') {
    return;
  }

  // Check if toggle already exists
  if (passwordInput.dataset.toggleInitialized === 'true') {
    return;
  }

  // Mark as initialized
  passwordInput.dataset.toggleInitialized = 'true';

  // Find the input wrapper or create one
  let wrapper = passwordInput.parentElement;
  if (!wrapper || !wrapper.classList.contains('input-wrapper')) {
    // If no wrapper, wrap the input
    wrapper = document.createElement('div');
    wrapper.className = 'input-wrapper';
    wrapper.style.position = 'relative'; // Ensure relative positioning
    passwordInput.parentNode.insertBefore(wrapper, passwordInput);
    wrapper.appendChild(passwordInput);
  } else {
    // Ensure wrapper has relative positioning
    if (getComputedStyle(wrapper).position === 'static') {
      wrapper.style.position = 'relative';
    }
  }

  // Create toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'password-toggle';
  toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
  toggleBtn.innerHTML = `
    <svg class="eye-icon eye-show" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    <svg class="eye-icon eye-hide" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  `;

  // Add toggle functionality
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    // Toggle icon visibility
    const showIcon = toggleBtn.querySelector('.eye-show');
    const hideIcon = toggleBtn.querySelector('.eye-hide');

    if (isPassword) {
      // Show password - show hide icon
      showIcon.style.display = 'none';
      hideIcon.style.display = 'block';
      toggleBtn.setAttribute('aria-label', 'Hide password');
    } else {
      // Hide password - show show icon
      showIcon.style.display = 'block';
      hideIcon.style.display = 'none';
      toggleBtn.setAttribute('aria-label', 'Show password');
    }
  });

  // Insert toggle button - always append to wrapper (will be positioned absolutely)
  wrapper.appendChild(toggleBtn);
}

/**
 * Initialize password toggles for all password inputs on the page
 */
export function initAllPasswordToggles() {
  // Find all password inputs
  const passwordInputs = document.querySelectorAll('input[type="password"]');

  passwordInputs.forEach(input => {
    initPasswordToggle(input);
  });

  // Also watch for dynamically added password inputs
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'INPUT' && node.type === 'password') {
            initPasswordToggle(node);
          }
          // Check children
          const passwordInputs = node.querySelectorAll?.('input[type="password"]');
          if (passwordInputs) {
            passwordInputs.forEach(input => initPasswordToggle(input));
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllPasswordToggles);
} else {
  initAllPasswordToggles();
}

