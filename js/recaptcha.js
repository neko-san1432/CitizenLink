let recaptchaResponse = null;

// Function to handle reCAPTCHA callback
function onRecaptchaComplete(token) {
    recaptchaResponse = token;
    // Enable the submit buttons if token is valid
    const submitButtons = document.querySelectorAll('.needs-recaptcha');
    submitButtons.forEach(button => {
        button.disabled = false;
    });
}

// Function to handle reCAPTCHA expiry
function onRecaptchaExpired() {
    recaptchaResponse = null;
    // Disable the submit buttons when reCAPTCHA expires
    const submitButtons = document.querySelectorAll('.needs-recaptcha');
    submitButtons.forEach(button => {
        button.disabled = true;
    });
}

// Function to get reCAPTCHA response
function getRecaptchaResponse() {
    return recaptchaResponse;
}

// Function to reset reCAPTCHA
function resetRecaptcha() {
    if (typeof grecaptcha !== 'undefined') {
        grecaptcha.reset();
    }
    recaptchaResponse = null;
    const submitButtons = document.querySelectorAll('.needs-recaptcha');
    submitButtons.forEach(button => {
        button.disabled = true;
    });
}

export { 
    onRecaptchaComplete, 
    onRecaptchaExpired, 
    getRecaptchaResponse, 
    resetRecaptcha 
};
