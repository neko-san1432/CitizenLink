/**
 * Signup Modal JavaScript
 * External file to avoid CSP issues
 */

console.log('Signup modal script loaded');

// Debug: Check if modals exist in DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking for modals...');
    const termsModal = document.getElementById('termsModal');
    const privacyModal = document.getElementById('privacyModal');
    console.log('Terms modal in DOM:', !!termsModal);
    console.log('Privacy modal in DOM:', !!privacyModal);
    
    if (termsModal) {
        console.log('Terms modal current display:', termsModal.style.display);
        console.log('Terms modal computed display:', window.getComputedStyle(termsModal).display);
    }
    if (privacyModal) {
        console.log('Privacy modal current display:', privacyModal.style.display);
        console.log('Privacy modal computed display:', window.getComputedStyle(privacyModal).display);
    }
});


document.addEventListener('click', function(e) {
    console.log('Click detected on:', e.target.tagName, e.target.className, e.target.getAttribute('data-open-terms'), e.target.getAttribute('data-open-privacy'));
    
    // Check for terms link first
    if (e.target.matches('[data-open-terms]') || e.target.closest('[data-open-terms]')) {
        console.log('Opening terms modal');
        e.preventDefault();
        const termsModal = document.getElementById('termsModal');
        console.log('Terms modal found:', !!termsModal);
        if (termsModal) {
            console.log('Before setting styles - display:', termsModal.style.display);
            termsModal.style.display = 'block';
            termsModal.style.visibility = 'visible';
            termsModal.style.opacity = '1';
            termsModal.style.position = 'fixed';
            termsModal.style.top = '0';
            termsModal.style.left = '0';
            termsModal.style.width = '100%';
            termsModal.style.height = '100%';
            termsModal.style.zIndex = '9999999';
            termsModal.style.backgroundColor = 'rgba(0,0,0,0.5)'; // Proper dark overlay
            // Don't change body overflow - this causes layout issues
            // document.body.style.overflow = 'hidden';
            console.log('Terms modal displayed');
        } else {
            console.error('Terms modal not found!');
        }
        return; // Important: return to prevent other handlers
    }
    
    // Check for privacy link
    if (e.target.matches('[data-open-privacy]') || e.target.closest('[data-open-privacy]')) {
        console.log('Opening privacy modal');
        e.preventDefault();
        const privacyModal = document.getElementById('privacyModal');
        console.log('Privacy modal found:', !!privacyModal);
        if (privacyModal) {
            privacyModal.style.display = 'block';
            privacyModal.style.visibility = 'visible';
            privacyModal.style.opacity = '1';
            privacyModal.style.position = 'fixed';
            privacyModal.style.top = '0';
            privacyModal.style.left = '0';
            privacyModal.style.width = '100%';
            privacyModal.style.height = '100%';
            privacyModal.style.zIndex = '9999999';
            privacyModal.style.backgroundColor = 'rgba(0,0,0,0.5)'; // Proper dark overlay
            // Don't change body overflow - this causes layout issues
            // document.body.style.overflow = 'hidden';
            console.log('Privacy modal displayed');
        } else {
            console.error('Privacy modal not found!');
        }
        return; // Important: return to prevent other handlers
    }
    
    if (e.target.matches('[data-modal]')) {
        console.log('Closing modal:', e.target.getAttribute('data-modal'));
        document.getElementById(e.target.getAttribute('data-modal')).style.display = 'none';
        // Don't restore body overflow - this causes layout issues
        // document.body.style.overflow = 'auto';
    }
    
    if (e.target.matches('[data-accept]')) {
        console.log('Accepting:', e.target.getAttribute('data-accept'));
        document.getElementById('terms-checkbox').checked = true;
        const modalId = e.target.getAttribute('data-accept') === 'terms' ? 'termsModal' : 'privacyModal';
        document.getElementById(modalId).style.display = 'none';
        // Don't restore body overflow - this causes layout issues
        // document.body.style.overflow = 'auto';
        alert('Accepted!');
    }
});

// Close on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        // Don't restore body overflow - this causes layout issues
        // document.body.style.overflow = 'auto';
    }
};

console.log('Signup modal event listeners attached');

// Phone number validation - only allow numbers
document.addEventListener('input', function(e) {
    if (e.target.id === 'mobile') {
        // Remove any non-numeric characters
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        
        // Limit to 10 digits
        if (e.target.value.length > 10) {
            e.target.value = e.target.value.slice(0, 10);
        }
    }
});

// Prevent non-numeric input on keypress
document.addEventListener('keypress', function(e) {
    if (e.target.id === 'mobile') {
        // Allow: backspace, delete, tab, escape, enter
        if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
            // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            (e.keyCode === 65 && e.ctrlKey === true) ||
            (e.keyCode === 67 && e.ctrlKey === true) ||
            (e.keyCode === 86 && e.ctrlKey === true) ||
            (e.keyCode === 88 && e.ctrlKey === true)) {
            return;
        }
        // Ensure that it is a number and stop the keypress
        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
            e.preventDefault();
        }
    }
});

// Prevent paste of non-numeric content
document.addEventListener('paste', function(e) {
    if (e.target.id === 'mobile') {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const numericOnly = paste.replace(/[^0-9]/g, '').slice(0, 10);
        e.target.value = numericOnly;
    }
});
