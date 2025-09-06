// LGU News Management
document.addEventListener('DOMContentLoaded', async () => {
    console.log('LGU News Management initialized');
    
    // Check authentication
    const user = await checkAuth();
    if (!user) return;
    
    // Initialize news management
    initializeNewsManagement();
});

function initializeNewsManagement() {
    console.log('Initializing news management...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup button event listeners
    setupButtonEventListeners();
    
    // Load news articles
    loadNewsArticles();
}

function setupEventListeners() {
    // Add news button
    const addNewsBtn = document.getElementById('add-news-btn');
    if (addNewsBtn) {
        addNewsBtn.addEventListener('click', showAddNewsModal);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-news-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadNewsArticles);
    }
    
    // Filter functionality
    const priorityFilter = document.getElementById('priority-filter');
    const categoryFilter = document.getElementById('category-filter');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('news-search');
    
    if (priorityFilter) {
        priorityFilter.addEventListener('change', handleFilterChange);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleFilterChange);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', handleFilterChange);
    }
    if (searchInput) {
        searchInput.addEventListener('input', handleFilterChange);
    }
    
    // Modal close button
    const modalClose = document.getElementById('news-modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeNewsModal);
    }
}

async function loadNewsArticles() {
    try {
        console.log('Loading news articles...');
        
        // For now, use mock data to demonstrate the design
        // In the future, this would fetch from Supabase
        const mockNews = getMockNewsData();
        displayNewsArticles(mockNews);
        
    } catch (error) {
        console.error('Error loading news articles:', error);
        showToast('Error loading news articles', 'error');
    }
}

// Mock news data for demonstration
function getMockNewsData() {
    return [
        {
            id: 1,
            title: "Water Service Interruption",
            content: "Scheduled maintenance will interrupt water services in Zones 1-3. Residents are advised to store water for essential use.",
            category: "utilities",
            priority: "high",
            status: "published",
            publishDate: "2024-01-15T08:00:00",
            expiryDate: "2024-01-17T18:00:00",
            isUrgent: true
        },
        {
            id: 2,
            title: "Typhoon Preparedness Advisory",
            content: "Prepare emergency kits and follow LGU channels for updates. Stay informed about weather conditions.",
            category: "safety",
            priority: "critical",
            status: "published",
            publishDate: "2024-01-14T10:00:00",
            expiryDate: "2024-01-20T23:59:00",
            isUrgent: true
        },
        {
            id: 3,
            title: "Community Health Program",
            content: "Free health check-ups available at the community center every Saturday morning.",
            category: "announcement",
            priority: "medium",
            status: "published",
            publishDate: "2024-01-10T09:00:00",
            expiryDate: "2024-02-10T17:00:00",
            isUrgent: false
        },
        {
            id: 4,
            title: "Road Construction Update",
            content: "Main Street construction is progressing well. Expect minor delays during peak hours.",
            category: "update",
            priority: "low",
            status: "published",
            publishDate: "2024-01-12T14:00:00",
            expiryDate: "2024-01-25T18:00:00",
            isUrgent: false
        },
        {
            id: 5,
            title: "New Park Opening Ceremony",
            content: "Join us for the grand opening of the new community park this Saturday at 2 PM.",
            category: "event",
            priority: "medium",
            status: "draft",
            publishDate: "2024-01-20T14:00:00",
            expiryDate: "2024-01-20T18:00:00",
            isUrgent: false
        },
        {
            id: 6,
            title: "Power Outage Notice",
            content: "Scheduled power maintenance in the downtown area from 2 AM to 6 AM tomorrow.",
            category: "utilities",
            priority: "high",
            status: "published",
            publishDate: "2024-01-13T20:00:00",
            expiryDate: "2024-01-14T08:00:00",
            isUrgent: true
        }
    ];
}

// Display news articles in card format
function displayNewsArticles(newsArticles) {
    const newsGrid = document.getElementById('news-grid');
    const noNews = document.getElementById('no-news');
    
    if (!newsGrid) return;
    
    if (!newsArticles || newsArticles.length === 0) {
        showEmptyState();
        return;
    }
    
    // Clear existing content
    newsGrid.innerHTML = '';
    
    // Create news cards
    newsArticles.forEach(article => {
        const newsCard = createNewsCard(article);
        newsGrid.appendChild(newsCard);
    });
    
    // Show grid and hide empty state
    newsGrid.style.display = 'grid';
    if (noNews) noNews.style.display = 'none';
}

// Create individual news card
function createNewsCard(article) {
    const card = document.createElement('div');
    card.className = `news-card priority-${article.priority}`;
    
    const publishDate = new Date(article.publishDate).toLocaleDateString();
    const expiryDate = article.expiryDate ? new Date(article.expiryDate).toLocaleDateString() : 'No expiry';
    
    card.innerHTML = `
        <div class="news-card-header">
            <span class="news-priority-tag priority-${article.priority}">${article.priority}</span>
            <span class="news-status-tag status-${article.status}">${article.status}</span>
        </div>
        
        <h3>${article.title}</h3>
        
        <div class="news-content">${article.content}</div>
        
        <div class="news-card-meta">
            <span class="news-category">${article.category}</span>
            ${article.isUrgent ? '<div class="news-urgency"><i class="fas fa-exclamation-triangle"></i>Urgent</div>' : ''}
        </div>
        
        <div class="news-dates">
            <div><span class="date-label">From:</span> ${publishDate}</div>
            <div><span class="date-label">To:</span> ${expiryDate}</div>
        </div>
        
        <div class="news-card-actions">
            <button data-action="view-news-article" data-article-id="${article.id}">View</button>
            <button data-action="edit-news-article" data-article-id="${article.id}">Edit</button>
        </div>
    `;
    
    return card;
}

function showEmptyState() {
    const newsGrid = document.getElementById('news-grid');
    const noNews = document.getElementById('no-news');
    
    if (newsGrid) newsGrid.style.display = 'none';
    if (noNews) noNews.style.display = 'block';
}

function showNewsGrid() {
    const newsGrid = document.getElementById('news-grid');
    const noNews = document.getElementById('no-news');
    
    if (newsGrid) newsGrid.style.display = 'grid';
    if (noNews) noNews.style.display = 'none';
}

function showAddNewsModal() {
    const modal = document.getElementById('news-modal');
    if (modal) {
        modal.style.display = 'block';
        
        // Set default publish date to now
        const publishDateInput = document.getElementById('news-publish-date');
        if (publishDateInput) {
            const now = new Date();
            const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            publishDateInput.value = localDateTime.toISOString().slice(0, 16);
        }
    }
}

function closeNewsModal() {
    const modal = document.getElementById('news-modal');
    if (modal) {
        modal.style.display = 'none';
    
    // Reset form
        const form = document.getElementById('news-form');
    if (form) {
        form.reset();
    }
    }
}

async function saveNews() {
    try {
        const form = document.getElementById('news-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const newsData = {
            title: formData.get('title'),
            category: formData.get('category'),
            priority: formData.get('priority'),
            status: formData.get('status'),
            content: formData.get('content'),
            publishDate: formData.get('publishDate'),
            expiryDate: formData.get('expiryDate'),
            image: formData.get('image')
        };
        
        // Validate required fields
        if (!newsData.title || !newsData.category || !newsData.priority || !newsData.status || !newsData.content || !newsData.publishDate) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        console.log('Saving news article:', newsData);
        
        // TODO: Save to Supabase
        // For now, just show success message
        showToast('News article saved successfully!', 'success');
        
        // Close modal
        closeNewsModal();
        
        // Reload news articles
        loadNewsArticles();
        
    } catch (error) {
        console.error('Error saving news article:', error);
        showToast('Error saving news article', 'error');
    }
}

// Handle filter changes
function handleFilterChange() {
    const priorityFilter = document.getElementById('priority-filter').value;
    const categoryFilter = document.getElementById('category-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const searchInput = document.getElementById('news-search').value.toLowerCase();
    
    const allNews = getMockNewsData();
    let filteredNews = allNews;
    
    // Apply filters
    if (priorityFilter) {
        filteredNews = filteredNews.filter(article => article.priority === priorityFilter);
    }
    
    if (categoryFilter) {
        filteredNews = filteredNews.filter(article => article.category === categoryFilter);
    }
    
    if (statusFilter) {
        filteredNews = filteredNews.filter(article => article.status === statusFilter);
    }
    
    if (searchInput) {
        filteredNews = filteredNews.filter(article => 
            article.title.toLowerCase().includes(searchInput) ||
            article.content.toLowerCase().includes(searchInput)
        );
    }
    
    displayNewsArticles(filteredNews);
}

// View news article
function viewNewsArticle(id) {
    const allNews = getMockNewsData();
    const article = allNews.find(a => a.id === id);
    if (article) {
        alert(`Viewing: ${article.title}\n\n${article.content}`);
    }
}

// Edit news article
function editNewsArticle(id) {
    const allNews = getMockNewsData();
    const article = allNews.find(a => a.id === id);
    if (article) {
        // Populate form with article data
        document.getElementById('news-title').value = article.title;
        document.getElementById('news-category').value = article.category;
        document.getElementById('news-priority').value = article.priority;
        document.getElementById('news-status').value = article.status;
        document.getElementById('news-content').value = article.content;
        document.getElementById('news-publish-date').value = article.publishDate;
        document.getElementById('news-expiry-date').value = article.expiryDate;
        
        // Show modal
        showAddNewsModal();
    }
}

// Toast notification function (if not already available)
function showToast(message, type = 'success') {
    // Check if toast function exists globally
    if (window.showToast) {
        window.showToast(message, type);
        } else {
        // Fallback toast
        alert(`${type.toUpperCase()}: ${message}`);
    }
}

// Check auth function (avoid recursive self-calls)
async function checkAuth() {
    // If a different global checkAuth is available (e.g., from auth-check.js), use it
    if (window.checkAuth && window.checkAuth !== checkAuth) {
        return await window.checkAuth();
    }
    // Fallback auth check from sessionStorage
    const userData = sessionStorage.getItem('user');
    if (userData) {
        return JSON.parse(userData);
    }
    return null;
}

// Setup button event listeners
function setupButtonEventListeners() {
    // Use event delegation for dynamically created buttons
    document.addEventListener('click', (e) => {
        // Handle view news article button
        if (e.target.matches('[data-action="view-news-article"]') || e.target.closest('[data-action="view-news-article"]')) {
            const button = e.target.closest('[data-action="view-news-article"]');
            const articleId = button.getAttribute('data-article-id');
            viewNewsArticle(articleId);
        }
        
        // Handle edit news article button
        if (e.target.matches('[data-action="edit-news-article"]') || e.target.closest('[data-action="edit-news-article"]')) {
            const button = e.target.closest('[data-action="edit-news-article"]');
            const articleId = button.getAttribute('data-article-id');
            editNewsArticle(articleId);
        }
        
        // Handle show add news modal button
        if (e.target.matches('#show-add-news-modal-btn') || e.target.closest('#show-add-news-modal-btn')) {
            showAddNewsModal();
        }
    });
}
