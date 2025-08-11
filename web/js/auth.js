// General login form handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Check if it's a citizen login
    if (email === 'citizen@example.com' && password === 'citizen01') {
      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify({
        username: email,
        type: 'citizen',
        name: 'John Citizen',
        email: email
      }));
      
      showToast('Login successful! Redirecting...');
      
      setTimeout(() => {
        window.location.href = '/citizen/dashboard';
      }, 1000);
    }
    // Check if it's an LGU admin login
    else if (email === 'admin@lgu.gov.ph' && password === 'admin911') {
      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify({
        username: email,
        type: 'lgu',
        name: 'Admin User',
        department: 'City Administration'
      }));
      
      showToast('Login successful! Redirecting...');
      
      setTimeout(() => {
        window.location.href = '/lgu/dashboard';
      }, 1000);
    } else {
      showToast('Invalid email or password. Please try again.', 'error');
    }
  });
}

// Toast notification function
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  
  if (toastMessage) {
    toastMessage.textContent = message;
  }
  
  // Create Bootstrap toast instance and show it
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    bsToast.hide();
  }, 3000);
}

// Signup form
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
      showToast('Passwords do not match. Please try again.', 'error');
      return;
    }
    
    // Store signup data in localStorage for email verification
    localStorage.setItem('signup_email', email);
    localStorage.setItem('signup_fullName', fullName);
    localStorage.setItem('signup_username', username);
    localStorage.setItem('signup_password', password);
    
    showToast('Account created! Please verify your email address.', 'success');
    
    setTimeout(() => {
      // Redirect to OTP verification page
      window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;
    }, 1500);
  });
}