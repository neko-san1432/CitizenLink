/**
 * COMPREHENSIVE DATA MANAGEMENT SYSTEM
 * =====================================
 * 
 * This file contains all data structures and management functions for:
 * - Complaints data
 * - Latest news updates data
 * - Upcoming events data
 * - Important notice data
 * 
 * BACKEND INTEGRATION NOTES:
 * =========================
 * - Replace all mock data with API calls to your backend
 * - Update the data structures to match your database schema
 * - Implement proper error handling and loading states
 * - Add authentication headers to API requests
 * - Consider implementing caching for better performance
 */

// ============================================================================
// COMPLAINTS DATA MANAGEMENT
// ============================================================================

/**
 * COMPLAINTS DATA STRUCTURE
 * -------------------------
 * Backend Database Schema (example):
 * - id: unique identifier (auto-increment)
 * - userId: foreign key to users table
 * - userName: complainant name
 * - title: complaint title
 * - type: complaint category
 * - subcategory: specific complaint type

 * - location: complaint location
 * - description: detailed description
 * - status: current status (pending, in_progress, resolved, rejected)
 * - assignedUnit: government unit assigned
 * - created_at: timestamp when created
 * - updated_at: timestamp when last updated
 * - resolved_at: timestamp when resolved
 * - adminNotes: internal notes from administrators
 * - citizenFeedback: feedback from citizen after resolution
 */

// Live complaints data from Supabase
let complaintsData = [];

/**
 * COMPLAINTS API FUNCTIONS
 * ------------------------
 * Backend Endpoints to implement:
 * - GET /api/complaints - Get all complaints with pagination
 * - GET /api/complaints/:id - Get specific complaint
 * - POST /api/complaints - Create new complaint
 * - PUT /api/complaints/:id - Update complaint
 * - DELETE /api/complaints/:id - Delete complaint
 * - GET /api/complaints/user/:userId - Get user's complaints
 * - GET /api/complaints/status/:status - Get complaints by status
 */

// Get all complaints from Supabase
async function getComplaints() {
  try {
    console.log('🔍 getComplaints: Starting to fetch complaints...');
    
    const supabase = await window.supabaseManager.initialize();
    console.log('🔍 getComplaints: Supabase initialized');
    
    // First check if complaints table exists by trying to query it
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('🔍 getComplaints: Query result - data:', data, 'error:', error);

    if (error) {
      console.error('❌ Error fetching complaints:', error);
      if (error.code === '42P01') {
        console.log('❌ Table does not exist');
        return [];
      }
      return [];
    }

    console.log('✅ getComplaints: Successfully fetched complaints, count:', data?.length);
    
    // Update local cache
    complaintsData = data || [];
    return complaintsData;
  } catch (error) {
    console.error('❌ Error in getComplaints:', error);
    return [];
  }
}

// Get complaint by ID from Supabase
async function getComplaintById(id) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching complaint:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getComplaintById:', error);
    return null;
  }
}

// Create new complaint in Supabase
async function createComplaint(complaintData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('complaints')
      .insert([{
        ...complaintData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating complaint:', error);
      throw error;
    }

    // Update local cache
      complaintsData.unshift(data);
  return data;
} catch (error) {
  console.error('Error in createComplaint:', error);
  throw error;
}
}

// Update complaint in Supabase
async function updateComplaint(id, updateData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('complaints')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating complaint:', error);
      throw error;
    }

    // Update local cache
    const index = complaintsData.findIndex(c => c.id === id);
    if (index !== -1) {
      complaintsData[index] = data;
    }

    return data;
  } catch (error) {
    console.error('Error in updateComplaint:', error);
    throw error;
  }
}

// ============================================================================
// NEWS DATA MANAGEMENT
// ============================================================================

/**
 * NEWS DATA STRUCTURE
 * -------------------
 * Backend Database Schema (example):
 * - id: unique identifier (auto-increment)
 * - title: article title
 * - excerpt: brief summary
 * - content: full article content (HTML)
 * - date: publication date
 * - category: news category
 * - icon: FontAwesome icon class
 * - author: author name
 * - read_time: estimated reading time
 * - status: publication status (draft, published, archived)
 * - featured: boolean for featured articles
 * - tags: array of tags for categorization
 * - image_url: optional image URL
 * - created_at: timestamp when created
 * - updated_at: timestamp when last updated
 * - published_at: timestamp when published
 * - view_count: number of views
 * - is_active: boolean for active/inactive status
 */

// Live news data from Supabase
let newsData = [];

/**
 * NEWS API FUNCTIONS
 * ------------------
 * Backend Endpoints to implement:
 * - GET /api/news - Get all news articles with pagination
 * - GET /api/news/:id - Get specific article
 * - POST /api/news - Create new article (admin only)
 * - PUT /api/news/:id - Update article (admin only)
 * - DELETE /api/news/:id - Delete article (admin only)
 * - GET /api/news/category/:category - Get articles by category
 * - GET /api/news/featured - Get featured articles
 * - PUT /api/news/:id/publish - Publish draft article
 * - PUT /api/news/:id/archive - Archive article
 */

// Get all news from Supabase
async function getNews() {
  try {
    
    const supabase = await window.supabaseManager.initialize();
    
    // First try to get all news to see what's available
    const { data: allNews, error: allError } = await supabase
      .from('news_data')
      .select('*');
    
    if (allError) {
      console.error('❌ Error fetching all news:', allError);
    } else {
      
    }
    
    // Now get published news
    const { data, error } = await supabase
      .from('news_data')
      .select('*')
      .eq('status', 'published')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching published news:', error);
      return [];
    }

    
    
    // Update local cache
    newsData = data || [];
    return newsData;
  } catch (error) {
    console.error('❌ Error in getNews:', error);
    return [];
  }
}

// Create new article in Supabase
async function createNewsArticle(articleData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('news_data')
      .insert([{
        ...articleData,
        // Only override these fields if not provided in articleData
        status: articleData.status || 'published',
        featured: articleData.featured !== undefined ? articleData.featured : false,
        tags: articleData.tags || [],
        image_path: articleData.image_path || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        view_count: 0,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating news article:', error);
      throw error;
    }

    // Add to local cache
    newsData.unshift(data);
    return data;
  } catch (error) {
    console.error('Error in createNewsArticle:', error);
    throw error;
  }
}

// ============================================================================
// UPCOMING EVENTS DATA MANAGEMENT
// ============================================================================

/**
 * EVENTS DATA STRUCTURE
 * ---------------------
 * Backend Database Schema (example):
 * - id: unique identifier (auto-increment)
 * - title: event title
 * - description: event description
 * - event_date: event date and time
 * - location: event location
 * - category: event category
 * - organizer: organizing entity
 * - contact_info: contact information
 * - registration_required: boolean for registration
 * - max_attendees: maximum number of attendees
 * - current_attendees: current number of registered attendees
 * - status: event status (upcoming, ongoing, completed, cancelled)
 * - image_url: event image URL
 * - tags: array of event tags
 * - created_at: timestamp when created
 * - updated_at: timestamp when last updated
 * - is_active: boolean for active/inactive status
 */

// Events data will be fetched from Supabase
let eventsData = [];

/**
 * EVENTS API FUNCTIONS
 * --------------------
 * Backend Endpoints to implement:
 * - GET /api/events - Get all events with pagination
 * - GET /api/events/:id - Get specific event
 * - POST /api/events - Create new event (admin only)
 * - PUT /api/events/:id - Update event (admin only)
 * - DELETE /api/events/:id - Delete event (admin only)
 * - GET /api/events/upcoming - Get upcoming events
 * - GET /api/events/category/:category - Get events by category
 * - POST /api/events/:id/register - Register for event
 * - DELETE /api/events/:id/register - Cancel registration
 */

// Get upcoming events from Supabase
async function getUpcomingEvents() {
  try {
    
    const supabase = await window.supabaseManager.initialize();
    
    const now = new Date();
    // Show events from past 3 months up to next 18 months (inclusive window)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    const eighteenMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 18, 1).toISOString();
    
    
    
    
    // First try to get all events to see what's available
    const { data: allEvents, error: allError } = await supabase
      .from('upcoming_events_data')
      .select('*')
      .eq('is_active', true);
    
    if (allError) {
      console.error('❌ Error fetching all events:', allError);
    } else {
      
    }
    
    // Get events within inclusive time window
    const { data, error } = await supabase
      .from('upcoming_events_data')
      .select('*')
      .eq('is_active', true)
      .gte('event_date', threeMonthsAgo)
      .lte('event_date', eighteenMonthsAhead)
      .order('event_date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching upcoming events:', error);
      return [];
    }

    
    
    // Update local cache
    eventsData = data || [];
    return eventsData;
  } catch (error) {
    console.error('❌ Error in getUpcomingEvents:', error);
    return [];
  }
}

// ============================================================================
// IMPORTANT NOTICES DATA MANAGEMENT
// ============================================================================

/**
 * IMPORTANT NOTICES DATA STRUCTURE
 * --------------------------------
 * Backend Database Schema (example):
 * - id: unique identifier (auto-increment)
 * - title: notice title
 * - content: notice content
 * - priority: priority level (low, medium, high, critical)
 * - category: notice category
 * - start_date: when notice becomes active
 * - end_date: when notice expires
 * - is_urgent: boolean for urgent notices
 * - requires_action: boolean if citizen action required
 * - action_required: description of required action
 * - contact_info: contact information for questions
 * - status: notice status (active, inactive, expired)
 * - created_at: timestamp when created
 * - updated_at: timestamp when last updated
 * - is_active: boolean for active/inactive status
 * - view_count: number of views
 * - acknowledgment_required: boolean if acknowledgment needed
 */

// Notices data will be fetched from Supabase
let noticesData = [];

/**
 * IMPORTANT NOTICES API FUNCTIONS
 * -------------------------------
 * Backend Endpoints to implement:
 * - GET /api/notices - Get all notices with pagination
 * - GET /api/notices/:id - Get specific notice
 * - POST /api/notices - Create new notice (admin only)
 * - PUT /api/notices/:id - Update notice (admin only)
 * - DELETE /api/notices/:id - Delete notice (admin only)
 * - GET /api/notices/active - Get active notices
 * - GET /api/notices/urgent - Get urgent notices
 * - GET /api/notices/category/:category - Get notices by category
 * - PUT /api/notices/:id/acknowledge - Acknowledge notice
 * - PUT /api/notices/:id/expire - Mark notice as expired
 */

// Get active notices from Supabase
async function getActiveNotices() {
  try {
    
    const supabase = await window.supabaseManager.initialize();
    
    const now = new Date().toISOString();
    
    
    // First try to get all notices to see what's available
    const { data: allNotices, error: allError } = await supabase
      .from('important_notice_data')
      .select('*')
      .eq('is_active', true);
    
    if (allError) {
      console.error('❌ Error fetching all notices:', allError);
    } else {
      
    }
    
    // Now get active notices with less restrictive filtering
    const { data, error } = await supabase
      .from('important_notice_data')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching active notices:', error);
      return [];
    }

    
    
    // Update local cache
    noticesData = data || [];
    return noticesData;
  } catch (error) {
    console.error('❌ Error in getActiveNotices:', error);
    return [];
  }
}

// ============================================================================
// ADDITIONAL SUPABASE FUNCTIONS FOR EVENTS AND NOTICES
// ============================================================================

// Get all events from Supabase
async function getAllEvents() {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('upcoming_events_data')
      .select('*')
      .eq('is_active', true)
      .order('event_date', { ascending: true });

    if (error) {
      console.error('Error fetching all events:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllEvents:', error);
    return [];
  }
}

// Get events by category from Supabase
async function getEventsByCategory(category) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('upcoming_events_data')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('event_date', { ascending: true });

    if (error) {
      console.error('Error fetching events by category:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getEventsByCategory:', error);
    return [];
  }
}

// Get urgent notices from Supabase
async function getUrgentNotices() {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('important_notice_data')
      .select('*')
      .eq('is_urgent', true)
      .eq('is_active', true)
      .eq('status', 'active')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching urgent notices:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUrgentNotices:', error);
    return [];
  }
}

// Get notices by category from Supabase
async function getNoticesByCategory(category) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('important_notice_data')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .eq('status', 'active')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching notices by category:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getNoticesByCategory:', error);
    return [];
  }
}

// ============================================================================
// COLOR SCHEME EXPLANATION FOR IMPORTANT NOTICES
// ============================================================================

/**
 * IMPORTANT NOTICES COLOR SCHEME
 * ==============================
 * 
 * The colors used in important notices have specific meanings:
 * 
 * BLUE (#0d6efd) - Primary Color
 * - Represents: Trust, reliability, government authority
 * - Used for: General notices, informational content
 * - Meaning: Standard government communication
 * 
 * RED (#dc3545) - Critical/Urgent
 * - Represents: Danger, immediate attention required
 * - Used for: Emergency notices, safety alerts
 * - Meaning: Requires immediate citizen action
 * 
 * ORANGE (#fd7e14) - High Priority
 * - Represents: Warning, important but not emergency
 * - Used for: Maintenance notices, service disruptions
 * - Meaning: Important information, plan accordingly
 * 
 * YELLOW (#ffc107) - Medium Priority
 * - Represents: Caution, general awareness
 * - Used for: General announcements, upcoming changes
 * - Meaning: Be aware, no immediate action needed
 * 
 * GREEN (#198754) - Positive/Informational
 * - Represents: Success, positive news, completion
 * - Used for: Service restorations, positive updates
 * - Meaning: Good news or completed actions
 * 
 * GRAY (#6c757d) - Low Priority
 * - Represents: Neutral, general information
 * - Used for: Routine announcements, general updates
 * - Meaning: Standard information, no urgency
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * UTILITY FUNCTIONS
 * -----------------
 * These functions help with data processing and formatting
 * Backend Integration: These can remain as utility functions
 */

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
}

// Get priority color for notices
function getPriorityColor(priority) {
  const colorMap = {
    'critical': '#dc3545', // Red
    'high': '#fd7e14',     // Orange
    'medium': '#ffc107',   // Yellow
    'low': '#6c757d'       // Gray
  };
  return colorMap[priority] || '#0d6efd'; // Default to blue
}

// Get category icon
function getCategoryIcon(category) {
  const iconMap = {
    'Public Safety': 'fas fa-shield-alt',
    'Infrastructure': 'fas fa-road',
    'Environment': 'fas fa-leaf',
    'Health': 'fas fa-heartbeat',
    'Technology': 'fas fa-laptop',
    'Education': 'fas fa-graduation-cap'
  };
  return iconMap[category] || 'fas fa-newspaper';
}

// ============================================================================
// DATA REFRESH AND SYNC FUNCTIONS
// ============================================================================

/**
 * DATA REFRESH FUNCTIONS
 * ----------------------
 * These functions help keep data synchronized
 * Backend Integration: Implement proper caching and refresh strategies
 */

// Refresh all data from Supabase
async function refreshAllData() {
  try {
    // Fetch all data from Supabase
    const [complaints, news, events, notices] = await Promise.all([
      getComplaints(),
      getNews(),
      getUpcomingEvents(),
      getActiveNotices()
    ]);
    
    // Update local storage with refresh timestamp
    localStorage.setItem('lastDataRefresh', new Date().toISOString());
    
    return {
      complaints,
      news,
      events,
      notices
    };
  } catch (error) {
    console.error('Error refreshing data:', error);
    throw error;
  }
}

// Check if data needs refresh
function shouldRefreshData() {
  const lastRefresh = localStorage.getItem('lastDataRefresh');
  if (!lastRefresh) return true;
  
  const lastRefreshTime = new Date(lastRefresh);
  const now = new Date();
  const timeDiff = now - lastRefreshTime;
  
  // Refresh every 5 minutes
  return timeDiff > 5 * 60 * 1000;
}

// ============================================================================
// ERROR HANDLING AND LOGGING
// ============================================================================

/**
 * ERROR HANDLING
 * --------------
 * Implement proper error handling for production use
 * Backend Integration: Add proper error logging and user feedback
 */

// Handle API errors
function handleApiError(error, context) {
  console.error(`API Error in ${context}:`, error);
  
  // TODO: Implement proper error logging
  // - Log to backend error tracking service
  // - Send error reports to administrators
  // - Provide user-friendly error messages
  
  return {
    success: false,
    error: error.message,
    context: context,
    timestamp: new Date().toISOString()
  };
}

// Log data operations
function logDataOperation(operation, data, userId) {
  // TODO: Implement proper logging
  // - Log to backend audit trail
  // - Track user actions for security
  // - Monitor data usage patterns
  
  console.log(`Data Operation: ${operation}`, {
    operation,
    dataType: typeof data,
    userId,
    timestamp: new Date().toISOString()
  });
}

// ============================================================================
// CRUD FUNCTIONS FOR LGU CONTENT MANAGEMENT
// ============================================================================

// News CRUD functions
async function updateNewsArticle(id, updateData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('news_data')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating news article:', error);
      throw error;
    }

    // Update local cache
    const index = newsData.findIndex(article => article.id === id);
    if (index !== -1) {
      newsData[index] = { ...newsData[index], ...data };
    }

    return data;
  } catch (error) {
    console.error('Error in updateNewsArticle:', error);
    throw error;
  }
}

// Events CRUD functions
async function createEvent(eventData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('upcoming_events_data')
      .insert([eventData])
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      throw error;
    }

    // Add to local cache
    eventsData.push(data);
    
    return data;
  } catch (error) {
    console.error('Error in createEvent:', error);
    throw error;
  }
}

async function updateEvent(id, updateData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('upcoming_events_data')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating event:', error);
      throw error;
    }

    // Update local cache
    const index = eventsData.findIndex(event => event.id === id);
    if (index !== -1) {
      eventsData[index] = { ...eventsData[index], ...data };
    }

    return data;
  } catch (error) {
    console.error('Error in updateEvent:', error);
    throw error;
  }
}

// Notices CRUD functions
async function createNotice(noticeData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('important_notice_data')
      .insert([noticeData])
      .select()
      .single();

    if (error) {
      console.error('Error creating notice:', error);
      throw error;
    }

    // Add to local cache
    noticesData.push(data);
    
    return data;
  } catch (error) {
    console.error('Error in createNotice:', error);
    throw error;
  }
}

async function updateNotice(id, updateData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    const { data, error } = await supabase
      .from('important_notice_data')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating notice:', error);
      throw error;
    }

    // Update local cache
    const index = noticesData.findIndex(notice => notice.id === id);
    if (index !== -1) {
      noticesData[index] = { ...noticesData[index], ...data };
    }

    return data;
  } catch (error) {
    console.error('Error in updateNotice:', error);
    throw error;
  }
}



// ============================================================================
// MAKE FUNCTIONS AVAILABLE GLOBALLY
// ============================================================================

// Make functions available globally for use in other scripts
if (typeof window !== 'undefined') {
  // Complaints functions
  window.getComplaints = getComplaints;
  window.getComplaintById = getComplaintById;
  window.createComplaint = createComplaint;
  window.updateComplaint = updateComplaint;
  
  // News functions
  window.getNews = getNews;
  window.createNewsArticle = createNewsArticle;
  window.updateNewsArticle = updateNewsArticle;
  window.checkBucketAvailability = async (bucketName) => {
    try {
      const supabase = await window.supabaseManager.initialize();
      const { data, error } = await supabase.storage.from(bucketName).list('', { limit: 1 });
      if (error) {
        return { available: false, bucket: bucketName, message: error.message, status: error.status || error.statusCode || null };
      }
      return { available: true, bucket: bucketName, canList: Array.isArray(data), sampleCount: Array.isArray(data) ? data.length : 0 };
    } catch (e) {
      return { available: false, bucket: bucketName, message: e.message };
    }
  };
  
  // Events functions
  window.getUpcomingEvents = getUpcomingEvents;
  window.getAllEvents = getAllEvents;
  window.getEventsByCategory = getEventsByCategory;
  window.createEvent = createEvent;
  window.updateEvent = updateEvent;
  
  // Notices functions
  window.getActiveNotices = getActiveNotices;
  window.getUrgentNotices = getUrgentNotices;
  window.getNoticesByCategory = getNoticesByCategory;
  window.createNotice = createNotice;
  window.updateNotice = updateNotice;
  
  // Utility functions
  window.refreshAllData = refreshAllData;
  window.shouldRefreshData = shouldRefreshData;
  window.formatDate = formatDate;
  window.getPriorityColor = getPriorityColor;
  window.getCategoryIcon = getCategoryIcon;
  
  
}
