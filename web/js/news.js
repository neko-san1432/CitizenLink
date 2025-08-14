document.addEventListener('DOMContentLoaded', () => {
  console.log('News page loaded, checking authentication...');
  
  // Get user
  const user = checkAuth();
  console.log('Auth check returned user:', user);
  
  if (!user) {
    console.log('No user found, creating mock user for testing...');
    // Create a mock user for testing purposes
    const mockUser = {
      username: 'citizen-user',
      name: 'John Citizen',
      type: 'citizen'
    };
    sessionStorage.setItem('user', JSON.stringify(mockUser));
    console.log('Mock user created:', mockUser);
    
    // Use the mock user
    updateUserInfo(mockUser);
    loadNews();
    setupEventListeners();
    return;
  }
  
  // Update user info
  updateUserInfo(user);
  
  // Load news
  loadNews();
  
  // Setup event listeners
  setupEventListeners();
});

// News data with full article content
const newsData = [
  {
    id: 1,
    title: "New Public Safety Initiative Launched",
    excerpt: "The city has launched a comprehensive public safety program focusing on community policing and emergency response improvements.",
    content: `
      <div class="news-article">
        <div class="article-header mb-4">
          <div class="article-meta">
            <span class="badge bg-primary">Public Safety</span>
            <span class="text-muted ms-2">December 1, 2024</span>
          </div>
        </div>
        
        <p class="lead">The city government has officially launched a groundbreaking public safety initiative aimed at strengthening community-police relations and enhancing emergency response capabilities across all neighborhoods.</p>
        
        <h4>Key Components of the Initiative</h4>
        <ul>
          <li><strong>Community Policing Program:</strong> Officers will now spend dedicated time in neighborhoods, building relationships with residents and business owners.</li>
          <li><strong>Enhanced Emergency Response:</strong> New equipment and training for first responders to improve response times and effectiveness.</li>
          <li><strong>Neighborhood Watch Support:</strong> Increased funding and resources for community-based safety programs.</li>
          <li><strong>Technology Integration:</strong> Implementation of smart city technologies for better crime prevention and monitoring.</li>
        </ul>
        
        <h4>Expected Impact</h4>
        <p>This initiative is projected to reduce response times by 25% and increase community satisfaction with public safety services by 40% within the first year of implementation.</p>
        
        <h4>Community Involvement</h4>
        <p>Residents are encouraged to participate in upcoming town hall meetings and community safety workshops. The city will also be launching a new mobile app for reporting non-emergency issues and receiving safety updates.</p>
        
        <div class="article-footer mt-4 pt-3 border-top">
          <small class="text-muted">For more information, contact the Public Safety Department at (555) 123-4567 or visit cityhall.gov/safety</small>
        </div>
      </div>
    `,
    date: "2024-12-01",
    category: "Public Safety",
    icon: "fas fa-shield-alt",
    author: "City Communications Office",
    readTime: "5 min read"
  },
  {
    id: 2,
    title: "Infrastructure Development Project Announced",
    excerpt: "Major road improvements and bridge repairs scheduled to begin in Q1 2025, improving connectivity across the city.",
    content: `
      <div class="news-article">
        <div class="article-header mb-4">
          <div class="article-meta">
            <span class="badge bg-success">Infrastructure</span>
            <span class="text-muted ms-2">November 28, 2024</span>
          </div>
        </div>
        
        <p class="lead">The Department of Public Works has announced a comprehensive infrastructure development project that will transform the city's transportation network and improve the quality of life for all residents.</p>
        
        <h4>Project Overview</h4>
        <p>The $15 million project will focus on three main areas:</p>
        <ol>
          <li><strong>Road Rehabilitation:</strong> Complete resurfacing of 25 major arterial roads and 50 residential streets</li>
          <li><strong>Bridge Maintenance:</strong> Structural repairs and upgrades to 8 critical bridges</li>
          <li><strong>Traffic Management:</strong> Installation of smart traffic signals and improved signage</li>
        </ol>
        
        <h4>Timeline and Phases</h4>
        <p>The project will be executed in three phases over 18 months:</p>
        <ul>
          <li><strong>Phase 1 (Q1 2025):</strong> North district road improvements</li>
          <li><strong>Phase 2 (Q2-Q3 2025):</strong> Central district and bridge repairs</li>
          <li><strong>Phase 3 (Q4 2025):</strong> South district and final touches</li>
        </ul>
        
        <h4>Traffic Management</h4>
        <p>During construction, temporary traffic patterns will be implemented. The city will provide real-time updates through the official website and mobile app to minimize inconvenience to commuters.</p>
        
        <div class="article-footer mt-4 pt-3 border-top">
          <small class="text-muted">Project updates available at cityhall.gov/infrastructure or call (555) 987-6543</small>
        </div>
      </div>
    `,
    date: "2024-11-28",
    category: "Infrastructure",
    icon: "fas fa-road",
    author: "Department of Public Works",
    readTime: "7 min read"
  },
  {
    id: 3,
    title: "Environmental Protection Measures",
    excerpt: "New recycling programs and green energy initiatives to be implemented city-wide, promoting sustainability.",
    content: `
      <div class="news-article">
        <div class="article-header mb-4">
          <div class="article-meta">
            <span class="badge bg-info">Environment</span>
            <span class="text-muted ms-2">November 25, 2024</span>
          </div>
        </div>
        
        <p class="lead">In response to growing environmental concerns and the city's commitment to sustainability, Mayor Johnson has announced a comprehensive environmental protection plan that will make our city a leader in green initiatives.</p>
        
        <h4>Green Energy Implementation</h4>
        <p>The city will transition to 100% renewable energy sources by 2030, starting with:</p>
        <ul>
          <li>Solar panel installation on all municipal buildings</li>
          <li>Wind energy partnerships with neighboring communities</li>
          <li>Energy-efficient LED street lighting replacement</li>
          <li>Electric vehicle charging station network expansion</li>
        </ul>
        
        <h4>Enhanced Recycling Programs</h4>
        <p>New recycling initiatives include:</p>
        <ul>
          <li>Curbside composting for organic waste</li>
          <li>Electronic waste collection events</li>
          <li>Plastic reduction campaigns</li>
          <li>Reusable shopping bag incentives</li>
        </ul>
        
        <h4>Community Engagement</h4>
        <p>Residents can participate in the city's environmental goals through:</p>
        <ul>
          <li>Community garden programs</li>
          <li>Tree planting initiatives</li>
          <li>Environmental education workshops</li>
          <li>Volunteer clean-up events</li>
        </ul>
        
        <div class="article-footer mt-4 pt-3 border-top">
          <small class="text-muted">Join the green movement at cityhall.gov/environment or call (555) 456-7890</small>
        </div>
      </div>
    `,
    date: "2024-11-25",
    category: "Environment",
    icon: "fas fa-leaf",
    author: "Environmental Protection Office",
    readTime: "6 min read"
  },
  {
    id: 4,
    title: "Community Health Services Expansion",
    excerpt: "Additional health clinics and vaccination centers opening in underserved neighborhoods.",
    content: `
      <div class="news-article">
        <div class="article-header mb-4">
          <div class="article-meta">
            <span class="badge bg-warning">Health</span>
            <span class="text-muted ms-2">November 22, 2024</span>
          </div>
        </div>
        
        <p class="lead">The Health Department has announced a major expansion of community health services, bringing essential medical care closer to residents in underserved areas of the city.</p>
        
        <h4>New Health Facilities</h4>
        <p>Three new community health centers will open in the following locations:</p>
        <ul>
          <li><strong>Northside Community Health Center:</strong> 123 North Avenue</li>
          <li><strong>Eastside Family Clinic:</strong> 456 East Street</li>
          <li><strong>Westside Health Hub:</strong> 789 West Boulevard</li>
        </ul>
        
        <h4>Services Offered</h4>
        <p>Each center will provide comprehensive health services including:</p>
        <ul>
          <li>Primary care and preventive medicine</li>
          <li>Vaccination and immunization services</li>
          <li>Mental health counseling</li>
          <li>Dental care</li>
          <li>Women's health services</li>
          <li>Pediatric care</li>
        </ul>
        
        <h4>Accessibility Features</h4>
        <p>All facilities are designed with accessibility in mind, featuring:</p>
        <ul>
          <li>Wheelchair-accessible entrances and facilities</li>
          <li>Multilingual staff and signage</li>
          <li>Extended hours for working families</li>
          <li>Sliding scale payment options</li>
        </ul>
        
        <div class="article-footer mt-4 pt-3 border-top">
          <small class="text-muted">Schedule appointments at cityhealth.gov or call (555) 321-0987</small>
        </div>
      </div>
    `,
    date: "2024-11-22",
    category: "Health",
    icon: "fas fa-heartbeat",
    author: "Health Department",
    readTime: "8 min read"
  },
  {
    id: 5,
    title: "Digital Services Modernization",
    excerpt: "City services going digital with new online portals for permits, payments, and information requests.",
    content: `
      <div class="news-article">
        <div class="article-header mb-4">
          <div class="article-meta">
            <span class="badge bg-secondary">Technology</span>
            <span class="text-muted ms-2">November 20, 2024</span>
          </div>
        </div>
        
        <p class="lead">The city is embarking on a comprehensive digital transformation that will modernize all government services and make them more accessible to residents through innovative technology solutions.</p>
        
        <h4>New Digital Platforms</h4>
        <p>The modernization includes several new digital platforms:</p>
        <ul>
          <li><strong>CitizenLink Portal:</strong> One-stop access to all city services</li>
          <li><strong>Mobile App:</strong> On-the-go access to city information and services</li>
          <li><strong>Online Payment System:</strong> Secure payment for taxes, permits, and fines</li>
          <li><strong>Digital Permitting:</strong> Streamlined application and approval process</li>
        </ul>
        
        <h4>Benefits for Residents</h4>
        <p>This digital transformation will provide:</p>
        <ul>
          <li>24/7 access to city services</li>
          <li>Reduced wait times for permits and approvals</li>
          <li>Paperless transactions and record-keeping</li>
          <li>Real-time updates on service requests</li>
          <li>Improved transparency and accountability</li>
        </ul>
        
        <h4>Implementation Timeline</h4>
        <p>The rollout will occur in phases:</p>
        <ul>
          <li><strong>Phase 1 (December 2024):</strong> Basic online services</li>
          <li><strong>Phase 2 (January 2025):</strong> Mobile app launch</li>
          <li><strong>Phase 3 (February 2025):</strong> Advanced features</li>
        </ul>
        
        <div class="article-footer mt-4 pt-3 border-top">
          <small class="text-muted">Learn more at cityhall.gov/digital or call (555) 654-3210</small>
        </div>
      </div>
    `,
    date: "2024-11-20",
    category: "Technology",
    icon: "fas fa-laptop",
    author: "Information Technology Department",
    readTime: "9 min read"
  },
  {
    id: 6,
    title: "Youth Development Programs",
    excerpt: "New after-school programs and youth centers opening to support young people's development and education.",
    content: `
      <div class="news-article">
        <div class="article-header mb-4">
          <div class="article-meta">
            <span class="badge bg-danger">Education</span>
            <span class="text-muted ms-2">November 18, 2024</span>
          </div>
        </div>
        
        <p class="lead">The city is investing in the future by launching comprehensive youth development programs designed to provide young people with the skills, support, and opportunities they need to succeed in life.</p>
        
        <h4>New Youth Centers</h4>
        <p>Three state-of-the-art youth centers will open across the city:</p>
        <ul>
          <li><strong>Downtown Youth Hub:</strong> Focus on arts, culture, and leadership</li>
          <li><strong>Community Youth Center:</strong> Emphasis on sports and recreation</li>
          <li><strong>Learning and Innovation Center:</strong> STEM education and career preparation</li>
        </ul>
        
        <h4>Program Offerings</h4>
        <p>Each center will offer diverse programs including:</p>
        <ul>
          <li>Academic tutoring and homework help</li>
          <li>Career exploration and job training</li>
          <li>Arts and music classes</li>
          <li>Sports and fitness programs</li>
          <li>Leadership development workshops</li>
          <li>Mental health and wellness support</li>
        </ul>
        
        <h4>Partnerships</h4>
        <p>The program is made possible through partnerships with:</p>
        <ul>
          <li>Local school districts</li>
          <li>Community organizations</li>
          <li>Business leaders and mentors</li>
          <li>Higher education institutions</li>
        </ul>
        
        <div class="article-footer mt-4 pt-3 border-top">
          <small class="text-muted">Register for programs at cityyouth.gov or call (555) 789-0123</small>
        </div>
      </div>
    `,
    date: "2024-11-18",
    category: "Education",
    icon: "fas fa-graduation-cap",
    author: "Youth Development Office",
    readTime: "7 min read"
  }
];

let currentNews = [...newsData];
let displayedNews = [];
let currentPage = 1;
const newsPerPage = 6;

// Load news articles
function loadNews() {
  console.log('loadNews() called');
  const newsGrid = document.getElementById('news-grid');
  if (!newsGrid) {
    console.error('News grid not found');
    return;
  }
  
  console.log('Clearing news grid and loading news...');
  
  // Clear existing content
  newsGrid.innerHTML = '';
  
  // Get news for current page
  const startIndex = (currentPage - 1) * newsPerPage;
  const endIndex = startIndex + newsPerPage;
  const pageNews = currentNews.slice(startIndex, endIndex);
  
  console.log('News to display:', pageNews);
  
  // Create news cards
  pageNews.forEach((news, index) => {
    console.log(`Creating news card ${index + 1}:`, news.title);
    const newsCard = createNewsCard(news);
    newsGrid.appendChild(newsCard);
  });
  
  console.log('News cards created and added to grid');
  
  // Show/hide load more button
  const loadMoreContainer = document.getElementById('load-more-container');
  if (endIndex < currentNews.length) {
    loadMoreContainer.style.display = 'block';
  } else {
    loadMoreContainer.style.display = 'none';
  }
  
  // Show/hide no results message
  const noResults = document.getElementById('no-results');
  if (currentNews.length === 0) {
    noResults.style.display = 'block';
  } else {
    noResults.style.display = 'none';
  }
}

// Create a news card element
function createNewsCard(news) {
  console.log('Creating news card for:', news.title);
  
  const col = document.createElement('div');
  col.className = 'col-md-6 col-lg-4 mb-4';
  
  const formattedDate = formatDate(news.date);
  
  const cardHTML = `
    <div class="news-card h-100">
      <div class="news-image">
        <i class="${news.icon}"></i>
      </div>
      <div class="news-content">
        <div class="news-date">${formattedDate}</div>
        <div class="news-tag">${news.category}</div>
        <h4 class="news-title">${news.title}</h4>
        <p class="news-excerpt">${news.excerpt}</p>
        <div class="news-meta">
          <small class="text-muted">
            <i class="fas fa-user me-1"></i>${news.author}
          </small>
          <small class="text-muted ms-3">
            <i class="fas fa-clock me-1"></i>${news.readTime}
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
  
  console.log('News card HTML created:', cardHTML);
  console.log('News card element created:', col);
  
  return col;
}

// Make showNewsDetails globally accessible
window.showNewsDetails = showNewsDetails;

// Show news details in modal
function showNewsDetails(newsId) {
  console.log('showNewsDetails called with ID:', newsId);
  
  const news = newsData.find(n => n.id === newsId);
  if (!news) {
    console.error('News not found for ID:', newsId);
    return;
  }
  
  console.log('Found news:', news);
  
  const modal = document.getElementById('newsModal');
  const modalTitle = document.getElementById('newsModalLabel');
  const modalBody = document.getElementById('newsModalBody');
  
  if (!modal || !modalTitle || !modalBody) {
    console.error('Modal elements not found:', { modal, modalTitle, modalBody });
    return;
  }
  
  modalTitle.textContent = news.title;
  modalBody.innerHTML = news.content;
  
  console.log('Modal content set, attempting to show modal...');
  
  try {
    // Show modal using Bootstrap
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    console.log('Modal shown successfully');
  } catch (error) {
    console.error('Error showing modal:', error);
    // Fallback: show content in alert for debugging
    alert(`Error showing modal: ${error.message}\n\nNews Title: ${news.title}\n\nContent: ${news.content.substring(0, 200)}...`);
  }
}

// Filter news by category
function filterNewsByCategory(category) {
  if (!category) {
    currentNews = [...newsData];
  } else {
    currentNews = newsData.filter(news => news.category === category);
  }
  
  currentPage = 1;
  loadNews();
}

// Search news articles
function searchNews(query) {
  if (!query.trim()) {
    currentNews = [...newsData];
  } else {
    const searchTerm = query.toLowerCase();
    currentNews = newsData.filter(news => 
      news.title.toLowerCase().includes(searchTerm) ||
      news.excerpt.toLowerCase().includes(searchTerm) ||
      news.content.toLowerCase().includes(searchTerm) ||
      news.category.toLowerCase().includes(searchTerm)
    );
  }
  
  currentPage = 1;
  loadNews();
}

// Load more news
function loadMoreNews() {
  currentPage++;
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
      currentNews = [...newsData];
      currentPage = 1;
      loadNews();
      showToast('News refreshed successfully!', 'success');
    });
  }
  
  // Load more button
  const loadMoreButton = document.getElementById('load-more-news');
  if (loadMoreButton) {
    loadMoreButton.addEventListener('click', loadMoreNews);
  }
  
  // Share button
  const shareButton = document.getElementById('share-news');
  if (shareButton) {
    shareButton.addEventListener('click', () => {
      // Simple share functionality
      if (navigator.share) {
        navigator.share({
          title: 'City News Article',
          text: 'Check out this interesting article from CitizenLink!',
          url: window.location.href
        });
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard!', 'success');
      }
    });
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
