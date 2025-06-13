import { supabase } from "./api/database.js";
import { secureStorage } from './utils/security.js';

// Check authentication and role
async function checkAuth() {
  try {
    const session = await supabase.auth.getSession();
    
    if (!session?.data?.session) {
      window.location.href = '/login.html';
      return;
    }

    const userSession = secureStorage.getItem('user_session');
    
    if (!userSession || Date.now() - userSession.timestamp > 24 * 60 * 60 * 1000) {
      // Session expired or invalid
      secureStorage.removeItem('user_session');
      window.location.href = '/login.html';
      return;
    }

    // Check if user is on the correct dashboard
    const currentPath = window.location.pathname;
    const isLguPath = currentPath.startsWith('/lgu/');
    const isCitizenPath = currentPath.startsWith('/citizen/');

    if ((isLguPath && userSession.role !== 'lgu') || 
        (isCitizenPath && userSession.role !== 'citizen')) {
      window.location.href = userSession.role === 'lgu' ? '/lgu/dashboard.html' : '/citizen/dashboard.html';
      return;
    }

    return userSession;
  } catch (error) {
    console.error('Auth check error:', error);
    window.location.href = '/login.html';
  }
}

// Update UI with user info
function updateUserInfo(user) {
  const userNameElements = document.querySelectorAll('#user-name, #header-user-name');
  
  userNameElements.forEach(element => {
    if (element) {
      element.textContent = user.name;
    }
  });
}

// Handle logout
function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await supabase.auth.signOut();
        secureStorage.removeItem('user_session');
        window.location.href = '/login.html';
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  }
}

// Handle sidebar toggle
function setupSidebar() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebar = document.querySelector('.sidebar');
  
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
    });
  }
  
  if (sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }
}

// Handle user menu dropdown
function setupUserMenu() {
  const userMenuBtn = document.querySelector('.user-menu-btn');
  const userMenu = document.querySelector('.user-menu');
  
  if (userMenuBtn && userMenu) {
    userMenuBtn.addEventListener('click', () => {
      userMenu.classList.toggle('open');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target)) {
        userMenu.classList.remove('open');
      }
    });
  }
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

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  
  if (user) {
    updateUserInfo(user);
    setupLogout();
    setupSidebar();
    setupUserMenu();
  }
});