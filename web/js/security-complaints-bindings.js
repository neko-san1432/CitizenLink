// Bind events for security/complaints page to avoid inline handlers (CSP compliant)
(function () {
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    onReady(() => {
        const clearFiltersBtn = document.getElementById('clear-filters');
        const refreshBtn = document.getElementById('refresh-complaints');
        const testSidebarBtn = document.getElementById('test-sidebar-btn');
        const manualLoadSidebarBtn = document.getElementById('manual-load-sidebar-btn');
        const checkUserDataBtn = document.getElementById('check-user-data-btn');

        if (clearFiltersBtn && typeof window.clearAllFilters === 'function') {
            clearFiltersBtn.addEventListener('click', () => window.clearAllFilters());
        }
        if (refreshBtn && typeof window.refreshComplaints === 'function') {
            refreshBtn.addEventListener('click', () => window.refreshComplaints());
        }
        if (testSidebarBtn && typeof window.testSidebar === 'function') {
            testSidebarBtn.addEventListener('click', () => window.testSidebar());
        }
        if (manualLoadSidebarBtn && typeof window.manualLoadSidebar === 'function') {
            manualLoadSidebarBtn.addEventListener('click', () => window.manualLoadSidebar());
        }
        if (checkUserDataBtn && typeof window.checkUserData === 'function') {
            checkUserDataBtn.addEventListener('click', () => window.checkUserData());
        }
    });
})();


