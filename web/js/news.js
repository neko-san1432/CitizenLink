document.addEventListener('DOMContentLoaded', async () => {
  
  
  // Get user
  const user = await checkAuth();
  
  
  if (!user) {
    
    window.location.href = '/login';
    return;
  }
  
  // Update user info
  updateUserInfo(user);
  
  // Load news
  loadNews();
  
  // Setup event listeners
  setupEventListeners();
});

// Load news from Supabase
async function loadNews() {
  try {
  const newsGrid = document.getElementById('news-grid');
    if (!newsGrid) return;
  
    // Get live news data from Supabase
    const newsData = await window.getNews();
  
  // Clear existing content
  newsGrid.innerHTML = '';
  
    if (!newsData || newsData.length === 0) {
      // Show "No data available yet" message
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-news-state';
      emptyState.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-newspaper fa-4x text-muted mb-4"></i>
          <h3 class="text-muted">No news available yet</h3>
          <p class="text-muted mb-4">There are no news articles published at the moment.</p>
          <p class="text-muted">Check back later for updates from your local government.</p>
        </div>
      `;
      newsGrid.appendChild(emptyState);
      return;
    }
  
  // Create news cards
    newsData.forEach(news => {
    const newsCard = createNewsCard(news);
    newsGrid.appendChild(newsCard);
  });
  
    
  } catch (error) {
    console.error('Error loading news:', error);
    
    // Show error state
    const errorState = document.createElement('div');
    errorState.className = 'error-news-state';
    errorState.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-exclamation-triangle fa-4x text-warning mb-4"></i>
        <h3 class="text-warning">Error loading news</h3>
        <p class="text-muted mb-4">Unable to load news articles. Please try again later.</p>
        <button class="btn btn-outline-warning" onclick="loadNews()">
          <i class="fas fa-redo"></i> Try Again
        </button>
      </div>
    `;
    
    const newsGrid = document.getElementById('news-grid');
    if (newsGrid) {
      newsGrid.innerHTML = '';
      newsGrid.appendChild(errorState);
    }
  }
}

// Create a news card element
function createNewsCard(news) {
  
  
  const col = document.createElement('div');
  col.className = 'col-md-6 col-lg-4 mb-4';
  
  // Handle different date field names and format date
  const dateField = news.date || news.created_at || news.published_at;
  const formattedDate = dateField ? formatDate(dateField) : 'No date';
  
  // Handle different category field names
  const category = news.category || 'General';
  
  // Handle different icon field names
  const icon = news.icon || 'fas fa-newspaper';
  
  // Handle different author field names
  const author = news.author || 'City Communications';
  
  // Handle different read time field names
  const readTime = news.read_time || news.readTime || '5 min read';
  
  const cardHTML = `
    <div class="news-card h-100">
      <div class="news-image">
        <i class="${icon}"></i>
      </div>
      <div class="news-content">
        <div class="news-date">${formattedDate}</div>
        <div class="news-tag">${category}</div>
        <h4 class="news-title">${news.title || 'Untitled'}</h4>
        <p class="news-excerpt">${news.excerpt || 'No excerpt available'}</p>
        <div class="news-meta">
          <small class="text-muted">
            <i class="fas fa-user me-1"></i>${author}
          </small>
          <small class="text-muted ms-3">
            <i class="fas fa-clock me-1"></i>${readTime}
          </small>
        </div>
        <button class="news-read-more" onclick="showNewsDetails(${news.id})">
          Read Full Article
          <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `;
  
  col.innerHTML = cardHTML;
  
  
  
  
  return col;
}

// Make showNewsDetails globally accessible
window.showNewsDetails = showNewsDetails;

// Show news details in modal
async function showNewsDetails(newsId) {
  
  
  try {
    // Get the specific news article from Supabase
    const news = await window.getComplaintById ? await window.getComplaintById(newsId) : null;
    
  if (!news) {
    console.error('News not found for ID:', newsId);
      // Show error message to user
      alert('News article not found. Please try again.');
    return;
  }
  
  
  
  const modal = document.getElementById('newsModal');
  const modalTitle = document.getElementById('newsModalLabel');
  const modalBody = document.getElementById('newsModalBody');
  
  if (!modal || !modalTitle || !modalBody) {
    console.error('Modal elements not found:', { modal, modalTitle, modalBody });
    return;
  }
  
    modalTitle.textContent = news.title || 'Untitled';
    
    // Handle different content field names and provide fallback
    const content = news.content || news.excerpt || 'No content available for this article.';
    
    modalBody.innerHTML = `
      <div class="news-article">
        <div class="article-header mb-4">
          <div class="article-meta">
            <span class="badge bg-primary">${news.category || 'General'}</span>
            <span class="text-muted ms-2">${formatDate(news.created_at || news.date || news.published_at)}</span>
          </div>
        </div>
        
        <p class="lead">${news.excerpt || 'No excerpt available.'}</p>
        
        <div class="article-content">
          ${content}
        </div>
        
        <div class="article-footer mt-4 pt-3 border-top">
          <small class="text-muted">
            <i class="fas fa-user me-1"></i>${news.author || 'City Communications'}
            <span class="ms-3">
              <i class="fas fa-clock me-1"></i>${news.read_time || news.readTime || '5 min read'}
            </span>
          </small>
        </div>
      </div>
    `;
  
  
  
  try {
    // Show modal using Bootstrap
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
  } catch (error) {
    console.error('Error showing modal:', error);
    // Fallback: show content in alert for debugging
      alert(`Error showing modal: ${error.message}\n\nNews Title: ${news.title}\n\nContent: ${content.substring(0, 200)}...`);
    }
  } catch (error) {
    console.error('Error fetching news details:', error);
    alert('Error loading news details. Please try again.');
  }
}

// Filter news by category
async function filterNewsByCategory(category) {
  try {
    let filteredNews = [];
    
  if (!category) {
      // Get all news
      filteredNews = await window.getNews();
    } else {
      // Get news by category from Supabase
      if (window.getNewsByCategory) {
        filteredNews = await window.getNewsByCategory(category);
  } else {
        // Fallback: filter from all news
        const allNews = await window.getNews();
        filteredNews = allNews.filter(news => news.category === category);
      }
    }
    
    // Display filtered news
    displayFilteredNews(filteredNews);
  } catch (error) {
    console.error('Error filtering news:', error);
    // Show error state
    const newsGrid = document.getElementById('news-grid');
    if (newsGrid) {
      newsGrid.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="fas fa-exclamation-triangle fa-4x text-warning mb-4"></i>
          <h3 class="text-warning">Error filtering news</h3>
          <p class="text-muted mb-4">Unable to filter news articles. Please try again.</p>
          <button class="btn btn-outline-warning" onclick="loadNews()">
            <i class="fas fa-redo"></i> Load All News
          </button>
        </div>
      `;
    }
  }
}

// Search news articles
async function searchNews(query) {
  try {
  if (!query.trim()) {
      // If no query, load all news
      await loadNews();
      return;
    }
    
    // Get all news and filter by search term
    const allNews = await window.getNews();
    const searchTerm = query.toLowerCase();
    
    const filteredNews = allNews.filter(news => 
      (news.title && news.title.toLowerCase().includes(searchTerm)) ||
      (news.excerpt && news.excerpt.toLowerCase().includes(searchTerm)) ||
      (news.content && news.content.toLowerCase().includes(searchTerm)) ||
      (news.category && news.category.toLowerCase().includes(searchTerm))
    );
    
    // Display filtered news
    displayFilteredNews(filteredNews);
  } catch (error) {
    console.error('Error searching news:', error);
    // Show error state
    const newsGrid = document.getElementById('news-grid');
    if (newsGrid) {
      newsGrid.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="fas fa-exclamation-triangle fa-4x text-warning mb-4"></i>
          <h3 class="text-warning">Error searching news</h3>
          <p class="text-muted mb-4">Unable to search news articles. Please try again.</p>
          <button class="btn btn-outline-warning" onclick="loadNews()">
            <i class="fas fa-redo"></i> Load All News
          </button>
        </div>
      `;
    }
  }
}

// Display filtered news
function displayFilteredNews(newsData) {
  const newsGrid = document.getElementById('news-grid');
  if (!newsGrid) return;
  
  // Clear existing content
  newsGrid.innerHTML = '';
  
  if (!newsData || newsData.length === 0) {
    // Show "No results" message
    const noResults = document.createElement('div');
    noResults.className = 'col-12 text-center py-5';
    noResults.innerHTML = `
      <i class="fas fa-search fa-4x text-muted mb-4"></i>
      <h3 class="text-muted">No news found</h3>
      <p class="text-muted mb-4">No news articles match your search criteria.</p>
      <button class="btn btn-outline-primary" onclick="loadNews()">
        <i class="fas fa-redo"></i> Show All News
      </button>
    `;
    newsGrid.appendChild(noResults);
    return;
  }
  
  // Create news cards
  newsData.forEach(news => {
    const newsCard = createNewsCard(news);
    newsGrid.appendChild(newsCard);
  });
}

// Load more news (not needed for live data, but keeping for compatibility)
function loadMoreNews() {
  // For live data, we can implement pagination if needed
  // For now, just reload all news
  loadNews();
}

// Setup event listeners
function setupEventListeners() {
  // Search functionality
  const searchInput = document.getElementById('news-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchNews(e.target.value);
    });
  }
  
  // Category filter
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      filterNewsByCategory(e.target.value);
    });
  }
  
  // Refresh button
  const refreshButton = document.getElementById('refresh-news');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      loadNews();
      showToast('News refreshed successfully!', 'success');
    });
  }
  
  // Load more button
  const loadMoreButton = document.getElementById('load-more-news');
  if (loadMoreButton) {
    loadMoreButton.addEventListener('click', loadMoreNews);
  }
}

// Update user information
function updateUserInfo(user) {
  const headerUserName = document.getElementById('header-user-name');
  if (headerUserName && user.name) {
    headerUserName.textContent = user.name;
  }
}

// Format date helper function
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
}

// Show toast message
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}
