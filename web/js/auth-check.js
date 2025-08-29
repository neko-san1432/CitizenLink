// Check if user is logged in
let supabase = null;
// Use shared Supabase manager instead of duplicating initialization code
async function initializeAuthSupabase() {
  try {
    // Use the shared manager to get Supabase client
    supabase = await window.supabaseManager.initialize();
    checkExistingSession();
  } catch (error) {
    // Error initializing Supabase
  }
}

// Check existing Supabase session
async function checkExistingSession() {
  try {
    if (!supabase) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (session) {
      // Update sessionStorage with fresh session data
      const userData = {
        id: session.user.id,
        email: session.user.email,
        type: session.user.user_metadata?.role || "citizen",
        role: session.user.user_metadata?.role || "citizen",
        name: session.user.user_metadata?.name || session.user.email
      };
      sessionStorage.setItem("user", JSON.stringify(userData));
      
      // Check if we're on the correct page for this user
      const currentPath = window.location.pathname;
      const userRole = String(userData.role || "").toLowerCase();
      
      // Check for LGU roles (lgu-admin-<dept> or lgu-<dept>)
      const isLguRole = (
        userRole === "lgu" ||
        userRole === "lgu_admin" ||
        userRole === "admin" ||
        userRole.startsWith("lgu-") ||
        userRole.startsWith("lgu_admin") ||
        userRole.startsWith("lgu-admin")
      );
      
      if (isLguRole && !currentPath.includes('/lgu/')) {
        window.location.href = "/lgu/dashboard";
        return;
      } else if (userRole === "citizen" && !currentPath.includes('/citizen/') && !currentPath.includes('/dashboard') && !currentPath.includes('/profile') && !currentPath.includes('/complaints') && !currentPath.includes('/submit-complaint') && !currentPath.includes('/analytics') && !currentPath.includes('/news')) {
        window.location.href = "/dashboard";
        return;
      }
    } else {
      // No valid session, clear storage and redirect to login
      sessionStorage.removeItem("user");
      window.location.href = "/login";
      return;
    }
  } catch (error) {
    // On error, clear storage and redirect to login
    sessionStorage.removeItem("user");
    window.location.href = "/login";
    return;
  }
}

function checkAuth() {
  // First check if we have a user in sessionStorage
  const user = JSON.parse(sessionStorage.getItem('user'));
  
  if (!user) {
    // Redirect to login page
    window.location.href = '/login';
    return null;
  }
  
  // Check if on the correct platform
  const currentPath = window.location.pathname;
  const userRole = String(user.role || user.type || "").toLowerCase();
  
  if (userRole === 'citizen' && !currentPath.includes('/citizen/') && !currentPath.includes('/dashboard') && !currentPath.includes('/profile') && !currentPath.includes('/complaints') && !currentPath.includes('/submit-complaint') && !currentPath.includes('/analytics') && !currentPath.includes('/news')) {
    window.location.href = '/dashboard';
    return null;
  }
  
  // Check for LGU roles (lgu-admin-<dept> or lgu-<dept>)
  const isLguRole = (
    userRole === "lgu" ||
    userRole === "lgu_admin" ||
    userRole === "admin" ||
    userRole.startsWith("lgu-") ||
    userRole.startsWith("lgu_admin") ||
    userRole.startsWith("lgu-admin")
  );
  
  if (isLguRole && !currentPath.includes('/lgu/')) {
    window.location.href = '/lgu/dashboard';
    return null;
  }
  
  return user;
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
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Clear user from localStorage
      sessionStorage.removeItem('user');
      
      // Redirect to login page
      window.location.href = '/login';
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
  // Initialize Supabase first
  await initializeAuthSupabase();
  
  // Then check authentication
  const user = checkAuth();
  
  if (user) {
    updateUserInfo(user);
    setupLogout();
    setupSidebar();
    setupUserMenu();
  }
});

