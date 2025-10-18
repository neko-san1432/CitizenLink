// Import Chart.js using script tag approach
// Chart will be available globally after script loads

// Chart.js configuration and utilities
class ChartManager {
  constructor() {
    this.charts = {};
    this.colors = {
      primary: '#3B82F6',
      secondary: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#8B5CF6',
      success: '#059669',
      gray: '#6B7280'
    };

    this.chartColors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#059669', '#F97316', '#06B6D4',
      '#84CC16', '#EC4899', '#6366F1', '#14B8A6'
    ];
  }

  // Initialize all charts when DOM is loaded
  init() {
    this.createComplaintsChart();
    this.createDepartmentChart();
    this.createStatusChart();
    this.createPriorityChart();
  }

  // Line Chart - Complaints over time
  createComplaintsChart() {
    const ctx = document.getElementById('complaintsChart');
    if (!ctx) return;

    const data = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Complaints Received',
        data: [12, 19, 15, 25, 22, 30, 28, 35, 32, 28, 24, 31],
        borderColor: this.colors.primary,
        backgroundColor: this.colors.primary + '20',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: this.colors.primary,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }, {
        label: 'Complaints Resolved',
        data: [8, 15, 12, 20, 18, 25, 23, 28, 26, 22, 19, 25],
        borderColor: this.colors.success,
        backgroundColor: this.colors.success + '20',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: this.colors.success,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    };

    const config = {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Monthly Complaint Trends',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 12
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#E5E7EB'
            },
            ticks: {
              font: {
                size: 12
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    };

    this.charts.complaints = new Chart(ctx, config);
  }

  // Bar Chart - Complaints by department
  createDepartmentChart() {
    const ctx = document.getElementById('departmentChart');
    if (!ctx) return;

    const data = {
      labels: ['Public Works', 'Police', 'Health', 'Environment', 'Traffic', 'Mayor\'s Office'],
      datasets: [{
        label: 'Complaints',
        data: [45, 32, 28, 19, 15, 12],
        backgroundColor: this.chartColors.slice(0, 6),
        borderColor: this.chartColors.slice(0, 6),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false
      }]
    };

    const config = {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Complaints by Department',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 11
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#E5E7EB'
            },
            ticks: {
              font: {
                size: 12
              }
            }
          }
        }
      }
    };

    this.charts.department = new Chart(ctx, config);
  }

  // Pie Chart - Complaint status distribution
  createStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    const data = {
      labels: ['Pending', 'In Progress', 'Resolved', 'Closed'],
      datasets: [{
        data: [35, 25, 30, 10],
        backgroundColor: [
          this.colors.warning,
          this.colors.info,
          this.colors.success,
          this.colors.gray
        ],
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 4
      }]
    };

    const config = {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Complaint Status Distribution',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          }
        }
      }
    };

    this.charts.status = new Chart(ctx, config);
  }

  // Doughnut Chart - Priority levels
  createPriorityChart() {
    const ctx = document.getElementById('priorityChart');
    if (!ctx) return;

    const data = {
      labels: ['High', 'Medium', 'Low'],
      datasets: [{
        data: [15, 60, 25],
        backgroundColor: [
          this.colors.danger,
          this.colors.warning,
          this.colors.success
        ],
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 8
      }]
    };

    const config = {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Priority Level Distribution',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          }
        },
        cutout: '60%'
      }
    };

    this.charts.priority = new Chart(ctx, config);
  }

  // Update chart data dynamically
  updateChart(chartName, newData) {
    if (this.charts[chartName]) {
      this.charts[chartName].data = newData;
      this.charts[chartName].update();
    }
  }

  // Destroy all charts
  destroyAll() {
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.charts = {};
  }

  // Export chart as image
  exportChart(chartName, format = 'png') {
    if (this.charts[chartName]) {
      const link = document.createElement('a');
      link.download = `${chartName}-chart.${format}`;
      link.href = this.charts[chartName].toBase64Image();
      link.click();
    }
  }
}

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const chartManager = new ChartManager();
  chartManager.init();

  // Make chartManager globally available for debugging
  window.chartManager = chartManager;
});

// ChartManager is available globally as window.chartManager
