document.addEventListener('DOMContentLoaded', () => {
  // Get user
  const user = checkAuth();
  if (!user) return;
  
  // Load news content
  loadNews();
  
  // Setup user info
  updateUserInfo(user);
});

// Load news content
function loadNews() {
  const newsGrid = document.getElementById('news-grid');
  if (!newsGrid) return;
  
  // Sample news data - in a real app, this would come from an API
  const newsData = [
    {
      id: 1,
      title: "New Public Safety Initiative Launched",
      excerpt: "The city has launched a comprehensive public safety program focusing on community policing and emergency response improvements.",
      date: "2024-12-01",
      category: "Public Safety",
      icon: "fas fa-shield-alt"
    },
    {
      id: 2,
      title: "Infrastructure Development Project Announced",
      excerpt: "Major road improvements and bridge repairs scheduled to begin in Q1 2025, improving connectivity across the city.",
      date: "2024-11-28",
      category: "Infrastructure",
      icon: "fas fa-road"
    },
    {
      id: 3,
      title: "Environmental Protection Measures",
      excerpt: "New recycling programs and green energy initiatives to be implemented city-wide, promoting sustainability.",
      date: "2024-11-25",
      category: "Environment",
      icon: "fas fa-leaf"
    },
    {
      id: 4,
      title: "Community Health Services Expansion",
      excerpt: "Additional health clinics and vaccination centers opening in underserved neighborhoods.",
      date: "2024-11-22",
      category: "Health",
      icon: "fas fa-heartbeat"
    },
    {
      id: 5,
      title: "Digital Services Modernization",
      excerpt: "City services going digital with new online portals for permits, payments, and information requests.",
      date: "2024-11-20",
      category: "Technology",
      icon: "fas fa-laptop"
    },
    {
      id: 6,
      title: "Youth Development Programs",
      excerpt: "New after-school programs and youth centers opening to support young people's development and education.",
      date: "2024-11-18",
      category: "Education",
      icon: "fas fa-graduation-cap"
    }
  ];
  
  // Clear existing content
  newsGrid.innerHTML = '';
  
  // Create news cards
  newsData.forEach(news => {
    const newsCard = createNewsCard(news);
    newsGrid.appendChild(newsCard);
  });
}

// Create a news card element
function createNewsCard(news) {
  const card = document.createElement('div');
  card.className = 'news-card';
  
  const formattedDate = formatDate(news.date);
  
  card.innerHTML = `
    <div class="news-image">
      <i class="${news.icon}"></i>
    </div>
    <div class="news-content">
      <div class="news-date">${formattedDate}</div>
      <div class="news-tag">${news.category}</div>
      <h4 class="news-title">${news.title}</h4>
      <p class="news-excerpt">${news.excerpt}</p>
      <a href="#" class="news-read-more" onclick="showNewsDetails(${news.id})">
        Read More
        <i class="fas fa-arrow-right"></i>
      </a>
    </div>
  `;
  
  return card;
}

// Show news details (placeholder function)
function showNewsDetails(newsId) {
  // In a real app, this would show a modal or navigate to a news detail page
  alert(`News ID: ${newsId} - This would show detailed information in a real application.`);
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