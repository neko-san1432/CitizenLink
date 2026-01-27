/**
 * DRIMS Analytics Client v2.0
 * Connects to Node.js Backend API
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Analytics] Initializing Client...');

    try {
        await loadAnalyticsData();
        setupEventListeners();
        hideLoading();
    } catch (error) {
        console.error('[Analytics] Init Error:', error);
        alert('Failed to load analytics: ' + error.message);
        hideLoading();
    }
});

let charts = {};

async function loadAnalyticsData() {
    // Determine user role (placeholder logic, usually from meta tag or auth endpoint)
    // For now, we assume we can hit the coordinator endpoint if permitted
    const response = await fetch('/api/analytics/insights/coordinator');
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    const data = result.data;
    renderDashboard(data);
}

function renderDashboard(data) {
    // 1. Narrative
    document.getElementById('narrativeText').innerHTML = data.narrative || 'No analysis available.';

    // 2. Metrics
    const stats = data.stats;
    document.getElementById('totalComplaints').textContent = stats.volume || 0;
    document.getElementById('criticalCount').textContent = stats.critical_count || 0;
    document.getElementById('resolutionRate').textContent = (stats.resolution_rate || 0) + '%';
    document.getElementById('activeClusters').textContent = data.clusters ? data.clusters.length : 0;

    // 3. Charts
    renderTrendChart(data.charts.trend);
    renderCategoryChart(data.charts.category);
    renderDailyVolumeChart(data.charts.trend); // Reuse trend for daily volume
    renderCategoryPieChart(data.charts.category);

    // 4. Clusters Table
    renderClustersTable(data.clusters);

    // 5. Data Table (Placeholder for now, using partial data)
    // In real implementation this should use a separate paginated API
}

function renderTrendChart(trendData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    if (charts.trend) charts.trend.destroy();

    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.labels,
            datasets: [{
                label: 'Complaints',
                data: trendData.data,
                borderColor: '#4472C4',
                backgroundColor: 'rgba(68, 114, 196, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderCategoryChart(catData) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (charts.category) charts.category.destroy();

    charts.category = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: catData.labels,
            datasets: [{
                label: 'Volume',
                data: catData.data,
                backgroundColor: ['#4472C4', '#FFC000', '#A5A5A5', '#70AD47', '#5B9BD5']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderDailyVolumeChart(trendData) {
    const ctx = document.getElementById('dailyVolumeChart').getContext('2d');
    if (charts.daily) charts.daily.destroy();

    charts.daily = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: trendData.labels,
            datasets: [{
                label: 'Daily Submissions',
                data: trendData.data,
                backgroundColor: '#70AD47'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderCategoryPieChart(catData) {
    const ctx = document.getElementById('categoryPieChart').getContext('2d');
    if (charts.pie) charts.pie.destroy();

    charts.pie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: catData.labels,
            datasets: [{
                data: catData.data,
                backgroundColor: ['#4472C4', '#FFC000', '#A5A5A5', '#70AD47', '#5B9BD5']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderClustersTable(clusters) {
    const tbody = document.getElementById('clustersTableBody');
    tbody.innerHTML = '';

    if (!clusters || clusters.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No active clusters detected</td></tr>';
        return;
    }

    clusters.forEach(c => {
        const row = `
            <tr>
                <td>${c.id}</td>
                <td><strong>${c.category}</strong></td>
                <td>${c.size} reports</td>
                <td>${c.urgency_avg}/100</td>
                <td>${c.center.lat.toFixed(4)}, ${c.center.lng.toFixed(4)}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Export Buttons
    document.getElementById('exportPDF').addEventListener('click', () => {
        window.open('/api/analytics/export/pdf?type=executive', '_blank');
    });

    document.getElementById('exportCSV').addEventListener('click', () => {
        window.open('/api/analytics/export/csv', '_blank');
    });
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}
