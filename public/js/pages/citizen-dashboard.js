/**
 * Enhanced Citizen Dashboard
 * Comprehensive citizen engagement and complaint management
 */
import showMessage from '../components/toast.js';
import { initializeRoleToggle } from '../auth/roleToggle.js';

// Priority scoring system
const PRIORITY_SCORES = {
  urgent: 4,
  high: 3,
  medium: 2,
  normal: 1,
  low: 0
};
// Content type icons
const CONTENT_TYPE_ICONS = {
  notice: '📢',
  news: '📰',
  event: '📅'
};
class ContentBannerManager {

  constructor() {
    // Separate queues for each content type
    this.queues = {
      notice: [],
      news: [],
      event: []
    };
    // Current index for each content type
    this.currentIndices = {
      notice: 0,
      news: 0,
      event: 0
    };
    this.scrollInterval = null;
    this.fetchInterval = null;
    this.displayDuration = 20000; // 20 seconds
    this.fetchIntervalMs = 30000; // Fetch new content every 30 seconds
    // Track currently displayed items to avoid unnecessary updates
    this.currentlyDisplayed = {
      notice: null,
      news: null,
      event: null
    };
    this.init();
  }
  async init() {
    // Load initial content
    await this.fetchLatestContent();
    // Set up periodic fetching (no automatic rotation)
    this.fetchInterval = setInterval(() => {
      this.fetchLatestContent();
    }, this.fetchIntervalMs);
    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.fetchLatestContent();
      }
    });
  }
  // Priority scoring function
  getPriorityScore(item) {
    const priority = item.priority || 'normal';
    return PRIORITY_SCORES[priority.toLowerCase()] || PRIORITY_SCORES.normal;
  }
  // Compare function for sorting - prioritize latest items first, then by priority
  compareItems(a, b) {
    // First sort by date (newest first)
    const dateA = new Date(a.created_at || a.published_at || a.event_date || 0);
    const dateB = new Date(b.created_at || b.published_at || b.event_date || 0);
    const dateDiff = dateB - dateA; // Newer dates first (positive if B is newer)
    // Always prioritize newest first - if dates differ significantly, use date
    // Only use priority as tie-breaker for items created on the same day
    const oneDay = 24 * 60 * 60 * 1000;
    if (Math.abs(dateDiff) > oneDay) {
      // More than 1 day difference - newest always wins
      return dateDiff;
    }
    // Same day or very close - check priority for urgent items
    // But still prefer newer if there's any date difference
    const scoreA = this.getPriorityScore(a);
    const scoreB = this.getPriorityScore(b);

    // If one is urgent and other is not, and dates are same day, prioritize urgent
    if (Math.abs(dateDiff) <= oneDay && scoreA !== scoreB) {
      // If urgent (score 4), it can override same-day items
      if (scoreA === PRIORITY_SCORES.urgent && scoreB < PRIORITY_SCORES.urgent) {
        return -1; // A (urgent) comes first
      }
      if (scoreB === PRIORITY_SCORES.urgent && scoreA < PRIORITY_SCORES.urgent) {
        return 1; // B (urgent) comes first
      }
      // For non-urgent priorities, still prefer newer
      return dateDiff;
    }

    // Same priority or not urgent, newest first
    return dateDiff;
  }

  // Add item to queue with priority-based insertion
  addToQueue(newItem) {
    const contentType = newItem.content_type;
    if (!this.queues[contentType]) return;

    const queue = this.queues[contentType];
    const currentIndex = this.currentIndices[contentType];
    const newScore = this.getPriorityScore(newItem);

    // Check if item already exists (avoid duplicates)
    const exists = queue.some(item => item.id === newItem.id);
    if (exists) return;

    // If queue is empty, just add it
    if (queue.length === 0) {
      queue.push(newItem);
      this.currentIndices[contentType] = 0;
      return;
    }

    const currentDisplaying = queue[currentIndex];
    const currentScore = currentDisplaying ? this.getPriorityScore(currentDisplaying) : 0;

    // If urgent and higher than current, replace current immediately
    if (newScore === PRIORITY_SCORES.urgent && newScore > currentScore) {
      // Save current item to re-insert later
      const currentItem = currentDisplaying;

      // Remove current item temporarily
      if (currentItem) {
        queue.splice(currentIndex, 1);
      }

      // Insert urgent item at current position
      queue.splice(currentIndex, 0, newItem);

      // Re-insert current item after urgent (maintain position)
      if (currentItem && queue.length > currentIndex + 1) {
        queue.splice(currentIndex + 1, 0, currentItem);
      } else if (currentItem) {
        // If queue was empty, just add it
        queue.push(currentItem);
      }

      // Keep current index pointing to urgent item
      this.currentIndices[contentType] = currentIndex;
      this.updateDisplay();
      return;
    }

    // If high priority, insert right after current item
    if (newScore === PRIORITY_SCORES.high && currentDisplaying) {
      const insertIndex = (currentIndex + 1) % (queue.length + 1);
      queue.splice(insertIndex, 0, newItem);
      return;
    }

    // Normal insertion with priority sorting
    const insertIndex = this.findInsertPosition(queue, newItem, newScore);
    queue.splice(insertIndex, 0, newItem);

    // Adjust current index if item was inserted before it
    if (insertIndex <= currentIndex) {
      this.currentIndices[contentType] = currentIndex + 1;
    }
  }

  // Find position to insert item based on priority
  findInsertPosition(queue, item, score) {
    if (queue.length === 0) return 0;

    for (let i = 0; i < queue.length; i++) {
      const itemScore = this.getPriorityScore(queue[i]);
      if (score > itemScore) {
        return i;
      } else if (score === itemScore) {
        // Same priority, check date (newer first)
        const itemDate = new Date(queue[i].created_at || queue[i].published_at || queue[i].event_date || 0);
        const newDate = new Date(item.created_at || item.published_at || item.event_date || 0);
        if (newDate < itemDate) {
          return i;
        }
      }
    }

    return queue.length;
  }

  // Fetch latest content from all types
  async fetchLatestContent() {
    try {
      const [noticesRes, newsRes, eventsRes] = await Promise.all([
        fetch('/api/content/notices?limit=10&status=active'),
        fetch('/api/content/news?limit=10&status=published'),
        fetch('/api/content/events?limit=10&status=upcoming')
      ]);
      const [noticesData, newsData, eventsData] = await Promise.all([
        noticesRes.json(),
        newsRes.json(),
        eventsRes.json()
      ]);
      const allContent = [];
      // Process notices
      if (noticesData.success && noticesData.data) {
        noticesData.data.forEach(notice => {
          allContent.push({
            ...notice,
            content_type: 'notice',
            display_title: notice.title,
            display_date: notice.created_at || notice.valid_from
          });
        });
      }
      // Process news
      if (newsData.success && newsData.data) {
        newsData.data.forEach(news => {
          allContent.push({
            ...news,
            content_type: 'news',
            display_title: news.title,
            display_date: news.published_at || news.created_at,
            priority: 'normal' // News default priority
          });
        });
      }
      // Process events
      if (eventsData.success && eventsData.data) {
        eventsData.data.forEach(event => {
          allContent.push({
            ...event,
            content_type: 'event',
            display_title: event.title,
            display_date: event.event_date || event.created_at,
            priority: 'normal' // Events default priority
          });
        });
      }
      // Add all items to their respective queues with priority handling
      allContent.forEach(item => {
        this.addToQueue(item);
      });
      // Sort each queue by latest first (newest date, then priority)
      Object.keys(this.queues).forEach(contentType => {
        this.queues[contentType].sort((a, b) => this.compareItems(a, b));
        // Ensure latest item is at index 0
        this.currentIndices[contentType] = 0;
      });
      // Check if content has changed and update only if different
      const hasContent = Object.values(this.queues).some(queue => queue.length > 0);
      if (hasContent) {
        // Check if displayed items have changed before updating
        if (this.hasContentChanged()) {
          // Only update if content has changed (prevents unnecessary transitions/blinking)
          this.updateDisplay();
        }
      } else {
        // If no content, clear tracked items
        this.currentlyDisplayed = {
          notice: null,
          news: null,
          event: null
        };
      }
      // Show banner if we have content
      const banner = document.getElementById('content-banner');
      if (banner) {

        if (hasContent) {
          banner.style.display = 'block';
        } else {
          banner.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Error fetching content:', error);
    }
  }
  // Check if the currently displayed content has changed
  hasContentChanged() {
    let changed = false;
    ['notice', 'news', 'event'].forEach(contentType => {
      const queue = this.queues[contentType];
      const currentIndex = this.currentIndices[contentType];
      if (queue.length > 0) {
        const index = currentIndex % queue.length;
        const currentItem = queue[index];
        const currentlyDisplayedItem = this.currentlyDisplayed[contentType];
        // Check if item has changed (different ID or new item)
        if (!currentlyDisplayedItem || currentlyDisplayedItem.id !== currentItem.id) {
          changed = true;
        }
      } else {
        // If queue is empty but we had content before, it changed
        if (this.currentlyDisplayed[contentType] !== null) {
          changed = true;
        }
      }
    });
    return changed;
  }
  // Update the display with current items from each type's queue
  // Only called when content has actually changed
  updateDisplay() {
    const track = document.querySelector('.content-banner-track');
    if (!track) return;
    // Get current item for each content type from their respective queues
    const itemsToShow = [];
    ['notice', 'news', 'event'].forEach(contentType => {
      const queue = this.queues[contentType];
      const currentIndex = this.currentIndices[contentType];
      if (queue.length > 0) {
        // Get item at current index (with wrap-around)
        const index = currentIndex % queue.length;
        const item = queue[index];
        itemsToShow.push(item);
        // Track this item as currently displayed
        this.currentlyDisplayed[contentType] = item;
      } else {
        this.currentlyDisplayed[contentType] = null;
      }
    });
    // If no items to show, hide banner
    if (itemsToShow.length === 0) {
      const banner = document.getElementById('content-banner');
      if (banner) {
        banner.style.display = 'none';
      }
      return;
    }
    // Create content items HTML
    let itemHTML = '';
    itemsToShow.forEach((item, idx) => {
      // Determine badge based on content type
      let badge = '';
      if (item.content_type === 'event') {
        badge = '<span class="content-badge">[Event]</span>';
      } else if (item.content_type === 'news') {
        badge = '<span class="content-badge">[News]</span>';
      } else if (item.content_type === 'notice') {
        badge = '<span class="content-badge">[Announcement]</span>';
      }
      const itemClass = item.content_type === 'news' ?
        'content-banner-item active news-item' :
        'content-banner-item active';
      itemHTML += `
        <div class="${itemClass}">
          <span class="content-icon">${CONTENT_TYPE_ICONS[item.content_type] || '📢'}</span>
          ${badge}
          <span class="content-text">${this.escapeHtml(item.display_title || item.title)}</span>
        </div>
      `;
    });
    track.innerHTML = itemHTML;
    // Add click handlers to navigate to content
    track.querySelectorAll('.content-banner-item').forEach((itemElement, idx) => {
      const item = itemsToShow[idx];
      itemElement.style.cursor = 'pointer';
      itemElement.addEventListener('click', () => {
        this.navigateToContent(item);
      });
    });
  }
  // Navigate to content detail page
  navigateToContent(item) {
    let url = '';
    switch (item.content_type) {
      case 'notice':
        url = `/publication#notices-${item.id}`;
        break;
      case 'news':
        url = `/publication#news-${item.id}`;
        break;
      case 'event':
        url = `/publication#events-${item.id}`;
        break;
      default:
        url = '/publication';
    }
    window.location.href = url;
  }
  // Sort queues and update display only if content changed
  sortAndUpdate() {
    // Sort all queues by latest first (newest date, then priority)
    Object.keys(this.queues).forEach(contentType => {
      this.queues[contentType].sort((a, b) => this.compareItems(a, b));
      // Reset index to 0 to show the latest item first
      this.currentIndices[contentType] = 0;
    });
    // Check if content has changed before updating
    if (this.hasContentChanged()) {
      this.updateDisplay();
    }
  }
  // Cleanup
  destroy() {

    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
    }
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
    }
  }
  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
// Initialize on page load
let bannerManager;
/**
 * Initialize dashboard
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize content banner manager
  bannerManager = new ContentBannerManager();
  // Load complaints
  await loadMyComplaints();
  // Initialize role switcher for staff members
  try {
    await initializeRoleToggle();
  } catch (error) {
    console.error('[CITIZEN_DASHBOARD] Error initializing role toggle:', error);
  }
  
  // Attach event listeners to buttons (replacing inline onclick handlers)
  const viewMapBtn = document.getElementById('view-map-btn');
  if (viewMapBtn) {
    viewMapBtn.addEventListener('click', () => {
      window.viewMap();
    });
  }
  
  
  const viewAllComplaintsBtn = document.getElementById('view-all-complaints-btn');
  if (viewAllComplaintsBtn) {
    viewAllComplaintsBtn.addEventListener('click', () => {
      window.viewAllComplaints();
    });
  }
});
// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (bannerManager) {
    bannerManager.destroy();
  }
});
/**
 * Load my complaints
 */
async function loadMyComplaints() {
  const container = document.getElementById('my-complaints-container');
  if (!container) {
    console.error('[CITIZEN_DASHBOARD] Container not found: my-complaints-container');
    return;
  }
  
  // Check if user has a session before making API call
  try {
    const { supabase } = await import('../config/config.js');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // No session, show message and stop
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔒</div>
          <h3>Please Log In</h3>
          <p>You need to be logged in to view your complaints.</p>
          <a href="/login" class="btn btn-primary">Go to Login</a>
        </div>
      `;
      return;
    }
  } catch (error) {
    // If we can't check session, continue but handle 401 gracefully
  }
  
  // Show loading state
  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading your complaints...</p>
    </div>
  `;
  try {
    const response = await fetch('/api/complaints/my?limit=20', {
      credentials: 'include'
    });
    if (!response.ok) {
      // Handle 401 gracefully - redirect to login page (not HTTPS)
      if (response.status === 401) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔒</div>
            <h3>Session Expired</h3>
            <p>Your session has expired. Please log in again.</p>
            <a href="/login" class="btn btn-primary">Go to Login</a>
          </div>
        `;
        return;
      }
      throw new Error(`Failed to load complaints: ${response.status}`);
    }
    const result = await response.json();
    console.debug('[CITIZEN_DASHBOARD] Complaints fetch summary', {
      success: result.success,
      complaintsCount: result.data?.length || 0,
      total: result.pagination?.total || 0,
      page: result.pagination?.page,
      totalPages: result.pagination?.totalPages,
      data: result.data?.map(c => ({
        id: c.id,
        title: c.title,
        status: c.workflow_status,
        is_duplicate: c.is_duplicate,
        cancelled_at: c.cancelled_at
      }))
    });
    if (result.success) {
      const totalComplaints = result.pagination?.total || result.data?.length || 0;
      renderMyComplaints(result.data || [], totalComplaints);
    } else {
      console.error('[CITIZEN_DASHBOARD] Failed to load complaints:', result.error);
      renderMyComplaints([], 0);
    }
  } catch (error) {
    // Handle network errors gracefully
    if (error.message && error.message.includes('Failed to fetch')) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Connection Error</h3>
          <p>Unable to connect to the server. Please check your internet connection and try again.</p>
        </div>
      `;
    } else {
      console.error('[CITIZEN_DASHBOARD] Load complaints error:', error);
      showMessage('error', 'Failed to load complaints. Please try again.');
      renderMyComplaints([], 0);
    }
  }
}
/**
 * Render my complaints
 */
function renderMyComplaints(complaints, totalCount = null) {
  const container = document.getElementById('my-complaints-container');
  if (!container) {
    console.error('[CITIZEN_DASHBOARD] Container not found: my-complaints-container');
    return;
  }
  console.debug('[CITIZEN_DASHBOARD] Render complaints inputs', {
    count: complaints.length,
    totalCount,
    complaints: complaints.map(c => ({
      id: c.id,
      title: c.title,
      status: c.workflow_status || c.status,
      submitted_at: c.submitted_at
    }))
  });
  if (complaints.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <h3>No Complaints Yet</h3>
        <p>You haven't filed any complaints yet. Click "File Complaint" to get started!</p>
        <a href="/fileComplaint" class="btn btn-primary">File Your First Complaint</a>
      </div>
    `;
    return;
  }
  // Show total count if available and different from displayed count
  let countInfo = '';
  if (totalCount !== null && totalCount > complaints.length) {
    countInfo = `<div class="complaints-count-info" style="margin-bottom: 1rem; color: #6b7280; font-size: 0.875rem;">
      Showing ${complaints.length} of ${totalCount} complaints
    </div>`;
  }

  // Filter out duplicate and cancelled complaints for display (but show them in count)
  const filteredComplaints = complaints.filter(complaint => {
    // Don't filter - show all complaints including duplicates and cancelled
    // The user might want to see them
    return true;
  });


  console.debug('[CITIZEN_DASHBOARD] Render complaints derived metrics', {
    total: complaints.length,
    filtered: filteredComplaints.length,
    duplicates: complaints.filter(c => c.is_duplicate).length,
    cancelled: complaints.filter(c => c.cancelled_at).length
  });

  const html = filteredComplaints.map(complaint => {
    const status = complaint.workflow_status || complaint.status || 'new';
    const statusClass = status.toLowerCase().replace(/[_\s]/g, '-');
    const statusLabel = formatStatus(status);

    // Add visual indicator for duplicates and cancelled
    let statusBadge = '';
    if (complaint.is_duplicate) {
      statusBadge = '<span style="font-size: 0.7rem; color: #f59e0b; margin-left: 0.5rem;">(Duplicate)</span>';
    }
    if (complaint.cancelled_at) {
      statusBadge = '<span style="font-size: 0.7rem; color: #ef4444; margin-left: 0.5rem;">(Cancelled)</span>';
    }
    return `
    <div class="complaint-item" data-complaint-id="${escapeHtml(complaint.id)}">
      <div class="complaint-header">
        <h4 class="complaint-title">${escapeHtml(complaint.title)}${statusBadge}</h4>
        <span class="complaint-status status-${statusClass}">${statusLabel}</span>
      </div>
      <div class="complaint-meta">
        <span class="complaint-id" style="font-size: 0.75rem; color: #9ca3af;">${complaint.id.substring(0, 8)}...</span>
        <span class="complaint-type">${escapeHtml(complaint.type || complaint.category || 'N/A')}</span>
        <span class="complaint-date">${formatDate(complaint.submitted_at)}</span>
      </div>
      <div class="complaint-progress">
        ${renderCompactStepper(status, complaint.confirmed_by_citizen)}
        <span class="progress-text">${getProgressText(status)}</span>
      </div>
    </div>
  `;
  }).join('');
  container.innerHTML = countInfo + html;
  
  // Attach event listeners to complaint items using event delegation
  container.querySelectorAll('.complaint-item').forEach(item => {
    item.addEventListener('click', () => {
      const complaintId = item.getAttribute('data-complaint-id');
      if (complaintId) {
        window.viewComplaintDetail(complaintId);
      }
    });
  });
}
/**
 * Helper functions
 */
function formatStatus(status) {
  if (!status) return 'New';
  return status.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}
function renderCompactStepper(status, confirmedByCitizen = false) {
  // Map workflow status to step number (0-4, with 5 as cancelled)
  const workflowStatus = (status || 'new').toLowerCase();
  const isCancelled = workflowStatus === 'cancelled';
  const statusStepMap = {
    'new': 0,
    'assigned': 1,
    'in_progress': 2,
    'pending_approval': 3,
    'completed': 3, // Step 3: awaiting citizen confirmation, not fully completed yet
    'submitted': 0,
    'under_review': 1,
    'resolved': 3,
    'waiting_for_responders': 3,
    'waiting_for_complainant': 3,
    'confirmed': 4, // Step 4: citizen confirmed, fully completed
    'closed': 4
  };
  // For cancelled complaints, don't show any active steps - gray everything out
  // Otherwise, show progress up to the current step
  let currentStep = isCancelled ? -1 : (statusStepMap[workflowStatus] !== undefined ? statusStepMap[workflowStatus] : 0);

  // If citizen has confirmed, show step 4 (all circles completed) even if status is still 'completed'
  if (!isCancelled && confirmedByCitizen && (workflowStatus === 'completed' || workflowStatus === 'resolved')) {
    currentStep = 4;
  }

  // Node colors for each step (orange → red → pink → purple)
  const nodeColors = [
    '#3b82f6',
    '#3b82f6',
    '#3b82f6',
    '#3b82f6',
    '#3b82f6'
  ];
  // Build compact stepper HTML
  let stepperHTML = '<div class="compact-stepper-container">';
  for (let i = 0; i < 5; i++) {
    // If cancelled, all steps are inactive (grayed out)
    // Otherwise, active steps are those up to currentStep (0-4)
    const isActive = isCancelled ? false : (i <= currentStep && i < 5);
    // Get node color - if cancelled, everything is grey
    const nodeColor = isCancelled ? '#9ca3af' : (isActive ? nodeColors[i] : '#9ca3af');
    // Determine connector line style
    let connectorStyle = '';
    if (i < 4) {
      // If cancelled, all connectors are grey
      // Otherwise, color connector through the current step as well (continuous bar effect)
      const isConnectorActive = isCancelled ? false : (i <= currentStep);
      if (isConnectorActive) {
        // Active connector solid blue
        connectorStyle = '#3b82f6';
      } else {
        connectorStyle = '#e5e7eb';
      }
    }
    // No glow/box-shadow for nodes
    const boxShadow = 'none';
    stepperHTML += `
      <div class="compact-stepper-step ${isActive ? 'active' : ''}">
        <div class="compact-stepper-node" style="background-color: ${nodeColor}; box-shadow: ${boxShadow};"></div>
        ${i < 4 ? `
        <div class="compact-stepper-connector" style="background: ${connectorStyle};"></div>
        ` : ''}
      </div>
    `;
  }
  stepperHTML += '</div>';
  // Labels row under the stepper, aligned with nodes
  const stepLabels = ['New','Assigned','In Progress','Pending Approval','Completed'];
  stepperHTML += '<div class="compact-stepper-labels">';
  for (let i = 0; i < 5; i++) {
    const isActive = !isCancelled && i <= currentStep;
    stepperHTML += `
      <div class="compact-stepper-label-item ${isActive ? 'active' : ''}">${stepLabels[i]}</div>
    `;
  }
  stepperHTML += '</div>';
  return stepperHTML;
}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}
function getProgressWidth(status) {
  // Deprecated - keeping for backward compatibility if needed elsewhere
  const progressMap = {
    'new': 20,
    'assigned': 40,
    'in_progress': 75,
    'pending_approval': 85,
    'completed': 100,
    'cancelled': 0,
    'submitted': 25,
    'under_review': 50,
    'resolved': 90,
    'waiting_for_responders': 90,
    'waiting_for_complainant': 90,
    'confirmed': 100,
    'closed': 100
  };
  return progressMap[status] || 20;
}
function getProgressText(status) {
  const textMap = {
    'new': 'New Complaint',
    'assigned': 'Assigned to Coordinator',
    'in_progress': 'Being Processed by Officers',
    'pending_approval': 'Pending Approval',
    'completed': 'Completed - Awaiting Your Confirmation',
    'cancelled': 'Cancelled',
    'submitted': 'Submitted',
    'under_review': 'Under Review',
    'resolved': 'Resolved',
    'closed': 'Closed',
    'waiting_for_responders': 'Waiting for responders\' confirmation',
    'waiting_for_complainant': 'Waiting for your confirmation',
    'confirmed': 'Confirmed by you - Resolution Complete'
  };
  return textMap[status] || 'Unknown';
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
  window.location.href = '/myProfile#complaints';
};
window.viewMap = function() {
  window.location.href = '/heatmap';
};
window.viewAllComplaints = function() {
  window.location.href = '/myProfile#complaints';
};
window.viewComplaintDetail = function(complaintId) {
  window.location.href = `/complaint-details/${complaintId}?from=dashboard`;
};
