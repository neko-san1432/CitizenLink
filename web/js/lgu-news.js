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
    
    // Load news articles
    loadNewsArticles();
}

function setupEventListeners() {
    // Add news button
    const addNewsBtn = document.getElementById('add-news-btn');
    if (addNewsBtn) {
        addNewsBtn.addEventListener('click', showAddNewsModal);
    }
    
    // Search functionality
    const searchInput = document.getElementById('news-search');
    if (searchInput) {
        searchInput.addEventListener('input', handleNewsSearch);
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
        
        // For now, show empty state
        // In the future, this would fetch from Supabase
        showEmptyState();
        
    } catch (error) {
        console.error('Error loading news articles:', error);
        showToast('Error loading news articles', 'error');
    }
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
            content: formData.get('content'),
            publishDate: formData.get('publishDate'),
            image: formData.get('image')
        };
        
        // Validate required fields
        if (!newsData.title || !newsData.category || !newsData.content || !newsData.publishDate) {
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

function handleNewsSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    console.log('Searching for:', searchTerm);
    
    // TODO: Implement search functionality
    // This would filter the news articles based on the search term
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

// Check auth function (if not already available)
async function checkAuth() {
    // Check if checkAuth function exists globally
    if (window.checkAuth) {
        return await window.checkAuth();
        } else {
        // Fallback auth check
        const userData = sessionStorage.getItem('user');
        if (userData) {
            return JSON.parse(userData);
        }
        return null;
    }
}
