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
      
      return null;
    }
    return {
      id: user.id,
      email: user.email,
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
  
}

// Setup complaint form
function setupComplaintForm() {
  const complaintForm = document.getElementById('complaint-form');
  const complaintType = document.getElementById('complaint-type');
  const complaintSubcategory = document.getElementById('complaint-subcategory');
  
  // Attempt to capture location automatically in background
  captureGeoLocationInBackground();
  
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
    // Gather selected units (multiple)
    const selectedUnits = Array.from(document.querySelectorAll('#suggested-units input[type="checkbox"]:checked')).map(cb => cb.value);

    const formData = {
      user_id: user.id,
      user_name: user.name,
      title: document.getElementById('complaint-title').value,
      type: document.getElementById('complaint-type').value,
      subcategory: document.getElementById('complaint-subcategory').options[document.getElementById('complaint-subcategory').selectedIndex].text,
      location: document.getElementById('complaint-location').value,
      latitude: window.__geo?.lat ?? null,
      longitude: window.__geo?.lng ?? null,
      location_accuracy: window.__geo?.accuracy ?? null,
      location_timestamp: window.__geo?.ts ?? null,
      location_source: window.__geo?.source ?? 'gps',
      description: document.getElementById('complaint-description').value,
      suggested_units: selectedUnits,
      status: 'pending'
    };
    
    // Validate coordinates if provided
    if (formData.latitude != null && formData.longitude != null) {
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
function captureGeoLocationInBackground() {
  if (!('geolocation' in navigator)) {
    showGeoUnavailableNote('Could not access geolocation in this browser. You can still submit without it.');
    return;
  }
  // Request high-accuracy once, fill hidden fields silently
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      window.__geo = {
        lat: Number(latitude.toFixed(6)),
        lng: Number(longitude.toFixed(6)),
        accuracy: Number((accuracy ?? 0).toFixed(0)),
        ts: new Date().toISOString(),
        source: 'gps'
      };
    },
    (err) => {
      // Silent failure: user denied or unavailable; form can still submit without coords
      if (err && err.code === err.PERMISSION_DENIED) {
        showGeoUnavailableNote('Location permission denied. You can still submit without coordinates.');
      } else {
        showGeoUnavailableNote('Unable to get your location. You can still submit without coordinates.');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 120000
    }
  );
}

// Show a subtle inline note below the Location field when geo is unavailable
function showGeoUnavailableNote(message) {
  const locationInput = document.getElementById('complaint-location');
  if (!locationInput) return;
  // Avoid duplicates
  const existing = document.getElementById('geo-note');
  if (existing) return;
  const note = document.createElement('small');
  note.id = 'geo-note';
  note.className = 'text-muted';
  note.style.display = 'block';
  note.style.marginTop = '0.25rem';
  note.textContent = message;
  locationInput.insertAdjacentElement('afterend', note);
}

// Submit complaint to Supabase
async function submitComplaint(formData) {
  try {
    // Prefer existing global function if available
    if (window.createComplaint) {
      const newComplaint = await window.createComplaint(formData);
      if (!newComplaint) {
        showToast('Failed to submit complaint. Please try again.', 'error');
        return;
      }
      showToast('Complaint submitted successfully!', 'success');
      setTimeout(() => {
        window.location.href = '/my-complaints?id=' + newComplaint.id;
      }, 1500);
      return;
    }

    // Fallback: Insert directly via Supabase
    if (!window.supabaseManager || !window.supabaseManager.initialize) {
      showToast('Complaint system not available. Please try again later.', 'error');
      return;
    }

    const supabase = await window.supabaseManager.initialize();

    // Only send valid columns
    const payload = {
      user_id: formData.user_id,
      user_name: formData.user_name,
      title: formData.title,
      type: formData.type,
      subcategory: formData.subcategory || null,
      location: formData.location,
      description: formData.description,
      status: formData.status || 'pending',
      assigned_unit: null,
      // Store as JSON array in a text/jsonb column if available; fallback to comma-separated
      suggested_unit: Array.isArray(formData.suggested_units) ? formData.suggested_units.join(',') : (formData.suggested_units || null),
      citizen_feedback: null,
      is_active: true,
      latitude: formData.latitude ?? null,
      longitude: formData.longitude ?? null,
      location_accuracy: formData.location_accuracy ?? null,
      location_timestamp: formData.location_timestamp ?? null,
      location_source: formData.location_source ?? 'gps'
    };

    const { data, error } = await supabase
      .from('complaints')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      showToast('Failed to submit complaint: ' + error.message, 'error');
      return;
    }

    showToast('Complaint submitted successfully!', 'success');
    setTimeout(() => {
      window.location.href = '/my-complaints?id=' + data.id;
    }, 1500);
  } catch (error) {
    console.error('Error submitting complaint:', error);
    showToast('Error submitting complaint: ' + error.message, 'error');
  }
}
