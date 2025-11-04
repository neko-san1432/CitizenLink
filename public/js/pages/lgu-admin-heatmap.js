// LGU Admin Heatmap Page Script
let heatmapController = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log('[HEATMAP] Initializing complaint heatmap...');
    
    // Initialize heatmap controller
    heatmapController = new HeatmapController();
    await heatmapController.initialize('map');
    
    console.log('[HEATMAP] Heatmap initialization complete');
    
  } catch (error) {
    console.error("Error initializing heatmap:", error);
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      statusDiv.textContent = "Error loading heatmap";
      statusDiv.classList.add("error");
    }
  }
  
  // Menu button functionality with mutual exclusivity
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const heatmapControls = document.getElementById('heatmap-controls');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      console.log('[HEATMAP] Menu button clicked');
      const isOpening = !sidebar.classList.contains('open');
      
      sidebar.classList.toggle('open');
      
      // If sidebar is opening, hide heatmap controls
      if (isOpening && heatmapControls) {
        heatmapControls.classList.add('collapsed');
        console.log('[HEATMAP] Heatmap controls collapsed');
      }
      
      console.log('[HEATMAP] Sidebar toggled, open:', sidebar.classList.contains('open'));
    });
  }
  
  // Listen for sidebar close button
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('sidebar-close')) {
      // When sidebar closes, show heatmap controls
      if (heatmapControls) {
        heatmapControls.classList.remove('collapsed');
        console.log('[HEATMAP] Heatmap controls expanded');
      }
    }
  });
  
  // If heatmap controls toggle exists, close sidebar when controls open
  if (heatmapControls) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.id === 'heatmap-controls' && 
            mutation.attributeName === 'class') {
          const isControlsVisible = !heatmapControls.classList.contains('collapsed');
          
          // If controls are being shown and sidebar is open, close sidebar
          if (isControlsVisible && sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            console.log('[HEATMAP] Sidebar closed due to controls opening');
          }
        }
      });
    });
    
    observer.observe(heatmapControls, { attributes: true });
  }
});

// Global functions for popup buttons
window.viewComplaintDetails = function(complaintId) {
  console.log('[HEATMAP] View details for complaint:', complaintId);
  window.location.href = `/complaint-details?id=${complaintId}`;
};

window.centerOnComplaint = function(lat, lng) {
  console.log('[HEATMAP] Centering on complaint:', lat, lng);
  if (heatmapController && heatmapController.map) {
    heatmapController.map.setView([lat, lng], 16);
  }
};
