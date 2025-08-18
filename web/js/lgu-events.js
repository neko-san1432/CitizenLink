/**
 * LGU Upcoming Events Management
 * Handles upcoming events creation, editing, and management for LGU users
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('LGU Events Management initialized');
    
    // Initialize user data
    const user = await window.userUtils?.initializeUserData();
    if (!user) {
        console.error('User not authenticated');
        return;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial events data
    await loadEventsData();
});

// Setup event listeners
function setupEventListeners() {
    // Create event button
    const createEventBtn = document.getElementById('create-event-btn');
    if (createEventBtn) {
        createEventBtn.addEventListener('click', () => {
            openCreateEventModal();
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-events-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadEventsData();
        });
    }
    
    // Create first event button
    const createFirstBtn = document.getElementById('create-first-event');
    if (createFirstBtn) {
        createFirstBtn.addEventListener('click', () => {
            openCreateEventModal();
        });
    }
    
    // Save event button
    const saveEventBtn = document.getElementById('save-event-btn');
    if (saveEventBtn) {
        saveEventBtn.addEventListener('click', async () => {
            await saveEvent();
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('events-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            await filterEvents(e.target.value);
        }, 300));
    }
    
    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', async () => {
            await filterEvents();
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', async () => {
            await filterEvents();
        });
    }
    
    // Registration filter
    const registrationFilter = document.getElementById('registration-filter');
    if (registrationFilter) {
        registrationFilter.addEventListener('change', async () => {
            await filterEvents();
        });
    }
    
    // Load more button
    const loadMoreBtn = document.getElementById('load-more-events');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            await loadMoreEvents();
        });
    }
}

// Load events data
async function loadEventsData() {
    try {
        console.log('Loading events data...');
        
        // Show loading state
        showLoadingState();
        
        // Fetch events from Supabase
        let eventsData = [];
        if (window.getUpcomingEvents) {
            eventsData = await window.getUpcomingEvents();
        } else {
            // Fallback to mock data
            eventsData = getMockEventsData();
        }
        
        // Display events
        displayEvents(eventsData);
        
        // Hide loading state
        hideLoadingState();
        
    } catch (error) {
        console.error('Error loading events data:', error);
        hideLoadingState();
        showToast('Error loading events data', 'error');
    }
}

// Display events
function displayEvents(eventsData) {
    const eventsGrid = document.getElementById('events-grid');
    const noEventsMessage = document.getElementById('no-events-message');
    
    if (!eventsGrid) return;
    
    // Clear existing content
    eventsGrid.innerHTML = '';
    
    if (!eventsData || eventsData.length === 0) {
        // Show no events message
        if (noEventsMessage) {
            noEventsMessage.style.display = 'flex';
        }
        return;
    }
    
    // Hide no events message
    if (noEventsMessage) {
        noEventsMessage.style.display = 'none';
    }
    
    // Display events
    eventsData.forEach(event => {
        const eventCard = createEventCard(event);
        eventsGrid.appendChild(eventCard);
    });
}

// Create event card
function createEventCard(event) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-4';
    
    const card = document.createElement('div');
    card.className = 'card h-100';
    
    // Status indicator
    const statusClass = getStatusClass(event.status);
    card.classList.add(statusClass);
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    
    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'd-flex justify-content-between align-items-start mb-2';
    
    const category = document.createElement('span');
    category.className = 'badge bg-primary';
    category.textContent = event.category;
    
    const status = document.createElement('span');
    status.className = `badge ${getStatusBadgeClass(event.status)}`;
    status.textContent = event.status;
    
    cardHeader.appendChild(category);
    cardHeader.appendChild(status);
    
    // Title
    const title = document.createElement('h5');
    title.className = 'card-title';
    title.textContent = event.title;
    
    // Description preview
    const description = document.createElement('p');
    description.className = 'card-text text-muted';
    description.textContent = event.description.length > 100 ? 
        event.description.substring(0, 100) + '...' : event.description;
    
    // Event details
    const eventDetails = document.createElement('div');
    eventDetails.className = 'event-details mb-3';
    
    // Date and time
    const dateTime = document.createElement('div');
    dateTime.className = 'text-muted small mb-2';
    dateTime.innerHTML = `
        <div><strong>Date:</strong> ${formatDate(event.event_date || event.eventDate)}</div>
        <div><strong>Time:</strong> ${formatTime(event.event_date || event.eventDate)}</div>
    `;
    
    // Location
    const location = document.createElement('div');
    location.className = 'text-muted small mb-2';
    location.innerHTML = `<strong>Location:</strong> ${event.location}`;
    
    // Organizer
    const organizer = document.createElement('div');
    organizer.className = 'text-muted small mb-2';
    organizer.innerHTML = `<strong>Organizer:</strong> ${event.organizer}`;
    
    // Registration info
    if (event.registration_required) {
        const registration = document.createElement('div');
        registration.className = 'text-muted small mb-2';
        registration.innerHTML = `
            <strong>Registration:</strong> Required
            ${event.max_attendees ? ` (${event.current_attendees || 0}/${event.max_attendees} spots)` : ''}
        `;
        eventDetails.appendChild(registration);
    }
    
    eventDetails.appendChild(dateTime);
    eventDetails.appendChild(location);
    eventDetails.appendChild(organizer);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'd-flex gap-2 mt-3';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-outline-primary';
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', () => {
        viewEvent(event);
    });
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-outline-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
        editEvent(event);
    });
    
    actions.appendChild(viewBtn);
    actions.appendChild(editBtn);
    
    // Assemble card
    cardBody.appendChild(cardHeader);
    cardBody.appendChild(title);
    cardBody.appendChild(description);
    cardBody.appendChild(eventDetails);
    cardBody.appendChild(actions);
    
    card.appendChild(cardBody);
    col.appendChild(card);
    
    return col;
}

// Get status class for card styling
function getStatusClass(status) {
    switch (status) {
        case 'upcoming': return 'border-info';
        case 'ongoing': return 'border-success';
        case 'completed': return 'border-secondary';
        case 'cancelled': return 'border-danger';
        default: return 'border-secondary';
    }
}

// Get status badge class
function getStatusBadgeClass(status) {
    switch (status) {
        case 'upcoming': return 'bg-info';
        case 'ongoing': return 'bg-success';
        case 'completed': return 'bg-secondary';
        case 'cancelled': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

// Open create event modal
function openCreateEventModal() {
    const modal = new bootstrap.Modal(document.getElementById('createEventModal'));
    modal.show();
    
    // Reset form
    const form = document.getElementById('create-event-form');
    if (form) {
        form.reset();
        
        // Set default date (next week)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const eventDateInput = form.querySelector('[name="event_date"]');
        if (eventDateInput) {
            eventDateInput.value = nextWeek.toISOString().split('T')[0];
        }
        
        // Set default time
        const eventTimeInput = form.querySelector('[name="event_time"]');
        if (eventTimeInput) {
            eventTimeInput.value = '18:00';
        }
    }
    
    // Update modal title
    const modalTitle = document.getElementById('createEventModalLabel');
    if (modalTitle) {
        modalTitle.textContent = 'Create Upcoming Event';
    }
    
    // Update save button
    const saveBtn = document.getElementById('save-event-btn');
    if (saveBtn) {
        saveBtn.textContent = 'Create Event';
        saveBtn.onclick = async () => {
            await saveEvent();
        };
    }
}

// Save event
async function saveEvent() {
    try {
        const form = document.getElementById('create-event-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const eventDate = formData.get('event_date');
        const eventTime = formData.get('event_time');
        
        // Combine date and time
        const eventDateTime = new Date(`${eventDate}T${eventTime}`);
        
        const eventData = {
            title: formData.get('title'),
            category: formData.get('category'),
            description: formData.get('description'),
            event_date: eventDateTime.toISOString(),
            location: formData.get('location'),
            organizer: formData.get('organizer'),
            contact_info: formData.get('contact_info'),
            registration_required: formData.get('registration_required') === 'on',
            max_attendees: formData.get('max_attendees') ? parseInt(formData.get('max_attendees')) : null,
            current_attendees: 0,
            status: formData.get('status')
        };
        
        // Validate required fields
        if (!eventData.title || !eventData.description || !eventData.category || 
            !eventData.event_date || !eventData.location || !eventData.organizer) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Validate date (must be in the future)
        if (eventDateTime <= new Date()) {
            showToast('Event date must be in the future', 'error');
            return;
        }
        
        // Save to Supabase
        let savedEvent;
        if (window.createEvent) {
            savedEvent = await window.createEvent(eventData);
        } else {
            // Fallback to mock creation
            savedEvent = createMockEvent(eventData);
        }
        
        if (savedEvent) {
            showToast('Event created successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createEventModal'));
            modal.hide();
            
            // Reload events data
            await loadEventsData();
        }
        
    } catch (error) {
        console.error('Error saving event:', error);
        showToast('Error saving event', 'error');
    }
}

// View event
function viewEvent(event) {
    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    
    // Update modal content
    const modalBody = document.getElementById('eventModalBody');
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="event-detail">
                <div class="event-header mb-3">
                    <h4>${event.title}</h4>
                    <div class="d-flex gap-2 mb-2">
                        <span class="badge bg-primary">${event.category}</span>
                        <span class="badge ${getStatusBadgeClass(event.status)}">${event.status}</span>
                        ${event.registration_required ? '<span class="badge bg-warning">Registration Required</span>' : ''}
                    </div>
                    <div class="text-muted small">
                        ${formatDate(event.event_date || event.eventDate)} at ${formatTime(event.event_date || event.eventDate)}
                    </div>
                </div>
                <div class="event-content mb-3">
                    ${event.description}
                </div>
                <div class="event-info mb-3">
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Location:</strong><br>
                            ${event.location}
                        </div>
                        <div class="col-md-6">
                            <strong>Organizer:</strong><br>
                            ${event.organizer}
                        </div>
                    </div>
                    ${event.contact_info ? `
                        <div class="mt-2">
                            <strong>Contact:</strong><br>
                            ${event.contact_info}
                        </div>
                    ` : ''}
                    ${event.registration_required ? `
                        <div class="mt-2">
                            <strong>Registration:</strong><br>
                            ${event.max_attendees ? 
                                `${event.current_attendees || 0} of ${event.max_attendees} spots filled` : 
                                'Registration required (no limit)'
                            }
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    modal.show();
}

// Edit event
function editEvent(event) {
    const modal = new bootstrap.Modal(document.getElementById('createEventModal'));
    
    // Update modal title
    const modalTitle = document.getElementById('createEventModalLabel');
    if (modalTitle) {
        modalTitle.textContent = 'Edit Upcoming Event';
    }
    
    // Update save button
    const saveBtn = document.getElementById('save-event-btn');
    if (saveBtn) {
        saveBtn.textContent = 'Update Event';
        saveBtn.onclick = async () => {
            await updateEvent(event.id);
        };
    }
    
    // Populate form with event data
    const form = document.getElementById('create-event-form');
    if (form) {
        form.querySelector('[name="title"]').value = event.title;
        form.querySelector('[name="category"]').value = event.category;
        form.querySelector('[name="description"]').value = event.description;
        
        // Split date and time
        const eventDate = new Date(event.event_date || event.eventDate);
        form.querySelector('[name="event_date"]').value = eventDate.toISOString().split('T')[0];
        form.querySelector('[name="event_time"]').value = eventDate.toTimeString().substring(0, 5);
        
        form.querySelector('[name="location"]').value = event.location;
        form.querySelector('[name="organizer"]').value = event.organizer;
        form.querySelector('[name="contact_info"]').value = event.contact_info || '';
        form.querySelector('[name="registration_required"]').checked = event.registration_required;
        form.querySelector('[name="max_attendees"]').value = event.max_attendees || '';
        form.querySelector('[name="status"]').value = event.status;
    }
    
    modal.show();
}

// Update event
async function updateEvent(eventId) {
    try {
        const form = document.getElementById('create-event-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const eventDate = formData.get('event_date');
        const eventTime = formData.get('event_time');
        
        // Combine date and time
        const eventDateTime = new Date(`${eventDate}T${eventTime}`);
        
        const eventData = {
            title: formData.get('title'),
            category: formData.get('category'),
            description: formData.get('description'),
            event_date: eventDateTime.toISOString(),
            location: formData.get('location'),
            organizer: formData.get('organizer'),
            contact_info: formData.get('contact_info'),
            registration_required: formData.get('registration_required') === 'on',
            max_attendees: formData.get('max_attendees') ? parseInt(formData.get('max_attendees')) : null,
            status: formData.get('status')
        };
        
        // Validate required fields
        if (!eventData.title || !eventData.description || !eventData.category || 
            !eventData.event_date || !eventData.location || !eventData.organizer) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Validate date (must be in the future)
        if (eventDateTime <= new Date()) {
            showToast('Event date must be in the future', 'error');
            return;
        }
        
        // Update in Supabase
        if (window.updateEvent) {
            await window.updateEvent(eventId, eventData);
        } else {
            // Fallback to mock update
            updateMockEvent(eventId, eventData);
        }
        
        showToast('Event updated successfully!', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createEventModal'));
        modal.hide();
        
        // Reload events data
        await loadEventsData();
        
    } catch (error) {
        console.error('Error updating event:', error);
        showToast('Error updating event', 'error');
    }
}

// Filter events
async function filterEvents(searchTerm = '') {
    try {
        const categoryFilter = document.getElementById('category-filter');
        const statusFilter = document.getElementById('status-filter');
        const registrationFilter = document.getElementById('registration-filter');
        
        const category = categoryFilter ? categoryFilter.value : '';
        const status = statusFilter ? statusFilter.value : '';
        const registration = registrationFilter ? registrationFilter.value : '';
        
        // Get all events data
        let eventsData = [];
        if (window.getUpcomingEvents) {
            eventsData = await window.getUpcomingEvents();
        } else {
            eventsData = getMockEventsData();
        }
        
        // Apply filters
        let filteredEvents = eventsData.filter(event => {
            // Category filter
            if (category && event.category !== category) return false;
            
            // Status filter
            if (status && event.status !== status) return false;
            
            // Registration filter
            if (registration) {
                if (registration === 'required' && !event.registration_required) return false;
                if (registration === 'not_required' && event.registration_required) return false;
            }
            
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return event.title.toLowerCase().includes(searchLower) ||
                       event.description.toLowerCase().includes(searchLower) ||
                       event.category.toLowerCase().includes(searchLower) ||
                       event.location.toLowerCase().includes(searchLower) ||
                       event.organizer.toLowerCase().includes(searchLower);
            }
            
            return true;
        });
        
        // Display filtered results
        displayEvents(filteredEvents);
        
    } catch (error) {
        console.error('Error filtering events:', error);
    }
}

// Load more events
async function loadMoreEvents() {
    // This would implement pagination in a real app
    // For now, just reload all data
    await loadEventsData();
}

// Show loading state
function showLoadingState() {
    const eventsGrid = document.getElementById('events-grid');
    if (eventsGrid) {
        eventsGrid.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading events...</p>
            </div>
        `;
    }
}

// Hide loading state
function hideLoadingState() {
    // Loading state is cleared when displayEvents is called
}

// Mock data functions (fallback when Supabase functions aren't available)
function getMockEventsData() {
    return [
        {
            id: 1,
            title: "Community Clean-up Day",
            category: "Community",
            description: "Join us for a day of community service and environmental awareness. We'll be cleaning up local parks and streets, planting trees, and promoting sustainable practices.",
            event_date: "2024-12-15T09:00:00Z",
            location: "City Park and surrounding areas",
            organizer: "City Environment Office",
            contact_info: "environment@city.gov | (555) 123-4567",
            registration_required: true,
            max_attendees: 100,
            current_attendees: 45,
            status: "upcoming",
            created_at: "2024-12-01T09:00:00Z",
            updated_at: "2024-12-01T09:00:00Z",
            is_active: true
        }
    ];
}

function createMockEvent(eventData) {
    return {
        id: Date.now(),
        ...eventData,
        current_attendees: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true
    };
}

function updateMockEvent(eventId, eventData) {
    // In a real app, this would update the database
    console.log('Mock update:', eventId, eventData);
    return true;
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(dateString) {
    if (!dateString) return 'Unknown time';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
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
