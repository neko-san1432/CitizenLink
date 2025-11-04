document.addEventListener('mousemove', updateSessionActivity);
document.addEventListener('keypress', updateSessionActivity);

export function updateSessionActivity() {
  localStorage.setItem('lastActive', Date.now().toString());
}
// Initialize session tracking
updateSessionActivity();
