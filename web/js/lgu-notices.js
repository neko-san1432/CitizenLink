/**
 * LGU Important Notices Management
 * Handles important notice creation, editing, and management for LGU users
 */

document.addEventListener('DOMContentLoaded', async () => {
    
    
    // Initialize user data
    const user = await window.userUtils?.initializeUserData();
    if (!user) {
        console.error('User not authenticated');
        return;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial notices data
    await loadNoticesData();
});

// Setup event listeners
function setupEventListeners() {
    // Create notice button
    const createNoticeBtn = document.getElementById('create-notice-btn');
    if (createNoticeBtn) {
        createNoticeBtn.addEventListener('click', () => {
            openCreateNoticeModal();
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-notices-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadNoticesData();
        });
    }
    
    // Create first notice button
    const createFirstBtn = document.getElementById('create-first-notice');
    if (createFirstBtn) {
        createFirstBtn.addEventListener('click', () => {
            openCreateNoticeModal();
        });
    }
    
    // Save notice button
    const saveNoticeBtn = document.getElementById('save-notice-btn');
    if (saveNoticeBtn) {
        saveNoticeBtn.addEventListener('click', async () => {
            await saveNotice();
        });
    }
    
    // Wire up close buttons and actions for custom modal
    const createNoticeModal = document.getElementById('createNoticeModal');
    if (createNoticeModal) {
        const closeBtn = document.getElementById('create-notice-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeNoticeModal);
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="close-notice-modal"]')) closeNoticeModal();
        });
    }
    
    // Keep Bootstrap modal for notice detail as-is

    // Prevent default form submission (avoid reload on Enter key)
    const noticeForm = document.getElementById('create-notice-form');
    if (noticeForm) {
        noticeForm.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('notices-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            await filterNotices(e.target.value);
        }, 300));
    }
    
    // Priority filter
    const priorityFilter = document.getElementById('priority-filter');
    if (priorityFilter) {
        priorityFilter.addEventListener('change', async () => {
            await filterNotices();
        });
    }
    
    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', async () => {
            await filterNotices();
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', async () => {
            await filterNotices();
        });
    }
    
    // Load more button
    const loadMoreBtn = document.getElementById('load-more-notices');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            await loadMoreNotices();
        });
    }
}

// Load notices data
async function loadNoticesData() {
    try {
        
        
        // Show loading state
        showLoadingState();
        
        // Fetch notices from Supabase
        let noticesData = [];
        if (window.getActiveNotices) {
            noticesData = await window.getActiveNotices();
        } else {
            // Fallback to mock data
            noticesData = getMockNoticesData();
        }
        
        // Display notices
        displayNotices(noticesData);
        
        // Hide loading state
        hideLoadingState();
        
    } catch (error) {
        console.error('Error loading notices data:', error);
        hideLoadingState();
        showToast('Error loading notices data', 'error');
    }
}

// Display notices
function displayNotices(noticesData) {
    const noticesGrid = document.getElementById('notices-grid');
    const noNoticesMessage = document.getElementById('no-notices-message');
    
    if (!noticesGrid) return;
    
    // Clear existing content
    noticesGrid.innerHTML = '';
    
    if (!noticesData || noticesData.length === 0) {
        // Show no notices message
        if (noNoticesMessage) {
            noNoticesMessage.style.display = 'flex';
        }
        return;
    }
    
    // Hide no notices message
    if (noNoticesMessage) {
        noNoticesMessage.style.display = 'none';
    }
    
    // Display notices
    noticesData.forEach(notice => {
        const noticeCard = createNoticeCard(notice);
        noticesGrid.appendChild(noticeCard);
    });
}

// Create notice card
function createNoticeCard(notice) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-4';
    
    const card = document.createElement('div');
    card.className = 'card h-100';
    
    // Priority indicator
    const priorityClass = getPriorityClass(notice.priority);
    card.classList.add(priorityClass);
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    
    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'd-flex justify-content-between align-items-start mb-2';
    
    const priority = document.createElement('span');
    priority.className = `badge ${getPriorityBadgeClass(notice.priority)}`;
    priority.textContent = notice.priority;
    
    const status = document.createElement('span');
    status.className = `badge ${notice.status === 'active' ? 'bg-success' : 'bg-warning'}`;
    status.textContent = notice.status;
    
    cardHeader.appendChild(priority);
    cardHeader.appendChild(status);
    
    // Title
    const title = document.createElement('h5');
    title.className = 'card-title';
    title.textContent = notice.title;
    
    // Content preview
    const content = document.createElement('p');
    content.className = 'card-text text-muted';
    content.textContent = notice.content.length > 100 ? 
        notice.content.substring(0, 100) + '...' : notice.content;
    
    // Meta info
    const meta = document.createElement('div');
    meta.className = 'd-flex justify-content-between align-items-center text-muted small mb-2';
    
    const category = document.createElement('span');
    category.textContent = notice.category;
    
    const urgent = document.createElement('span');
    if (notice.is_urgent) {
        urgent.innerHTML = '<i class="fas fa-exclamation-triangle text-danger"></i> Urgent';
    }
    
    meta.appendChild(category);
    meta.appendChild(urgent);
    
    // Date range
    const dateRange = document.createElement('div');
    dateRange.className = 'text-muted small mb-3';
    dateRange.innerHTML = `
        <div><strong>From:</strong> ${formatDate(notice.start_date || notice.startDate)}</div>
        <div><strong>To:</strong> ${formatDate(notice.end_date || notice.endDate)}</div>
    `;
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'd-flex gap-2 mt-3';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-outline-primary';
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', () => {
        viewNotice(notice);
    });
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-outline-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
        editNotice(notice);
    });
    
    actions.appendChild(viewBtn);
    actions.appendChild(editBtn);
    
    // Assemble card
    cardBody.appendChild(cardHeader);
    cardBody.appendChild(title);
    cardBody.appendChild(content);
    cardBody.appendChild(meta);
    cardBody.appendChild(dateRange);
    cardBody.appendChild(actions);
    
    card.appendChild(cardBody);
    col.appendChild(card);
    
    return col;
}

// Get priority class for card styling
function getPriorityClass(priority) {
    switch (priority) {
        case 'critical': return 'border-danger';
        case 'high': return 'border-warning';
        case 'medium': return 'border-info';
        case 'low': return 'border-secondary';
        default: return 'border-secondary';
    }
}

// Get priority badge class
function getPriorityBadgeClass(priority) {
    switch (priority) {
        case 'critical': return 'bg-danger';
        case 'high': return 'bg-warning';
        case 'medium': return 'bg-info';
        case 'low': return 'bg-secondary';
        default: return 'bg-secondary';
    }
}

// Open create notice modal (match News modal behavior)
function openCreateNoticeModal() {
    const modal = document.getElementById('createNoticeModal');
    if (modal) {
        modal.style.display = 'block';

        // Update modal title
        const title = document.getElementById('create-notice-modal-title');
        if (title) title.textContent = 'Create Important Notice';

        // Reset form and set defaults
        const form = document.getElementById('create-notice-form');
        if (form) {
            form.reset();

            const today = new Date();
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

            const startDateInput = form.querySelector('[name="start_date"]');
            const endDateInput = form.querySelector('[name="end_date"]');

            if (startDateInput) startDateInput.value = today.toISOString().split('T')[0];
            if (endDateInput) endDateInput.value = nextMonth.toISOString().split('T')[0];
        }

        // Update save button
        const saveBtn = document.getElementById('save-notice-btn');
        if (saveBtn) {
            saveBtn.textContent = 'Create Notice';
            saveBtn.onclick = async () => { await saveNotice(); };
        }
    }
}

// Close create notice modal (match News modal behavior)
function closeNoticeModal() {
    const modal = document.getElementById('createNoticeModal');
    if (modal) {
        modal.style.display = 'none';
        const form = document.getElementById('create-notice-form');
        if (form) form.reset();
    }
}

// Save notice
async function saveNotice() {
    try {
        const form = document.getElementById('create-notice-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const noticeData = {
            title: formData.get('title'),
            priority: formData.get('priority'),
            category: formData.get('category'),
            content: formData.get('content'),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            is_urgent: formData.get('is_urgent') === 'on',
            contact_info: formData.get('contact_info'),
            status: formData.get('status'),
            acknowledgment_required: formData.get('acknowledgment_required') === 'on'
        };
        
        // Validate required fields
        if (!noticeData.title || !noticeData.content || !noticeData.category || 
            !noticeData.start_date || !noticeData.end_date) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Validate dates
        if (new Date(noticeData.start_date) >= new Date(noticeData.end_date)) {
            showToast('End date must be after start date', 'error');
            return;
        }
        
        // Save to Supabase
        let savedNotice;
        if (window.createNotice) {
            savedNotice = await window.createNotice(noticeData);
        } else {
            // Fallback to mock creation
            savedNotice = createMockNotice(noticeData);
        }
        
        if (savedNotice) {
            showToast('Notice created successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createNoticeModal'));
            modal.hide();
            
            // Reload notices data
            await loadNoticesData();
        }
        
    } catch (error) {
        console.error('Error saving notice:', error);
        showToast('Error saving notice', 'error');
    }
}

// View notice
function viewNotice(notice) {
    const modal = new bootstrap.Modal(document.getElementById('noticeModal'));
    
    // Update modal content
    const modalBody = document.getElementById('noticeModalBody');
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="notice-detail">
                <div class="notice-header mb-3">
                    <h4>${notice.title}</h4>
                    <div class="d-flex gap-2 mb-2">
                        <span class="badge ${getPriorityBadgeClass(notice.priority)}">${notice.priority}</span>
                        <span class="badge ${notice.status === 'active' ? 'bg-success' : 'bg-warning'}">${notice.status}</span>
                        ${notice.is_urgent ? '<span class="badge bg-danger">Urgent</span>' : ''}
                        ${notice.requires_action ? '<span class="badge bg-warning">Action Required</span>' : ''}
                    </div>
                    <div class="text-muted small">
                        Category: ${notice.category} • ${formatDate(notice.start_date || notice.startDate)} to ${formatDate(notice.end_date || notice.endDate)}
                    </div>
                </div>
                <div class="notice-content mb-3">
                    ${notice.content}
                </div>
                
                ${notice.contact_info ? `
                    <div class="contact-info mb-3">
                        <strong>Contact Information:</strong><br>
                        ${notice.contact_info}
                    </div>
                ` : ''}
                ${notice.acknowledgment_required ? `
                    <div class="acknowledgment mb-3 p-3 bg-warning bg-opacity-10 border border-warning rounded">
                        <strong>⚠️ Acknowledgment Required</strong><br>
                        This notice requires acknowledgment from recipients.
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    modal.show();
}

// Edit notice
function editNotice(notice) {
    const modal = new bootstrap.Modal(document.getElementById('createNoticeModal'));
    
    // Update modal title
    const modalTitle = document.getElementById('createNoticeModalLabel');
    if (modalTitle) {
        modalTitle.textContent = 'Edit Important Notice';
    }
    
    // Update save button
    const saveBtn = document.getElementById('save-notice-btn');
    if (saveBtn) {
        saveBtn.textContent = 'Update Notice';
        saveBtn.onclick = async () => {
            await updateNotice(notice.id);
        };
    }
    
    // Populate form with notice data
    const form = document.getElementById('create-notice-form');
    if (form) {
        form.querySelector('[name="title"]').value = notice.title;
        form.querySelector('[name="priority"]').value = notice.priority;
        form.querySelector('[name="category"]').value = notice.category;
        form.querySelector('[name="content"]').value = notice.content;
        form.querySelector('[name="start_date"]').value = notice.start_date || notice.startDate;
        form.querySelector('[name="end_date"]').value = notice.end_date || notice.endDate;
        form.querySelector('[name="is_urgent"]').checked = notice.is_urgent;
        form.querySelector('[name="contact_info"]').value = notice.contact_info || '';
        form.querySelector('[name="status"]').value = notice.status;
        form.querySelector('[name="acknowledgment_required"]').checked = notice.acknowledgment_required;
    }
    
    modal.show();
}

// Update notice
async function updateNotice(noticeId) {
    try {
        const form = document.getElementById('create-notice-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const noticeData = {
            title: formData.get('title'),
            priority: formData.get('priority'),
            category: formData.get('category'),
            content: formData.get('content'),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            is_urgent: formData.get('is_urgent') === 'on',
            requires_action: formData.get('requires_action') === 'on',
            action_required: formData.get('action_required'),
            contact_info: formData.get('contact_info'),
            status: formData.get('status'),
            acknowledgment_required: formData.get('acknowledgment_required') === 'on'
        };
        
        // Validate required fields
        if (!noticeData.title || !noticeData.content || !noticeData.category || 
            !noticeData.start_date || !noticeData.end_date) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Validate dates
        if (new Date(noticeData.start_date) >= new Date(noticeData.end_date)) {
            showToast('End date must be after start date', 'error');
            return;
        }
        
        // Update in Supabase
        if (window.updateNotice) {
            await window.updateNotice(noticeId, noticeData);
        } else {
            // Fallback to mock update
            updateMockNotice(noticeId, noticeData);
        }
        
        showToast('Notice updated successfully!', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createNoticeModal'));
        modal.hide();
        
        // Reload notices data
        await loadNoticesData();
        
    } catch (error) {
        console.error('Error updating notice:', error);
        showToast('Error updating notice', 'error');
    }
}

// Filter notices
async function filterNotices(searchTerm = '') {
    try {
        const priorityFilter = document.getElementById('priority-filter');
        const categoryFilter = document.getElementById('category-filter');
        const statusFilter = document.getElementById('status-filter');
        
        const priority = priorityFilter ? priorityFilter.value : '';
        const category = categoryFilter ? categoryFilter.value : '';
        const status = statusFilter ? statusFilter.value : '';
        
        // Get all notices data
        let noticesData = [];
        if (window.getActiveNotices) {
            noticesData = await window.getActiveNotices();
        } else {
            noticesData = getMockNoticesData();
        }
        
        // Apply filters
        let filteredNotices = noticesData.filter(notice => {
            // Priority filter
            if (priority && notice.priority !== priority) return false;
            
            // Category filter
            if (category && notice.category !== category) return false;
            
            // Status filter
            if (status && notice.status !== status) return false;
            
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return notice.title.toLowerCase().includes(searchLower) ||
                       notice.content.toLowerCase().includes(searchLower) ||
                       notice.category.toLowerCase().includes(searchLower);
            }
            
            return true;
        });
        
        // Display filtered results
        displayNotices(filteredNotices);
        
    } catch (error) {
        console.error('Error filtering notices:', error);
    }
}

// Load more notices
async function loadMoreNotices() {
    // This would implement pagination in a real app
    // For now, just reload all data
    await loadNoticesData();
}

// Show loading state
function showLoadingState() {
    const noticesGrid = document.getElementById('notices-grid');
    if (noticesGrid) {
        noticesGrid.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading notices...</p>
            </div>
        `;
    }
}

// Hide loading state
function hideLoadingState() {
    // Loading state is cleared when displayNotices is called
}

// Mock data functions (fallback when Supabase functions aren't available)
function getMockNoticesData() {
    return [
        {
            id: 1,
            title: "Road Maintenance Notice",
            priority: "high",
            category: "Infrastructure",
            content: "Scheduled road maintenance on Main Street from December 15-20, 2024. Expect delays and use alternate routes.",
            start_date: "2024-12-15T00:00:00Z",
            end_date: "2024-12-20T23:59:59Z",
            is_urgent: true,
            requires_action: false,
            action_required: null,
            contact_info: "Public Works Department: (555) 123-4567",
            status: "active",
            created_at: "2024-12-01T09:00:00Z",
            updated_at: "2024-12-01T09:00:00Z",
            is_active: true,
            view_count: 0,
            acknowledgment_required: false
        }
    ];
}

function createMockNotice(noticeData) {
    return {
        id: Date.now(),
        ...noticeData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        view_count: 0,
        is_active: true
    };
}

function updateMockNotice(noticeId, noticeData) {
    // In a real app, this would update the database
    
    return true;
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    // Create toast content
    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${type === 'success' ? 'Success' : 'Error'}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}
