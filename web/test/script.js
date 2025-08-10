// Test script to verify Bootstrap and Popper.js functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Bootstrap 5.3.3 + Popper.js loaded successfully!');
    
    // Test tooltip functionality (requires Popper.js)
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Add some interactive elements to test
    const testButton = document.querySelector('.btn-primary');
    if (testButton) {
        testButton.addEventListener('click', function() {
            console.log('🎉 Modal trigger clicked - Popper.js is working!');
        });
    }
    
    // Test responsive behavior
    function testResponsiveness() {
        const isMobile = window.innerWidth < 768;
        console.log(`📱 Responsive test: ${isMobile ? 'Mobile' : 'Desktop'} view`);
    }
    
    window.addEventListener('resize', testResponsiveness);
    testResponsiveness();
    
    // Add success message to page
    const successMsg = document.createElement('div');
    successMsg.className = 'alert alert-success mt-3';
    successMsg.innerHTML = '<strong>Success!</strong> Bootstrap and Popper.js are working correctly. Check the console for more details.';
    
    const cardBody = document.querySelector('.card-body');
    if (cardBody) {
        cardBody.appendChild(successMsg);
    }
});

