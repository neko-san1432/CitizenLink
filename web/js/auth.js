// Tab switching functionality
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.getAttribute('data-tab');
    
    // Update active tab button
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Show corresponding tab content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      }
    });
  });
});

// Toast notification function
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show';
  
  if (type === 'error') {
    toast.classList.add('error');
  } else {
    toast.classList.add('success');
  }
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Citizen login form
const citizenLoginForm = document.getElementById('citizen-login-form');
if (citizenLoginForm) {
  citizenLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('citizen-username').value;
    const password = document.getElementById('citizen-password').value;
    
    if (username === 'citizen-user' && password === 'citizen01') {
      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify({
        username,
        type: 'citizen',
        name: 'John Citizen',
        email: 'john@example.com'
      }));
      
      showToast('Login successful! Redirecting...');
      
      setTimeout(() => {
        window.location.href = 'citizen/dashboard.html';
      }, 1000);
    } else {
      showToast('Invalid username or password. Please try again.', 'error');
    }
  });
}

// LGU login form
const lguLoginForm = document.getElementById('lgu-login-form');
if (lguLoginForm) {
  lguLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('lgu-username').value;
    const password = document.getElementById('lgu-password').value;
    
    if (username === 'LGU-admin' && password === 'admin911') {
      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify({
        username,
        type: 'lgu',
        name: 'Admin User',
        department: 'City Administration'
      }));
      
      showToast('Login successful! Redirecting...');
      
      setTimeout(() => {
        window.location.href = 'lgu/dashboard.html';
      }, 1000);
    } else {
      showToast('Invalid username or password. Please try again.', 'error');
    }
  });
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
    
    // Store user in localStorage
    localStorage.setItem('user', JSON.stringify({
      username,
      type: 'citizen',
      name: fullName,
      email
    }));
    
    showToast('Account created successfully! Redirecting...');
    
    setTimeout(() => {
      window.location.href = 'citizen/dashboard.html';
    }, 1000);
  });
}