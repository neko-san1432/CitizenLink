// LGU Admin Heatmap Page Script
let heatmapController = null;
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Initialize heatmap controller
    heatmapController = new HeatmapController();
    await heatmapController.initialize('map');
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
      const isOpening = !sidebar.classList.contains('open');
      sidebar.classList.toggle('open');
      // If sidebar is opening, hide heatmap controls
      if (isOpening && heatmapControls) {
        heatmapControls.classList.add('collapsed');
      }
    });
  }
  // Listen for sidebar close button
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('sidebar-close')) {
      // When sidebar closes, show heatmap controls
      if (heatmapControls) {
        heatmapControls.classList.remove('collapsed');
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
          }
        }
      });
    });
    observer.observe(heatmapControls, { attributes: true });
  }
});
// Global functions for popup buttons
window.viewComplaintDetails = function(complaintId) {
  window.location.href = `/complaint-details?id=${complaintId}`;
};
window.centerOnComplaint = function(lat, lng) {
  if (heatmapController && heatmapController.map) {
    heatmapController.map.setView([lat, lng], 16);
  }
};
