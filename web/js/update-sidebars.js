/**
 * Sidebar Update Helper Script
 * This script helps update existing dashboard pages to use the modular sidebar system
 * Run this in the browser console on any dashboard page to see what needs to be updated
 */

class SidebarUpdater {
    constructor() {
        this.pages = [
            'citizen/dashboard.html',
            'citizen/submit-complaint.html',
            'citizen/my-complaints.html',
            'citizen/analytics.html',
            'citizen/profile.html',
            'lgu/dashboard.html',
            'lgu/complaints.html',
            'lgu/heatmap.html',
            'lgu/insights.html'
        ];
    }

    // Check current page and show update instructions
    checkCurrentPage() {
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop();
        
        console.log('=== SIDEBAR UPDATE CHECK ===');
        console.log(`Current page: ${currentPage}`);
        
        if (currentPath.includes('citizen/')) {
            console.log('✅ This is a citizen page - should use citizen-sidebar.html');
        } else if (currentPath.includes('lgu/')) {
            console.log('✅ This is an LGU page - should use lgu-sidebar.html');
        } else {
            console.log('❌ Not a dashboard page');
            return;
        }

        // Check if sidebar is already modular
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.innerHTML.includes('<!-- Sidebar will be loaded dynamically')) {
            console.log('✅ Sidebar is already modular!');
        } else if (sidebar) {
            console.log('❌ Sidebar is NOT modular - needs update');
            this.showUpdateInstructions();
        } else {
            console.log('❌ No sidebar found - check if sidebar-loader.js is included');
        }
    }

    showUpdateInstructions() {
        console.log('\n=== UPDATE INSTRUCTIONS ===');
        console.log('To make this page use the modular sidebar:');
        console.log('1. Replace the entire <aside class="sidebar">...</aside> section with:');
        console.log('   <!-- Sidebar will be loaded dynamically by sidebar-loader.js -->');
        console.log('2. Add this script before the closing </body> tag:');
        console.log('   <script src="../js/sidebar-loader.js"></script>');
        console.log('3. Make sure the script is added AFTER auth-check.js');
    }

    // Generate the replacement HTML for the current page
    generateReplacement() {
        const currentPath = window.location.pathname;
        let replacement = '';
        
        if (currentPath.includes('citizen/')) {
            replacement = '<!-- Sidebar will be loaded dynamically by sidebar-loader.js -->';
        } else if (currentPath.includes('lgu/')) {
            replacement = '<!-- Sidebar will be loaded dynamically by sidebar-loader.js -->';
        }
        
        return replacement;
    }

    // Show what the current sidebar HTML looks like
    showCurrentSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            console.log('\n=== CURRENT SIDEBAR HTML ===');
            console.log(sidebar.outerHTML);
        } else {
            console.log('No sidebar found on this page');
        }
    }

    // Show what the replacement should be
    showReplacement() {
        console.log('\n=== REPLACEMENT HTML ===');
        console.log(this.generateReplacement());
    }

    // Run full analysis
    runAnalysis() {
        this.checkCurrentPage();
        this.showCurrentSidebar();
        this.showReplacement();
        
        console.log('\n=== SUMMARY ===');
        console.log('Pages that need updating:');
        this.pages.forEach(page => {
            console.log(`- ${page}`);
        });
        
        console.log('\nTo update all pages, you can:');
        console.log('1. Use search and replace in your editor');
        console.log('2. Replace the sidebar HTML with the comment');
        console.log('3. Add sidebar-loader.js script tag');
        console.log('4. Test each page to ensure sidebar loads correctly');
    }
}

// Auto-run analysis when script is loaded
const updater = new SidebarUpdater();
updater.runAnalysis();

// Make it available globally for manual use
window.SidebarUpdater = SidebarUpdater;
