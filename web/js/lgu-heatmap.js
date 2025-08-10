document.addEventListener('DOMContentLoaded', () => {
  // Get user and complaints
  const user = checkAuth();
  if (!user) return;
  
  // Initialize map
  initializeMap();
  
  // Setup filters
  setupFilters();
});

// Mock functions for demonstration purposes
function checkAuth() {
  // Replace with actual authentication check logic
  return { username: 'admin-user', type: 'lgu' };
}

// Initialize map
function initializeMap() {
  // Create map centered on the city
  const map = L.map('complaint-map').setView([6.75, 125.35], 13);
  
  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Sample complaint data with coordinates
  const heatmapData = [
    // Downtown area (example coordinates)
    [6.75056, 125.35694, 10], 
    [6.75200, 125.35800, 8],
    [6.74850, 125.35500, 6],
    
    // North district (example coordinates)
    [6.76000, 125.35000, 7],
    [6.76200, 125.35200, 5],
    [6.76500, 125.35400, 6],
    
    // West commercial zone (example coordinates)
    [6.74000, 125.34000, 5],
    [6.73800, 125.33800, 4],
    [6.73550, 125.33650, 6],
    
    // East residential area (example coordinates)
    [6.75500, 125.36500, 4],
    [6.75300, 125.36350, 3],
    [6.75150, 125.36250, 5],
    
    // South industrial park (example coordinates)
    [6.73000, 125.34500, 3],
    [6.72850, 125.34350, 2],
    [6.72650, 125.34250, 4]
  ];
  
  // Add heatmap layer
  const heat = L.heatLayer(heatmapData, {
    radius: 25,
    blur: 15,
    maxZoom: 17,
    gradient: {
      0.4: 'blue',
      0.6: 'lime',
      0.8: 'yellow',
      1.0: 'red'
    }
  }).addTo(map);
  
  // Add markers for complaint locations
  const complaints = [
    {
      id: 'CP001',
      title: 'Pothole on Main Street',
      location: 'Main Street near City Hall',
      coordinates: [14.5995, 120.9842],
      type: 'infrastructure',
      status: 'resolved'
    },
    {
      id: 'CP002',
      title: 'Broken Streetlight',
      location: 'Corner of Pine St and Oak Ave',
      coordinates: [14.6095, 120.9742],
      type: 'infrastructure',
      status: 'in_progress'
    },
    {
      id: 'CP003',
      title: 'Garbage Collection Missed',
      location: 'Cedar Avenue',
      coordinates: [14.5895, 120.9642],
      type: 'sanitation',
      status: 'pending'
    },
    {
      id: 'CP004',
      title: 'Noise Complaint',
      location: 'Maple Drive Construction Site',
      coordinates: [14.6095, 121.0042],
      type: 'noise',
      status: 'in_progress'
    },
    {
      id: 'CP005',
      title: 'Water Main Break',
      location: 'Birch Street',
      coordinates: [14.5795, 120.9942],
      type: 'utilities',
      status: 'resolved'
    }
  ];
  
  // Add markers for each complaint
  complaints.forEach(complaint => {
    let markerColor;
    switch (complaint.status) {
      case 'pending':
        markerColor = '#fbbf24'; // Yellow
        break;
      case 'in_progress':
        markerColor = '#3b82f6'; // Blue
        break;
      case 'resolved':
        markerColor = '#10b981'; // Green
        break;
      default:
        markerColor = '#64748b'; // Gray
    }
    
    const marker = L.circleMarker(complaint.coordinates, {
      radius: 8,
      fillColor: markerColor,
      color: '#fff',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);
    
    // Add popup with complaint details
    marker.bindPopup(`
      <div class="map-popup">
        <h3>${complaint.title}</h3>
        <p><strong>ID:</strong> ${complaint.id}</p>
        <p><strong>Location:</strong> ${complaint.location}</p>
        <p><strong>Type:</strong> ${complaint.type}</p>
        <p><strong>Status:</strong> ${complaint.status}</p>
        <a href="complaints.html?id=${complaint.id}" class="popup-link">View Details</a>
      </div>
    `);
  });
}

// Setup filters
function setupFilters() {
  const heatmapFilter = document.getElementById('heatmap-filter');
  const timeFilter = document.getElementById('time-filter');
  
  // Add event listeners
  heatmapFilter.addEventListener('change', updateHeatmap);
  timeFilter.addEventListener('change', updateHeatmap);
}

// Update heatmap based on filters
function updateHeatmap() {
  // This would normally fetch filtered data and update the heatmap
  // For demo purposes, we'll just show a toast notification
  
  const heatmapFilter = document.getElementById('heatmap-filter').value;
  const timeFilter = document.getElementById('time-filter').value;
  
  showToast(`Heatmap updated with filters: ${heatmapFilter}, ${timeFilter}`);
}

// Toast notification function
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  
  if (!toast) return;
  
  // Create toast elements
  const toastHeader = document.createElement('div');
  toastHeader.className = 'toast-header';
  
  const toastTitle = document.createElement('div');
  toastTitle.className = 'toast-title';
  toastTitle.textContent = type === 'success' ? 'Success' : 'Error';
  
  const toastClose = document.createElement('button');
  toastClose.className = 'toast-close';
  toastClose.innerHTML = '&times;';
  toastClose.addEventListener('click', () => {
    toast.classList.remove('show');
  });
  
  toastHeader.appendChild(toastTitle);
  toastHeader.appendChild(toastClose);
  
  const toastMessage = document.createElement('div');
  toastMessage.className = 'toast-message';
  toastMessage.textContent = message;
  
  // Clear previous content
  toast.innerHTML = '';
  
  // Add new content
  toast.appendChild(toastHeader);
  toast.appendChild(toastMessage);
  
  // Set toast class
  toast.className = 'toast';
  toast.classList.add(type);
  
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}