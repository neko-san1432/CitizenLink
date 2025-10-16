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
  
  // Fix menu button functionality
  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      console.log('[HEATMAP] Menu button clicked');
      // Toggle sidebar visibility
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.toggle('collapsed');
        console.log('[HEATMAP] Sidebar toggled');
      }
    });
  }
});

// Global functions for popup buttons
window.viewComplaintDetails = function(complaintId) {
  console.log('[HEATMAP] View details for complaint:', complaintId);
  // You can implement navigation to complaint details page here
  alert(`Viewing details for complaint: ${complaintId}`);
};

window.centerOnComplaint = function(lat, lng) {
  console.log('[HEATMAP] Centering on complaint:', lat, lng);
  if (heatmapController && heatmapController.map) {
    heatmapController.map.setView([lat, lng], 16);
  }
};
