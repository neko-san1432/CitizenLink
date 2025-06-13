import { supabase } from "./api/database.js";
import { sanitizeInput, validateFileUpload } from './utils/security.js';

// Constants for validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const bannedWords = ["yawa", "puta", "putang-ina", "putangina", "tangina", "waa", "fuck", "fck", "shit", "sht"];

let currentLatitude = null;
let currentLongitude = null;

// Form elements
const form = document.getElementById('complaint-form');
const title = document.getElementById('complaint-title');
const type = document.getElementById('complaint-type');
const subcategory = document.getElementById('complaint-subcategory');
const urgencyLevel = document.getElementById('urgency-level');
const suggestedUnitDispatch = document.getElementById('suggested-unit');
const location = document.getElementById('complaint-location');
const description = document.getElementById('complaint-description');
const photo = document.getElementById('complaint-photo');

// Initialize subcategory handling
type.addEventListener("change", updateSubcategories);

function updateSubcategories() {
    switch (type.value) {
        case "infrastructure":
            subcategory.innerHTML = `
                <option value="Potholes / Road damage">Potholes / Road damage</option>
                <option value="Broken sidewalks">Broken sidewalks</option>
                <option value="Damaged streetlights">Damaged streetlights</option>
                <option value="Collapsing structures">Collapsing structures</option>
                <option value="Bridge issues">Bridge issues</option>
                <option value="Construction obstructions">Construction obstructions</option>
                <option value="Traffic sign damage">Traffic sign damage</option>
                <option value="Flooded roads / drainage issues">Flooded roads / drainage issues</option>`;
            break;
        case "public_safety":
            subcategory.innerHTML = `
                <option value="Suspicious activity">Suspicious activity</option>
                <option value="Theft / Robbery">Theft / Robbery</option>
                <option value="Assault reports">Assault reports</option>
                <option value="Drug-related concerns">Drug-related concerns</option>
                <option value="Vandalism">Vandalism</option>
                <option value="Stray animals / rabid animals">Stray animals / rabid animals</option>
                <option value="Trespassing">Trespassing</option>
                <option value="Missing persons">Missing persons</option>`;
            break;
        case "sanitation":
            subcategory.innerHTML = `
                <option value="Uncollected garbage">Uncollected garbage</option>
                <option value="Illegal dumping">Illegal dumping</option>
                <option value="Clogged drainage">Clogged drainage</option>
                <option value="Overflowing trash bins">Overflowing trash bins</option>
                <option value="Pest infestation (rats, insects, etc.)">Pest infestation (rats, insects, etc.)</option>
                <option value="Dead animals">Dead animals</option>
                <option value="Improper waste disposal">Improper waste disposal</option>
                <option value="Foul odor reports">Foul odor reports</option>`;
            break;
        case "utilities":
            subcategory.innerHTML = `
                <option value="Power outage">Power outage</option>
                <option value="Water supply issues">Water supply issues</option>
                <option value="Leaking pipes">Leaking pipes</option>
                <option value="Gas leaks">Gas leaks</option>
                <option value="Faulty electrical poles/wires">Faulty electrical poles/wires</option>
                <option value="Internet/cable service disruptions">Internet/cable service disruptions</option>
                <option value="Water quality concern">Water quality concern</option>
                <option value="Sewer backup">Sewer backup</option>`;
            break;
        case "noise":
            subcategory.innerHTML = `
                <option value="Loud music (e.g., parties, karaoke)">Loud music (e.g., parties, karaoke)</option>
                <option value="Barking dogs">Barking dogs</option>
                <option value="Construction noise">Construction noise</option>
                <option value="Vehicle noise (revving, horns)">Vehicle noise (revving, horns)</option>
                <option value="Industrial/factory noise">Industrial/factory noise</option>
                <option value="Noise at restricted hours">Noise at restricted hours</option>
                <option value="Public disturbance">Public disturbance</option>`;
            break;
        default:
            subcategory.innerHTML = `<option value="" disabled selected>Select subcategory</option>`;
            break;
    }
}

// Initialize subcategories on page load
updateSubcategories();

// File validation functions
async function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    showToast(`File ${file.name} is too large. Maximum size is 5MB`, 'error');
    return false;
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    showToast('Invalid file type. Allowed: JPEG, PNG, GIF, WebP', 'error');
    return false;
  }

  try {
    const isValidContent = await validateFileContent(file);
    if (!isValidContent) {
      showToast('Invalid file content detected', 'error');
      return false;
    }
  } catch (error) {
    console.error("File validation error:", error);
    return false;
  }

  return true;
}

async function validateFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = function(e) {
      const arr = new Uint8Array(e.target.result).subarray(0, 4);
      let header = "";
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16);
      }
      const isValid =
        header.startsWith("ffd8") || // JPEG
        header.startsWith("89504e47") || // PNG
        header.startsWith("47494638"); // GIF
      resolve(isValid);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// Complaint validation functions
async function validateComplaint() {
  // Check for banned words
  const tester = new RegExp(`\\b(${bannedWords.join("|")})\\b`, "i");
  const sanitizedTitle = sanitizeInput(title.value);
  const sanitizedDescription = sanitizeInput(description.value);
  
  if (tester.test(sanitizedTitle) || tester.test(sanitizedDescription)) {
    showToast("Please avoid using inappropriate language", "error");
    return false;
  }

  // Check required fields
  if (!sanitizedTitle || !sanitizedDescription || !type.value || 
      !subcategory.value || !urgencyLevel.value || 
      !suggestedUnitDispatch.value || !location.value) {
    showToast("Please fill in all required fields", "error");
    return false;
  }

  // Check for duplicates
  if (await isDuplicate()) {
    showToast("A similar complaint has already been submitted recently", "error");
    return false;
  }

  return true;
}

async function isDuplicate() {
  return (
    (await locationProximity()) &&
    (await timeWindowChecking()) &&
    (await titleAndDescriptionSimilarities())
  );
}

// Duplication check functions
async function locationProximity() {
  if (!currentLatitude || !currentLongitude) return false;

  const { data: complaints } = await supabase
    .from('complaints')
    .select('userLoc')
    .not('userLoc', 'is', null);

  if (!complaints) return false;

  for (const complaint of complaints) {
    const distance = calculateDistance(
      currentLatitude,
      currentLongitude,
      complaint.userLoc.lat,
      complaint.userLoc.long
    );
    if (distance < 0.05) return true; // 50 meters
  }
  return false;
}

async function timeWindowChecking() {
  const { data: complaints } = await supabase
    .from('complaints')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!complaints) return false;

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  return complaints.some(complaint => 
    new Date(complaint.created_at) > thirtyMinutesAgo
  );
}

async function titleAndDescriptionSimilarities() {
  const { data: complaints } = await supabase
    .from('complaints')
    .select('title, description')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!complaints) return false;

  const currentTitle = title.value.toLowerCase();
  const currentDesc = description.value.toLowerCase();  return complaints.some(complaint => {
    // Using the string-similarity library's compareTwoStrings function
    const titleSimilarity = stringSimilarity.compareTwoStrings(
      currentTitle,
      complaint.title.toLowerCase()
    );
    const descSimilarity = stringSimilarity.compareTwoStrings(
      currentDesc,
      complaint.description.toLowerCase()
    );
    return titleSimilarity > 0.8 && descSimilarity > 0.8;
  });
}

// Initialize form with user context when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // First check if user is authenticated
  import('./auth-check.js').then(({ getCurrentUser }) => {
    getCurrentUser().then(user => {
      if (user) {
        setupComplaintForm(user);
      } else {
        window.location.href = '/login.html';
      }
    });
  });
});

// Get user's location using IP
async function getLocation() {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch('https://ipwho.is/');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      if (data.success === false) {
        throw new Error('Location lookup failed');
      }
      
      currentLatitude = data.latitude;
      currentLongitude = data.longitude;
      
      console.log("Location detected:", {
        country: data.country,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude
      });
      
      resolve({ lat: currentLatitude, long: currentLongitude });
    } catch (error) {
      console.error('IP Location error:', error);
      reject(error);
    }
  });
}

// Handle file uploads
async function handleFileUploads(complaintID) {
  const photoInput = document.getElementById('complaint-photo');
  const files = photoInput.files;

  for (let file of files) {
    try {
      // Validate file
      validateFileUpload(file);

      const fileName = `${complaintID}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('complaint-evidence')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }
}

// Setup complaint form with user context
function setupComplaintForm(user) {
    if (!user) {
        console.error('No user provided to setupComplaintForm');
        return;
    }

    // Initialize form submission
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        try {
            if (!(await validateComplaint())) {
                return;
            }

            const { data: complaint, error: complaintError } = await supabase
                .from('complaints')
                .insert([
                    {
                        userId: user.username,
                        userName: user.name,
                        title: sanitizeInput(title.value),
                        description: sanitizeInput(description.value),
                        location: sanitizeInput(location.value),
                        userLoc: currentLatitude && currentLongitude 
                            ? { lat: currentLatitude, long: currentLongitude }
                            : null,
                        category: type.value,
                        subCategory: subcategory.value,
                        suggestDisp: suggestedUnitDispatch.value,
                        urgency: urgencyLevel.value,
                        status: 'pending'
                    }
                ])
                .select()
                .single();

            if (complaintError) throw complaintError;

            // Handle file uploads
            if (photo.files.length > 0) {
                await handleFileUploads(complaint.complaintID);
            }

            showToast('Complaint submitted successfully!');
            setTimeout(() => {
                window.location.href = '/citizen/my-complaints.html';
            }, 1500);

        } catch (error) {
            console.error('Submission error:', error);
            showToast(error.message || 'Error submitting complaint. Please try again.', 'error');
        }
    });
}

// Initialize form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    import('./auth-check.js').then(({ getCurrentUser }) => {
        getCurrentUser().then(user => {
            if (user) {
                setupComplaintForm(user);
            } else {
                window.location.href = '/login.html';
            }
        });
    });
});

// Get initial location
getLocation().catch(console.warn);

// Export the setup function for use in tests or other modules
export { setupComplaintForm };