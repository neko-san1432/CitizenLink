document.addEventListener('DOMContentLoaded', () => {
    const goBackButton = document.getElementById('go-back');
    if (goBackButton) {
        goBackButton.addEventListener('click', () => {
            history.back();
        });
    }

    // Optional: log for analytics without inline scripts
    try {
        console.log('404 Error - Page not found:', window.location.pathname);
    } catch {}
});




