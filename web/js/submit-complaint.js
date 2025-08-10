document.addEventListener('DOMContentLoaded', () => {
  // Get user
  const user = checkAuth();
  if (!user) return;
  
  // Setup form
  setupComplaintForm(user);
  
  // Setup cancel button
  document.getElementById('cancel-btn').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });
});

// Mock functions and data that would normally be imported
function checkAuth() {
  // Replace with actual authentication logic
  return {
    username: 'testuser',
    name: 'Test User'
  };
}

const subcategories = {
  "Noise Complaint": ["Loud Music", "Construction Noise", "Barking Dogs"],
  "Property Maintenance": ["Graffiti", "Broken Windows", "Unkempt Yard"]
};

function showToast(message, type = 'success') {
  // Replace with actual toast notification implementation
  console.log(`Toast: ${message} (Type: ${type})`);
}

function addComplaint(complaintData) {
  // Replace with actual complaint submission logic (e.g., saving to localStorage or an API)
  const complaints = JSON.parse(localStorage.getItem('complaints') || '[]');
  const newComplaint = {
    id: Date.now(), // Generate a unique ID
    ...complaintData
  };
  complaints.push(newComplaint);
  localStorage.setItem('complaints', JSON.stringify(complaints));
  return newComplaint;
}

// Setup complaint form
function setupComplaintForm(user) {
  const complaintForm = document.getElementById('complaint-form');
  const complaintType = document.getElementById('complaint-type');
  const complaintSubcategory = document.getElementById('complaint-subcategory');
  
  // Populate subcategories based on selected complaint type
  complaintType.addEventListener('change', () => {
    const selectedType = complaintType.value;
    
    // Clear current options
    complaintSubcategory.innerHTML = '<option value="" disabled selected>Select subcategory</option>';
    
    // Add new options
    if (selectedType && subcategories[selectedType]) {
      subcategories[selectedType].forEach(subcategory => {
        const option = document.createElement('option');
        option.value = subcategory.toLowerCase().replace(/\s+/g, '_');
        option.textContent = subcategory;
        complaintSubcategory.appendChild(option);
      });
    }
  });
  
  // Handle form submission
  complaintForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = {
      userId: user.username,
      userName: user.name,
      title: document.getElementById('complaint-title').value,
      type: document.getElementById('complaint-type').value,
      subcategory: document.getElementById('complaint-subcategory').options[document.getElementById('complaint-subcategory').selectedIndex].text,
      urgency: document.getElementById('complaint-urgency').value,
      location: document.getElementById('complaint-location').value,
      description: document.getElementById('complaint-description').value,
      suggestedUnit: document.getElementById('suggested-unit').value
    };
    
    // Handle photo upload if provided
    const photoInput = document.getElementById('complaint-photo');
    if (photoInput.files.length > 0) {
      const file = photoInput.files[0];
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('Photo size exceeds the 5MB limit. Please choose a smaller image.', 'error');
        return;
      }
      
      // Convert to base64 for storage in localStorage
      const reader = new FileReader();
      reader.onload = function(event) {
        formData.photo = event.target.result;
        submitComplaint(formData);
      };
      reader.readAsDataURL(file);
    } else {
      submitComplaint(formData);
    }
  });
}

// Submit complaint to localStorage
function submitComplaint(formData) {
  // Add complaint to localStorage
  const newComplaint = addComplaint(formData);
  
  if (newComplaint) {
    showToast('Complaint submitted successfully!');
    
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      window.location.href = 'my-complaints.html?id=' + newComplaint.id;
    }, 1500);
  } else {
    showToast('Failed to submit complaint. Please try again.', 'error');
  }
}