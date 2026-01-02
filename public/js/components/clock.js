/**
 * Simple real-time clock component for the dashboard
 */

export function initClock() {
  const clockContainer = document.getElementById("dashboard-clock");
  if (!clockContainer) return;

  function updateClock() {
    const now = new Date();

    // Format: Day, Month Date, Year · HH:MM:SS AM/PM
    const dateOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    const timeOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    };

    const dateStr = now.toLocaleDateString("en-US", dateOptions);
    const timeStr = now.toLocaleTimeString("en-US", timeOptions);

    clockContainer.innerHTML = `
      <span class="date">${dateStr}</span>
      <span class="separator">·</span>
      <span class="time">${timeStr}</span>
    `;
  }

  // Update immediately and then every second
  updateClock();
  setInterval(updateClock, 1000);
}

// Auto-initialize if the script is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initClock);
} else {
  initClock();
}
