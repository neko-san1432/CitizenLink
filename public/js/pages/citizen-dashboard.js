/**
 * Enhanced Citizen Dashboard
 * Comprehensive citizen engagement and complaint management
 */

import showMessage from '../components/toast.js';
import { initializeRoleToggle } from '../auth/roleToggle.js';

// Citizen dashboard script loaded

// Dashboard state
let dashboardData = null;

/**
 * Initialize dashboard
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  await loadMyComplaints();
  await loadStatistics();
  setupEventListeners();
  
  // Initialize role switcher for staff members
  try {
    await initializeRoleToggle();
  } catch (error) {
    console.error('[CITIZEN_DASHBOARD] Error initializing role toggle:', error);
  }
});

/**
 * Load dashboard data
 */
async function loadDashboardData() {
  try {
    // Load news, notices, and events
    await Promise.all([
      loadNews(),
      loadNotices(),
      loadEvents()
    ]);
  } catch (error) {
    console.error('[CITIZEN] Load dashboard error:', error);
    showMessage('error', 'Failed to load dashboard data');
  }
}

/**
 * Load my complaints
 */
async function loadMyComplaints() {
  try {
    const response = await fetch('/api/complaints/my?limit=5');
    const result = await response.json();

    if (result.success) {
      renderMyComplaints(result.data || []);
    } else {
      renderMyComplaints([]);
    }
  } catch (error) {
    console.error('[CITIZEN] Load complaints error:', error);
    renderMyComplaints([]);
  }
}

/**
 * Load statistics
 */
async function loadStatistics() {
  try {
    const response = await fetch('/api/complaints/my-statistics');
    const result = await response.json();

    if (result.success) {
      renderStatistics(result.data);
    } else {
      renderStatistics({});
    }
  } catch (error) {
    console.error('[CITIZEN] Load statistics error:', error);
    renderStatistics({});
  }
}

/**
 * Load news
 */
async function loadNews() {
  try {
    const response = await fetch('/api/content/news?limit=3');
    const result = await response.json();

    if (result.success) {
      renderNews(result.data || []);
    }
  } catch (error) {
    console.error('[CITIZEN] Load news error:', error);
  }
}

/**
 * Load notices
 */
async function loadNotices() {
  try {
    const response = await fetch('/api/content/notices?limit=3');
    const result = await response.json();

    if (result.success) {
      renderNotices(result.data || []);
    }
  } catch (error) {
    console.error('[CITIZEN] Load notices error:', error);
  }
}

/**
 * Load events
 */
async function loadEvents() {
  try {
    const response = await fetch('/api/content/events?limit=3');
    const result = await response.json();

    if (result.success) {
      renderEvents(result.data || []);
    }
  } catch (error) {
    console.error('[CITIZEN] Load events error:', error);
  }
}

/**
 * Render my complaints
 */
function renderMyComplaints(complaints) {
  const container = document.getElementById('my-complaints-container');
  if (!container) return;

  if (complaints.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <h3>No Complaints Yet</h3>
        <p>You haven't filed any complaints yet. Click "File Complaint" to get started!</p>
        <a href="/citizen/fileComplaint" class="btn btn-primary">File Your First Complaint</a>
      </div>
    `;
    return;
  }

  const html = complaints.map(complaint => `
    <div class="complaint-item" onclick="viewComplaintDetail('${complaint.id}')">
      <div class="complaint-header">
        <h4 class="complaint-title">${escapeHtml(complaint.title)}</h4>
        <span class="complaint-status status-${complaint.status}">${complaint.status}</span>
      </div>
      <div class="complaint-meta">
        <span class="complaint-type">${escapeHtml(complaint.type || complaint.category)}</span>
        <span class="complaint-date">${formatDate(complaint.submitted_at)}</span>
      </div>
      <div class="complaint-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${getProgressWidth(complaint.status)}%"></div>
        </div>
        <span class="progress-text">${getProgressText(complaint.status)}</span>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

/**
 * Render statistics
 */
function renderStatistics(stats) {
  document.getElementById('stat-total-filed').textContent = stats.total_filed || 0;
  document.getElementById('stat-pending').textContent = stats.pending || 0;
  document.getElementById('stat-resolved').textContent = stats.resolved || 0;
  document.getElementById('stat-success-rate').textContent = stats.success_rate || '0%';
}

/**
 * Render news
 */
function renderNews(news) {
  const container = document.getElementById('news-container');
  if (!container) return;

  if (news.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📰</div>
        <p>No news available at the moment.</p>
      </div>
    `;
    return;
  }

  const html = news.map(item => `
    <div class="news-item">
      <div class="news-image">${getNewsIcon(item.category)}</div>
      <div class="news-content">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.excerpt || item.content?.substring(0, 100) + '...')}</p>
        <div class="news-meta">${formatDate(item.created_at)}</div>
      </div>
    </div>
  `).join('');

  container.querySelector('.news-list').innerHTML = html;
}

/**
 * Render notices
 */
function renderNotices(notices) {
  const container = document.getElementById('notices-container');
  if (!container) return;

  if (notices.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📢</div>
        <p>No notices available at the moment.</p>
      </div>
    `;
    return;
  }

  const html = notices.map(notice => `
    <div class="notice-item ${notice.priority === 'urgent' ? 'urgent' : ''}">
      <div class="notice-icon">${getNoticeIcon(notice.priority)}</div>
      <div class="notice-content">
        <h4>${escapeHtml(notice.title)}</h4>
        <p>${escapeHtml(notice.content?.substring(0, 100) + '...')}</p>
        <div class="notice-meta">${formatDate(notice.created_at)}</div>
      </div>
    </div>
  `).join('');

  container.querySelector('.notices-list').innerHTML = html;
}

/**
 * Render events
 */
function renderEvents(events) {
  const container = document.getElementById('events-container');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p>No upcoming events at the moment.</p>
      </div>
    `;
    return;
  }

  const html = events.map(event => {
    const eventDate = new Date(event.event_date);
    return `
      <div class="event-item">
        <div class="event-date">
          <div class="event-day">${eventDate.getDate()}</div>
          <div class="event-month">${eventDate.toLocaleDateString('en-US', { month: 'short' })}</div>
        </div>
        <div class="event-content">
          <h4>${escapeHtml(event.title)}</h4>
          <p>${escapeHtml(event.description?.substring(0, 80) + '...')}</p>
          <div class="event-meta">${formatEventTime(event.event_date)}</div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelector('.events-list').innerHTML = html;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Add any additional event listeners here
}

/**
 * Helper functions
 */
function getProgressWidth(status) {
  const progressMap = {
    'submitted': 25,
    'under_review': 50,
    'in_progress': 75,
    'resolved': 100,
    'closed': 100
  };
  return progressMap[status] || 0;
}

function getProgressText(status) {
  const textMap = {
    'submitted': 'Submitted',
    'under_review': 'Under Review',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed'
  };
  return textMap[status] || 'Unknown';
}

function getNewsIcon(category) {
  const iconMap = {
    'general': '📰',
    'health': '🏥',
    'infrastructure': '🏗️',
    'education': '🎓',
    'safety': '🛡️'
  };
  return iconMap[category] || '📰';
}

function getNoticeIcon(priority) {
  const iconMap = {
    'urgent': '⚠️',
    'important': '📢',
    'general': '📅',
    'info': 'ℹ️'
  };
  return iconMap[priority] || '📢';
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

function formatEventTime(dateString) {
  if (!dateString) return 'TBD';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Global functions for onclick handlers
 */
window.viewMyComplaints = function() {
  showMessage('info', 'Redirecting to complaints page...');
  // TODO: Implement complaints page navigation
};

window.viewStatus = function() {
  showMessage('info', 'Status check feature coming soon');
  // TODO: Implement status check modal
};

window.viewMap = function() {
  window.location.href = '/heatmap';
};

window.getHelp = function() {
  showMessage('info', 'Help section coming soon');
  // TODO: Implement help modal or page
};

window.viewAllComplaints = function() {
  showMessage('info', 'Redirecting to all complaints...');
  // TODO: Implement all complaints page
};

window.viewComplaintDetail = function(complaintId) {
  window.location.href = `/complaint-details?id=${complaintId}`;
};

window.refreshNews = async function() {
  showMessage('info', 'Refreshing news...');
  await loadNews();
  showMessage('success', 'News refreshed');
};

window.refreshNotices = async function() {
  showMessage('info', 'Refreshing notices...');
  await loadNotices();
  showMessage('success', 'Notices refreshed');
};

window.refreshEvents = async function() {
  showMessage('info', 'Refreshing events...');
  await loadEvents();
  showMessage('success', 'Events refreshed');
};