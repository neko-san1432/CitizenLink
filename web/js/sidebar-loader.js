/**
 * Sidebar Loader Module
 * Handles loading and managing modular sidebars for Citizen and LGU dashboards
 */

class SidebarLoader {
    constructor() {
        this.sidebarContainer = null;
        this.currentUserType = null;
        this.currentPage = null;
        this.init().catch(error => {
            console.error('Error initializing SidebarLoader:', error);
        });
    }

    async init() {
        // Find the sidebar container
        this.sidebarContainer = document.querySelector('.dashboard-container');
        if (!this.sidebarContainer) {
            console.warn('Sidebar container not found');
            return;
        }

        // Determine current page and user type
        this.detectCurrentPage();
        this.detectUserType();
        
        // Load appropriate sidebar and wait for it to complete
        await this.loadSidebar();
        
        // Setup sidebar functionality after sidebar is loaded
        this.setupSidebarFunctionality();
    }

    detectCurrentPage() {
        // Extract current page from URL or data attribute
        const path = window.location.pathname;
        if (path.includes('citizen/')) {
            this.currentPage = path.split('citizen/')[1]?.replace('.html', '') || 'dashboard';
        } else if (path.includes('lgu/')) {
            this.currentPage = path.split('lgu/')[1]?.replace('.html', '') || 'dashboard';
        } else {
            this.currentPage = 'dashboard';
        }
    }

    detectUserType() {
        // Check localStorage for user type
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.type === 'lgu' || user.type === 'admin') {
            this.currentUserType = 'lgu';
        } else {
            this.currentUserType = 'citizen';
        }

        // Fallback: detect from URL path
        if (!this.currentUserType) {
            if (window.location.pathname.includes('lgu/')) {
                this.currentUserType = 'lgu';
            } else if (window.location.pathname.includes('citizen/')) {
                this.currentUserType = 'citizen';
            }
        }
    }

    async loadSidebar() {
        try {
            const sidebarPath = `../components/${this.currentUserType}-sidebar.html`;
            const response = await fetch(sidebarPath);
            
            if (!response.ok) {
                throw new Error(`Failed to load sidebar: ${response.status}`);
            }

            const sidebarHTML = await response.text();
            
            // Insert sidebar at the beginning of the container
            this.sidebarContainer.insertAdjacentHTML('afterbegin', sidebarHTML);
            
            // Update active state
            this.updateActiveState();
            
            // Update user information
            this.updateUserInfo();
            
        } catch (error) {
            console.error('Error loading sidebar:', error);
            this.loadFallbackSidebar();
        }
    }

    loadFallbackSidebar() {
        // Fallback: create a basic sidebar if loading fails
        const fallbackHTML = `
            <aside class="sidebar">
                <div class="sidebar-header">
                    <div class="logo">
                        <i class="fas fa-shield-alt"></i>
                        <span>CitizenLink</span>
                        ${this.currentUserType === 'lgu' ? '<span class="badge">LGU</span>' : ''}
                    </div>
                </div>
                <nav class="sidebar-nav">
                    <ul>
                        <li><a href="dashboard.html"><i class="fas fa-home"></i><span>Dashboard</span></a></li>
                        <li><a href="#" onclick="history.back()"><i class="fas fa-arrow-left"></i><span>Go Back</span></a></li>
                    </ul>
                </nav>
            </aside>
        `;
        
        this.sidebarContainer.insertAdjacentHTML('afterbegin', fallbackHTML);
    }

    updateActiveState() {
        // Remove all active classes
        const allLinks = document.querySelectorAll('.sidebar-nav a');
        allLinks.forEach(link => link.classList.remove('active'));
        
        // Add active class to current page
        const currentLink = document.querySelector(`[data-page="${this.currentPage}"]`);
        if (currentLink) {
            currentLink.classList.add('active');
        }
    }

    updateUserInfo() {
        // Update user name in sidebar
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userNameElement = document.getElementById('user-name');
        
        if (userNameElement && user.name) {
            userNameElement.textContent = user.name;
        }
    }

    setupSidebarFunctionality() {
        // Wait a bit to ensure DOM elements are fully available
        setTimeout(() => {
            console.log('Setting up sidebar functionality...');
            
            // Setup sidebar toggle functionality
            this.setupSidebarToggle();
            
            // Setup user menu functionality
            this.setupUserMenu();
            
            // Setup logout functionality
            this.setupLogout();
            
            console.log('Sidebar functionality setup complete');
        }, 100);
    }

    setupSidebarToggle() {
        console.log('Setting up sidebar toggle...');
        
        // Handle sidebar toggle button
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        const closeBtn = document.getElementById('sidebar-close');
        const mainContent = document.querySelector('.main-content');
        
        console.log('Found elements:', {
            toggleBtn: !!toggleBtn,
            sidebar: !!sidebar,
            closeBtn: !!closeBtn,
            mainContent: !!mainContent
        });
        
        // Early return if essential elements are missing
        if (!sidebar) {
            console.warn('Sidebar element not found in setupSidebarToggle');
            return;
        }
        
        // Create overlay for mobile
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }
        
        // Helper function to safely toggle main content
        const safeToggleMainContent = (action) => {
            if (mainContent) {
                if (action === 'add') {
                    mainContent.classList.add('sidebar-open');
                } else if (action === 'remove') {
                    mainContent.classList.remove('sidebar-open');
                } else if (action === 'toggle') {
                    mainContent.classList.toggle('sidebar-open');
                }
            } else {
                console.warn('mainContent element not found when trying to', action);
            }
        };
        
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                safeToggleMainContent('toggle');
                overlay.classList.toggle('active');
            });
        }
        
        if (closeBtn && sidebar) {
            closeBtn.addEventListener('click', () => {
                sidebar.classList.remove('open');
                safeToggleMainContent('remove');
                overlay.classList.remove('active');
            });
        }
        
        // Close sidebar when clicking overlay
        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                safeToggleMainContent('remove');
                overlay.classList.remove('active');
            });
        }
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                // On desktop, always show sidebar
                sidebar.classList.add('open');
                safeToggleMainContent('add');
                overlay.classList.remove('active');
            } else {
                // On mobile, hide sidebar by default
                sidebar.classList.remove('open');
                safeToggleMainContent('remove');
                overlay.classList.remove('active');
            }
        });
        
        // Initialize sidebar state based on screen size
        if (window.innerWidth > 768) {
            sidebar.classList.add('open');
            safeToggleMainContent('add');
        }
        
        console.log('Sidebar toggle setup complete');
    }

    setupUserMenu() {
        // Handle user menu dropdown
        const userMenuBtn = document.querySelector('.user-menu-btn');
        const userDropdown = document.querySelector('.user-dropdown');
        
        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', () => {
                userDropdown.classList.toggle('show');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                    userDropdown.classList.remove('show');
                }
            });
        }
    }

    setupLogout() {
        // Handle logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }
    }

    handleLogout() {
        // Clear user data
        localStorage.removeItem('user');
        localStorage.removeItem('otp_verified');
        localStorage.removeItem('user_phone');
        
        // Redirect to login page
        window.location.href = '../login.html';
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on dashboard pages
    if (document.querySelector('.dashboard-container')) {
        new SidebarLoader();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SidebarLoader;
}
