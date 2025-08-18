document.addEventListener('DOMContentLoaded', async () => {
  // Initialize user data using shared utilities
  const user = await window.userUtils.initializeUserData();
  if (!user) return;
  
  // Setup form
  setupComplaintForm();
  
  // Setup cancel button
  document.getElementById('cancel-btn').addEventListener('click', () => {
    window.location.href = '/dashboard';
  });
});

// Authentication function
async function checkAuth() {
  try {
    // Check if user is authenticated
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!user.id) {
      console.log('No authenticated user found');
      return null;
    }
    return {
      username: user.email,
      name: user.name
    };
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
}

const subcategories = {
  "infrastructure": ["Road Damage", "Bridge Issues", "Sidewalk Problems", "Street Lighting", "Public Building", "Traffic Control", "Drainage Problems", "Public Amenities", "Sewer Problems", "Road Safety", "Water Infrastructure"],
  "public_safety": ["Crime Report", "Traffic Violation", "Suspicious Activity", "Abandoned Vehicle", "Public Disturbance", "Animal Control", "Abandoned Property", "Illegal Activity"],
  "sanitation": ["Garbage Collection", "Illegal Dumping", "Sewage Issues", "Public Restroom", "Pest Control"],
  "utilities": ["Water Supply", "Electricity Issues", "Gas Leaks", "Internet/Telecom", "Drainage Problems"],
  "noise": ["Construction Noise", "Traffic Noise", "Loud Music", "Industrial Noise", "Nighttime Disturbance", "Commercial Noise", "Residential Noise"],
  "other": ["General Inquiry", "Feedback", "Suggestion", "Commendation", "Other"]
};

function showToast(message, type = 'success') {
  // Replace with actual toast notification implementation
  console.log(`Toast: ${message} (Type: ${type})`);
}

// Setup complaint form
function setupComplaintForm() {
  const complaintForm = document.getElementById('complaint-form');
  const complaintType = document.getElementById('complaint-type');
  const complaintSubcategory = document.getElementById('complaint-subcategory');
  const getLocationBtn = document.getElementById('get-location-btn');
  
  // Setup location coordinates functionality
  setupLocationCoordinates(getLocationBtn);
  
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
  complaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get user data
    const user = await checkAuth();
    if (!user) {
      showToast('Please log in to submit a complaint.', 'error');
      return;
    }
    
    // Get form data
    const formData = {
      user_id: user.username,
      user_name: user.name,
      title: document.getElementById('complaint-title').value,
      type: document.getElementById('complaint-type').value,
      subcategory: document.getElementById('complaint-subcategory').options[document.getElementById('complaint-subcategory').selectedIndex].text,
  
      location: document.getElementById('complaint-location').value,
      latitude: parseFloat(document.getElementById('latitude').value) || null,
      longitude: parseFloat(document.getElementById('longitude').value) || null,
      description: document.getElementById('complaint-description').value,
      suggested_unit: document.getElementById('suggested-unit').value,
      status: 'pending'
    };
    
    // Validate coordinates if provided
    if (formData.latitude && formData.longitude) {
      if (formData.latitude < -90 || formData.latitude > 90) {
        showToast('Invalid latitude value. Must be between -90 and 90.', 'error');
        return;
      }
      if (formData.longitude < -180 || formData.longitude > 180) {
        showToast('Invalid longitude value. Must be between -180 and 180.', 'error');
        return;
      }
    }
    
    // Handle photo upload if provided
    const photoInput = document.getElementById('complaint-photo');
    if (photoInput.files.length > 0) {
      const file = photoInput.files[0];
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('Photo size exceeds the 5MB limit. Please choose a smaller image.', 'error');
        return;
      }
      
      // Convert to base64 for storage in Supabase
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

// Setup location coordinates functionality
function setupLocationCoordinates(getLocationBtn) {
  if (!getLocationBtn) return;
  
  getLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
      getLocationBtn.disabled = true;
      getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          document.getElementById('latitude').value = latitude.toFixed(6);
          document.getElementById('longitude').value = longitude.toFixed(6);
          
          getLocationBtn.innerHTML = '<i class="fas fa-check"></i> Location Captured';
          getLocationBtn.classList.remove('btn-outline-primary');
          getLocationBtn.classList.add('btn-success');
          
          showToast('Location coordinates captured successfully!', 'success');
          
          // Reset button after 3 seconds
          setTimeout(() => {
            getLocationBtn.disabled = false;
            getLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Get Current Location';
            getLocationBtn.classList.remove('btn-success');
            getLocationBtn.classList.add('btn-outline-primary');
          }, 3000);
        },
        (error) => {
          console.error('Error getting location:', error);
          getLocationBtn.disabled = false;
          getLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Get Current Location';
          
          let errorMessage = 'Unable to get your location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          
          showToast(errorMessage, 'error');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      showToast('Geolocation is not supported by this browser.', 'error');
    }
  });
}

// Submit complaint to Supabase
async function submitComplaint(formData) {
  try {
    // Submit complaint using the global function from data-management.js
    if (window.createComplaint) {
      const newComplaint = await window.createComplaint(formData);
      
      if (newComplaint) {
        showToast('Complaint submitted successfully!', 'success');
        
        // Redirect to complaints page after a short delay
        setTimeout(() => {
          window.location.href = '/my-complaints?id=' + newComplaint.id;
        }, 1500);
      } else {
        showToast('Failed to submit complaint. Please try again.', 'error');
      }
    } else {
      showToast('Complaint system not available. Please try again later.', 'error');
    }
  } catch (error) {
    console.error('Error submitting complaint:', error);
    showToast('Error submitting complaint: ' + error.message, 'error');
  }
}