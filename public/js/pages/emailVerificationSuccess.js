// Email verification success page with countdown timer
const COUNTDOWN_SECONDS = 5;
const REDIRECT_URL = "/login";

let countdown = COUNTDOWN_SECONDS;
const countdownElement = document.getElementById("countdown");
const redirectLink = document.getElementById("redirect-link");

// Update countdown display
const updateCountdown = () => {
  if (countdownElement) {
    countdownElement.textContent = countdown;
  }

  if (countdown <= 0) {
    // Redirect to login page
    window.location.href = REDIRECT_URL;
    return;
  }

  countdown--;
  // Update every second
  setTimeout(updateCountdown, 1000);
};

// Start countdown when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", updateCountdown);
} else {
  updateCountdown();
}

// Handle manual redirect link click
if (redirectLink) {
  redirectLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = REDIRECT_URL;
  });
}
