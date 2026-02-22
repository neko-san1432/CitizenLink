
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/coordinator/start-counts');
        const { data } = await response.json();

        if (data) {
            document.getElementById('stat-incoming').textContent = data.incoming || 0;
            document.getElementById('stat-unverified').textContent = data.unverified || 0;
            document.getElementById('stat-assigned').textContent = data.assigned || 0;
            document.getElementById('stat-escalated').textContent = data.escalated || 0;
        }

        // Initialize Charts (Mock data for now to prevent errors if API lacks chart data)
        const trendCtx = document.getElementById('trendChart')?.getContext('2d');
        if (trendCtx) {
            new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Incoming Complaints',
                        data: [12, 19, 3, 5, 2, 3, 7],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                }
            });
        }

    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
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
