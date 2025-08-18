/**
 * LGU News Management
 * Handles news article creation, editing, and management for LGU users
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('LGU News Management initialized');
    
    // Initialize user data
    const user = await window.userUtils?.initializeUserData();
    if (!user) {
        console.error('User not authenticated');
        return;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial news data
    await loadNewsData();
});

// Setup event listeners
function setupEventListeners() {
    // Create news button
    const createNewsBtn = document.getElementById('create-news-btn');
    if (createNewsBtn) {
        createNewsBtn.addEventListener('click', () => {
            openCreateNewsModal();
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-news-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadNewsData();
        });
    }
    
    // Create first news button
    const createFirstBtn = document.getElementById('create-first-news');
    if (createFirstBtn) {
        createFirstBtn.addEventListener('click', () => {
            openCreateNewsModal();
        });
    }
    
    // Save news button
    const saveNewsBtn = document.getElementById('save-news-btn');
    if (saveNewsBtn) {
        saveNewsBtn.addEventListener('click', async () => {
            await saveNewsArticle();
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('news-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            await filterNews(e.target.value);
        }, 300));
    }
    
    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', async () => {
            await filterNews();
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', async () => {
            await filterNews();
        });
    }
    
    // Load more button
    const loadMoreBtn = document.getElementById('load-more-news');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            await loadMoreNews();
        });
    }
}

// Load news data
async function loadNewsData() {
    try {
        console.log('Loading news data...');
        
        // Show loading state
        showLoadingState();
        
        // Fetch news from Supabase
        let newsData = [];
        if (window.getNews) {
            newsData = await window.getNews();
        } else {
            // Fallback to mock data
            newsData = getMockNewsData();
        }
        
        // Display news
        displayNews(newsData);
        
        // Hide loading state
        hideLoadingState();
        
    } catch (error) {
        console.error('Error loading news data:', error);
        hideLoadingState();
        showToast('Error loading news data', 'error');
    }
}

// Display news articles
function displayNews(newsData) {
    const newsGrid = document.getElementById('news-grid');
    const noNewsMessage = document.getElementById('no-news-message');
    
    if (!newsGrid) return;
    
    // Clear existing content
    newsGrid.innerHTML = '';
    
    if (!newsData || newsData.length === 0) {
        // Show no news message
        if (noNewsMessage) {
            noNewsMessage.style.display = 'flex';
        }
        return;
    }
    
    // Hide no news message
    if (noNewsMessage) {
        noNewsMessage.style.display = 'none';
    }
    
    // Display news articles
    newsData.forEach(article => {
        const newsCard = createNewsCard(article);
        newsGrid.appendChild(newsCard);
    });
}

// Create news card
function createNewsCard(article) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-4';
    
    const card = document.createElement('div');
    card.className = 'card h-100';
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    
    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'd-flex justify-content-between align-items-start mb-2';
    
    const category = document.createElement('span');
    category.className = 'badge bg-primary';
    category.textContent = article.category;
    
    const status = document.createElement('span');
    status.className = `badge ${article.status === 'published' ? 'bg-success' : 'bg-warning'}`;
    status.textContent = article.status;
    
    cardHeader.appendChild(category);
    cardHeader.appendChild(status);
    
    // Title
    const title = document.createElement('h5');
    title.className = 'card-title';
    title.textContent = article.title;
    
    // Excerpt
    const excerpt = document.createElement('p');
    excerpt.className = 'card-text text-muted';
    excerpt.textContent = article.excerpt;
    
    // Meta info
    const meta = document.createElement('div');
    meta.className = 'd-flex justify-content-between align-items-center text-muted small';
    
    const author = document.createElement('span');
    author.textContent = `By ${article.author}`;
    
    const readTime = document.createElement('span');
    readTime.textContent = article.read_time || '5 min read';
    
    meta.appendChild(author);
    meta.appendChild(readTime);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'd-flex gap-2 mt-3';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-outline-primary';
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', () => {
        viewNewsArticle(article);
    });
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-outline-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
        editNewsArticle(article);
    });
    
    actions.appendChild(viewBtn);
    actions.appendChild(editBtn);
    
    // Assemble card
    cardBody.appendChild(cardHeader);
    cardBody.appendChild(title);
    cardBody.appendChild(excerpt);
    cardBody.appendChild(meta);
    cardBody.appendChild(actions);
    
    card.appendChild(cardBody);
    col.appendChild(card);
    
    return col;
}

// Open create news modal
function openCreateNewsModal() {
    const modal = new bootstrap.Modal(document.getElementById('createNewsModal'));
    modal.show();
    
    // Reset form
    const form = document.getElementById('create-news-form');
    if (form) {
        form.reset();
    }
    
    // Update modal title
    const modalTitle = document.getElementById('createNewsModalLabel');
    if (modalTitle) {
        modalTitle.textContent = 'Create News Article';
    }
    
    // Update save button
    const saveBtn = document.getElementById('save-news-btn');
    if (saveBtn) {
        saveBtn.textContent = 'Create Article';
        saveBtn.onclick = async () => {
            await saveNewsArticle();
        };
    }
}

// Save news article
async function saveNewsArticle() {
    try {
        const form = document.getElementById('create-news-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const articleData = {
            title: formData.get('title'),
            excerpt: formData.get('excerpt'),
            content: formData.get('content'),
            category: formData.get('category'),
            icon: formData.get('icon'),
            author: formData.get('author'),
            read_time: formData.get('read_time'),
            status: formData.get('status'),
            featured: formData.get('featured') === 'on',
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()) : [],
            image_url: formData.get('image_url')
        };
        
        // Validate required fields
        if (!articleData.title || !articleData.excerpt || !articleData.content || !articleData.category || !articleData.author) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Save to Supabase
        let savedArticle;
        if (window.createNewsArticle) {
            savedArticle = await window.createNewsArticle(articleData);
        } else {
            // Fallback to mock creation
            savedArticle = createMockNewsArticle(articleData);
        }
        
        if (savedArticle) {
            showToast('News article saved successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createNewsModal'));
            modal.hide();
            
            // Reload news data
            await loadNewsData();
        }
        
    } catch (error) {
        console.error('Error saving news article:', error);
        showToast('Error saving news article', 'error');
    }
}

// View news article
function viewNewsArticle(article) {
    const modal = new bootstrap.Modal(document.getElementById('newsModal'));
    
    // Update modal content
    const modalBody = document.getElementById('newsModalBody');
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="news-article">
                <div class="article-header mb-3">
                    <h4>${article.title}</h4>
                    <div class="d-flex gap-2 mb-2">
                        <span class="badge bg-primary">${article.category}</span>
                        <span class="badge ${article.status === 'published' ? 'bg-success' : 'bg-warning'}">${article.status}</span>
                        ${article.featured ? '<span class="badge bg-warning">Featured</span>' : ''}
                    </div>
                    <div class="text-muted small">
                        By ${article.author} • ${article.read_time || '5 min read'} • ${formatDate(article.created_at || article.createdAt)}
                    </div>
                </div>
                <div class="article-content">
                    ${article.content}
                </div>
                ${article.tags && article.tags.length > 0 ? `
                    <div class="article-tags mt-3">
                        <strong>Tags:</strong>
                        ${article.tags.map(tag => `<span class="badge bg-light text-dark me-1">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    modal.show();
}

// Edit news article
function editNewsArticle(article) {
    const modal = new bootstrap.Modal(document.getElementById('createNewsModal'));
    
    // Update modal title
    const modalTitle = document.getElementById('createNewsModalLabel');
    if (modalTitle) {
        modalTitle.textContent = 'Edit News Article';
    }
    
    // Update save button
    const saveBtn = document.getElementById('save-news-btn');
    if (saveBtn) {
        saveBtn.textContent = 'Update Article';
        saveBtn.onclick = async () => {
            await updateNewsArticle(article.id);
        };
    }
    
    // Populate form with article data
    const form = document.getElementById('create-news-form');
    if (form) {
        form.querySelector('[name="title"]').value = article.title;
        form.querySelector('[name="excerpt"]').value = article.excerpt;
        form.querySelector('[name="content"]').value = article.content;
        form.querySelector('[name="category"]').value = article.category;
        form.querySelector('[name="icon"]').value = article.icon || '';
        form.querySelector('[name="author"]').value = article.author;
        form.querySelector('[name="read_time"]').value = article.read_time || '';
        form.querySelector('[name="status"]').value = article.status;
        form.querySelector('[name="featured"]').checked = article.featured;
        form.querySelector('[name="tags"]').value = article.tags ? article.tags.join(', ') : '';
        form.querySelector('[name="image_url"]').value = article.image_url || '';
    }
    
    modal.show();
}

// Update news article
async function updateNewsArticle(articleId) {
    try {
        const form = document.getElementById('create-news-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const articleData = {
            title: formData.get('title'),
            excerpt: formData.get('excerpt'),
            content: formData.get('content'),
            category: formData.get('category'),
            icon: formData.get('icon'),
            author: formData.get('author'),
            read_time: formData.get('read_time'),
            status: formData.get('status'),
            featured: formData.get('featured') === 'on',
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()) : [],
            image_url: formData.get('image_url')
        };
        
        // Validate required fields
        if (!articleData.title || !articleData.excerpt || !articleData.content || !articleData.category || !articleData.author) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Update in Supabase
        if (window.updateNewsArticle) {
            await window.updateNewsArticle(articleId, articleData);
        } else {
            // Fallback to mock update
            updateMockNewsArticle(articleId, articleData);
        }
        
        showToast('News article updated successfully!', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createNewsModal'));
        modal.hide();
        
        // Reload news data
        await loadNewsData();
        
    } catch (error) {
        console.error('Error updating news article:', error);
        showToast('Error updating news article', 'error');
    }
}

// Filter news
async function filterNews(searchTerm = '') {
    try {
        const categoryFilter = document.getElementById('category-filter');
        const statusFilter = document.getElementById('status-filter');
        
        const category = categoryFilter ? categoryFilter.value : '';
        const status = statusFilter ? statusFilter.value : '';
        
        // Get all news data
        let newsData = [];
        if (window.getNews) {
            newsData = await window.getNews();
        } else {
            newsData = getMockNewsData();
        }
        
        // Apply filters
        let filteredNews = newsData.filter(article => {
            // Category filter
            if (category && article.category !== category) return false;
            
            // Status filter
            if (status && article.status !== status) return false;
            
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return article.title.toLowerCase().includes(searchLower) ||
                       article.excerpt.toLowerCase().includes(searchLower) ||
                       article.content.toLowerCase().includes(searchLower) ||
                       article.author.toLowerCase().includes(searchLower);
            }
            
            return true;
        });
        
        // Display filtered results
        displayNews(filteredNews);
        
    } catch (error) {
        console.error('Error filtering news:', error);
    }
}

// Load more news
async function loadMoreNews() {
    // This would implement pagination in a real app
    // For now, just reload all data
    await loadNewsData();
}

// Show loading state
function showLoadingState() {
    const newsGrid = document.getElementById('news-grid');
    if (newsGrid) {
        newsGrid.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading news articles...</p>
            </div>
        `;
    }
}

// Hide loading state
function hideLoadingState() {
    // Loading state is cleared when displayNews is called
}

// Mock data functions (fallback when Supabase functions aren't available)
function getMockNewsData() {
    return [
        {
            id: 1,
            title: "New Public Safety Initiative Launched",
            excerpt: "The city has launched a comprehensive public safety program focusing on community policing and emergency response improvements.",
            content: "The city has launched a comprehensive public safety program focusing on community policing and emergency response improvements. This initiative includes increased police presence in residential areas, community outreach programs, and enhanced emergency response protocols.",
            category: "Public Safety",
            icon: "fas fa-shield-alt",
            author: "City Communications Office",
            read_time: "5 min read",
            status: "published",
            featured: true,
            tags: ["public safety", "community", "police"],
            image_url: null,
            created_at: "2024-12-01T09:00:00Z",
            updated_at: "2024-12-01T09:00:00Z",
            published_at: "2024-12-01T09:00:00Z",
            view_count: 0,
            is_active: true
        }
    ];
}

function createMockNewsArticle(articleData) {
    return {
        id: Date.now(),
        ...articleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: articleData.status === 'published' ? new Date().toISOString() : null,
        view_count: 0,
        is_active: true
    };
}

function updateMockNewsArticle(articleId, articleData) {
    // In a real app, this would update the database
    console.log('Mock update:', articleId, articleData);
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
