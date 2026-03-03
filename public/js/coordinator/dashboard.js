import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/api/coordinator/start-counts");
    const { data } = await response.json();

    if (data) {
      const setStatText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      setStatText("stat-incoming", data.incoming || 0);
      setStatText("stat-unverified", data.unverified || 0);
      setStatText("stat-assigned", data.assigned || 0);
      setStatText("stat-escalated", data.escalated || 0);
    }

    // Initialize Charts (Mock data for now to prevent errors if API lacks chart data)
    const trendCtx = document.getElementById("trendChart")?.getContext("2d");
    if (trendCtx) {
      new Chart(trendCtx, {
        type: "line",
        data: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [{
            label: "Incoming Complaints",
            data: [12, 19, 3, 5, 2, 3, 7],
            borderColor: "rgb(75, 192, 192)",
            tension: 0.1
          }]
        }
      });
    }

  } catch (error) {
    console.error("Failed to load dashboard stats:", error);
  } finally {
    hideDashboardLoader();
  }
});

function hideDashboardLoader() {
  const loader = document.getElementById("dashboard-loading");
  const content = document.getElementById("dashboard-main-content");

  if (loader) {
    loader.style.setProperty("display", "none", "important");
  }

  if (content) {
    content.style.setProperty("display", "block", "important");
    setTimeout(() => {
      content.style.opacity = "1";
    }, 50);
  }
}
