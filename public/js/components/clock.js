function formatTwo(n) { return n < 10 ? `0${  n}` : String(n); }

function renderClock() {
  const el = document.getElementById("dashboard-clock");
  if (!el) return;
  const now = new Date();
  const h = formatTwo(now.getHours());
  const m = formatTwo(now.getMinutes());
  const s = formatTwo(now.getSeconds());
  const dateStr = now.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  el.innerHTML = `<span class="time">${  h  }:${  m  }:${  s  }</span><span class="date">${  dateStr  }</span>`;
}

export function initDashboardClock() {
  if (!document.getElementById("dashboard-clock")) return;
  renderClock();
  setInterval(renderClock, 1000);
}
// auto-init if included directly
document.addEventListener("DOMContentLoaded", () => {
  initDashboardClock();
});
