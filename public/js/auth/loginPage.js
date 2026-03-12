document.addEventListener("DOMContentLoaded", () => {
  // Password Toggle Logic
  const toggleButtons = document.querySelectorAll(".password-toggle");

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const icon = button.querySelector("svg");

      if (input.type === "password") {
        input.type = "text";
        // Switch to eye-off icon
        icon.innerHTML = `
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
      } else {
        input.type = "password";
        // Switch back to eye icon
        icon.innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        `;
      }
    });
  });

  // Test Login Logic
  async function initTestLogin() {
    try {
      const response = await fetch("/api/config");
      const config = await response.json();

      if (config.testLoginEnabled && config.testEmails) {
        injectTestUI(config.testEmails);
      }
    } catch (error) {
      console.warn("[TEST LOGIN] Failed to load config:", error);
    }
  }

  function injectTestUI(testEmails) {
    const sidebar = document.querySelector(".auth-sidebar");
    if (!sidebar) return;

    const testSection = document.createElement("div");
    testSection.className = "oauth-section test-login-section";
    testSection.style.marginTop = "2rem";
    testSection.style.paddingTop = "2rem";
    testSection.style.borderTop = "1px solid rgba(255, 255, 255, 0.1)";

    testSection.innerHTML = `
      <h3 class="oauth-title" style="color: var(--primary-color)">Quick Login (Test Mode)</h3>
      <div class="oauth-buttons" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <button type="button" class="btn btn-secondary test-btn" data-email="${testEmails.citizen}" data-role="Citizen">
          <span>Login as Citizen</span>
        </button>
        <button type="button" class="btn btn-secondary test-btn" data-email="${testEmails.lgu}" data-role="LGU">
          <span>Login as LGU</span>
        </button>
        <button type="button" class="btn btn-secondary test-btn" data-email="${testEmails.superAdmin}" data-role="Super Admin">
          <span>Login as Super Admin</span>
        </button>
      </div>
      <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 1rem; text-align: center;">
        Password: <code>${testEmails.password}</code>
      </p>
    `;

    sidebar.appendChild(testSection);

    // Add event listeners to test buttons
    testSection.querySelectorAll(".test-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const emailInput = document.getElementById("email");
        const passInput = document.getElementById("password");
        const loginForm = document.getElementById("login");

        if (emailInput && passInput && loginForm) {
          emailInput.value = btn.dataset.email;
          passInput.value = testEmails.password;

          // Trigger input events for any validation logic
          emailInput.dispatchEvent(new Event("input", { bubbles: true }));
          passInput.dispatchEvent(new Event("input", { bubbles: true }));

          // Show a quick message
          const btnText = btn.querySelector("span");
          // const originalText = btnText.textContent;
          btnText.textContent = "Logging in...";

          // Submit the form
          loginForm.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      });
    });
  }

  initTestLogin();
});
