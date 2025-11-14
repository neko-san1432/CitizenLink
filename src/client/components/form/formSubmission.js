/**
 * Complaint Form Submission Handler
 * Handles the actual submission of complaint forms to the API
 */
import apiClient from '../../config/apiClient.js';
import { extractComplaintFormData, validateComplaintForm } from '../../utils/validation.js';
import showMessage from '../toast.js';

/**
 * Calculate total size of files
 * @param {Array} files - Files array
 * @returns {number} Total size in bytes
 */
function getTotalFileSize(files) {
  return files.reduce((total, file) => total + file.size, 0);
}

/**
 * Handle complaint form submission with file upload progress
 * @param {HTMLFormElement} formElement - The form element
 * @param {Array} selectedFiles - Array of selected files for upload
 * @param {Object} fileHandler - File handler instance for progress tracking
 * @returns {Promise<Object>} - Submission result
 */
export async function handleComplaintSubmit(formElement, selectedFiles = [], fileHandler = null) {
  const submitBtn = formElement.querySelector('.submit-btn');
  const cancelBtn = formElement.querySelector('.cancel-btn') || document.querySelector('.cancel-btn');
  const originalSubmitText = submitBtn?.textContent || 'Submit Complaint';
  
  try {
    // Disable buttons
    if (submitBtn) {
      submitBtn.textContent = 'Preparing...';
      submitBtn.disabled = true;
    }
    if (cancelBtn) {
      cancelBtn.disabled = true;
    }

    // Extract and validate form data
    const formData = extractComplaintFormData(formElement);
    const validation = validateComplaintForm(formData);
    if (!validation.valid) {
      throw new Error(validation.errors.join('. '));
    }

    // Validate coordinates against Digos boundary (if coordinates are provided)
    if (formData.latitude !== null && formData.longitude !== null) {
      const { validateComplaintCoordinates } = await import('../../utils/validation.js');
      const coordValidation = await validateComplaintCoordinates(formData.latitude, formData.longitude);
      if (!coordValidation.valid) {
        throw new Error(coordValidation.error || 'Invalid complaint location');
      }
    }

    // Create FormData for API submission
    const apiFormData = new FormData();
    
    // Add basic fields
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (key === 'departments' && Array.isArray(value)) {
          value.forEach(deptId => {
            apiFormData.append('preferred_departments', deptId);
          });
        } else if (key === 'preferred_departments' && Array.isArray(value)) {
          value.forEach(deptId => {
            apiFormData.append('preferred_departments', deptId);
          });
        } else {
          apiFormData.append(key, String(value));
        }
      }
    });

    // Add files
    selectedFiles.forEach(file => {
      apiFormData.append('evidenceFiles', file);
    });

    // Submit form with progress tracking using XMLHttpRequest
    if (submitBtn) {
      submitBtn.textContent = selectedFiles.length > 0 ? 'Uploading files...' : 'Submitting complaint...';
    }

    // Use XMLHttpRequest for progress tracking
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const totalFileSize = getTotalFileSize(selectedFiles);
      let uploadedBytes = 0;
      const fileSizes = selectedFiles.map(f => f.size);
      const fileStartPositions = [0];
      let cumulative = 0;
      fileSizes.forEach(size => {
        cumulative += size;
        fileStartPositions.push(cumulative);
      });

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && fileHandler && selectedFiles.length > 0) {
          uploadedBytes = e.loaded;
          const totalSize = e.total;
          
          // Calculate progress for each file based on its position
          selectedFiles.forEach((file, index) => {
            const fileStart = fileStartPositions[index];
            const fileEnd = fileStartPositions[index + 1];
            const fileSize = file.size;
            
            let fileProgress = 0;
            if (uploadedBytes >= fileEnd) {
              fileProgress = 100;
            } else if (uploadedBytes > fileStart) {
              fileProgress = Math.round(((uploadedBytes - fileStart) / fileSize) * 100);
            }
            
            fileHandler.setUploadStatus(file, 'uploading', fileProgress);
          });
          
          // Update button text
          if (submitBtn) {
            const overallProgress = Math.round((e.loaded / e.total) * 100);
            submitBtn.textContent = `Uploading files... ${overallProgress}%`;
          }
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            // Mark all files as completed
            if (fileHandler && selectedFiles.length > 0) {
              selectedFiles.forEach(file => {
                fileHandler.setUploadStatus(file, 'completed', 100);
              });
            }
            resolve(response);
          } catch (parseError) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          // Mark files as error and remove them
          if (fileHandler && selectedFiles.length > 0) {
            selectedFiles.forEach(file => {
              fileHandler.setUploadStatus(file, 'error', 0);
            });
            // Remove failed uploads after a short delay to show error state
            setTimeout(() => {
              const removedCount = fileHandler.removeFailedUploads();
              if (removedCount > 0) {
                showMessage('warning', `${removedCount} file(s) removed due to upload failure`);
              }
            }, 2000);
          }
          try {
            let errorMsg = `Submission failed: ${xhr.statusText}`;
            if (xhr.responseText) {
              try {
            const errorResponse = JSON.parse(xhr.responseText);
                errorMsg = errorResponse.error || errorResponse.message || errorMsg;
              } catch (parseError) {
                // If JSON parsing fails, use response text as-is (might be HTML error page)
                errorMsg = xhr.responseText.length > 200 
                  ? `Server error: ${xhr.statusText}` 
                  : xhr.responseText;
              }
            }
            reject(new Error(errorMsg));
          } catch (err) {
            reject(new Error(`Submission failed: ${xhr.statusText}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        if (fileHandler && selectedFiles.length > 0) {
          selectedFiles.forEach(file => {
            fileHandler.setUploadStatus(file, 'error', 0);
          });
          // Remove failed uploads after a short delay to show error state
          setTimeout(() => {
            const removedCount = fileHandler.removeFailedUploads();
            if (removedCount > 0) {
              showMessage('warning', `${removedCount} file(s) removed due to connection error`);
            }
          }, 2000);
        }
        reject(new Error('Connection error: Failed to submit complaint. Please check your internet connection.'));
      });

      xhr.addEventListener('abort', () => {
        if (fileHandler && selectedFiles.length > 0) {
          selectedFiles.forEach(file => {
            fileHandler.setUploadStatus(file, 'error', 0);
          });
          // Remove failed uploads after a short delay to show error state
          setTimeout(() => {
            const removedCount = fileHandler.removeFailedUploads();
            if (removedCount > 0) {
              showMessage('warning', `${removedCount} file(s) removed due to cancellation`);
            }
          }, 2000);
        }
        reject(new Error('Submission cancelled'));
      });

      // Handle timeout (60 seconds for entire submission)
      xhr.timeout = 60000;
      xhr.addEventListener('timeout', () => {
        if (fileHandler && selectedFiles.length > 0) {
          selectedFiles.forEach(file => {
            fileHandler.setUploadStatus(file, 'error', 0);
          });
          // Remove failed uploads after a short delay to show error state
          setTimeout(() => {
            const removedCount = fileHandler.removeFailedUploads();
            if (removedCount > 0) {
              showMessage('warning', `${removedCount} file(s) removed due to upload timeout`);
            }
          }, 2000);
        }
        reject(new Error('Upload timeout: Connection is too slow or interrupted. Please try again.'));
      });

      // Get CSRF token and auth headers, then send request
      Promise.all([
        fetch('/api/auth/csrf-token').then(r => r.json()),
        apiClient.getAuthHeaders()
      ]).then(([csrfData, headers]) => {
        if (!csrfData.success) {
          reject(new Error('Failed to get CSRF token'));
          return;
        }
        
        apiFormData.append('_csrf', csrfData.csrfToken);
        
        xhr.open('POST', '/api/complaints', true);
        if (headers.Authorization) {
          xhr.setRequestHeader('Authorization', headers.Authorization);
        }
        xhr.send(apiFormData);
      }).catch(err => {
        reject(new Error('Failed to prepare submission'));
      });
    });

    if (!result.success) {
      throw new Error(result.error || 'Submission failed');
    }
    showMessage('success', result.message || 'Complaint submitted successfully');
    return result.data;
  } catch (error) {
    console.error('[COMPLAINT] Submission error:', error);
    
    // Remove failed uploads if fileHandler is available
    if (fileHandler && selectedFiles.length > 0) {
      // Mark all files as error first
      selectedFiles.forEach(file => {
        fileHandler.setUploadStatus(file, 'error', 0);
      });
      // Remove failed uploads after a short delay to show error state
      setTimeout(() => {
        const removedCount = fileHandler.removeFailedUploads();
        if (removedCount > 0) {
          showMessage('warning', `${removedCount} file(s) removed due to upload failure`);
        }
      }, 2000);
    }
    
    // Determine error message
    let errorMessage = error.message || 'Failed to submit complaint';
    if (errorMessage.includes('Connection') || errorMessage.includes('timeout') || errorMessage.includes('network')) {
      errorMessage = 'Connection error: Please check your internet connection and try again.';
    } else if (errorMessage.includes('Failed to upload')) {
      errorMessage = 'File upload failed. Please check your connection and try again.';
    }
    
    showMessage('error', errorMessage);
    throw error;
  } finally {
    // Re-enable buttons
    if (submitBtn) {
      submitBtn.textContent = originalSubmitText;
      submitBtn.disabled = false;
    }
    if (cancelBtn) {
      cancelBtn.disabled = false;
    }
  }
}
/**
 * Reset form to initial state
 * @param {HTMLFormElement} formElement - The form element
 * @param {Function} clearFiles - Function to clear selected files
 */

export function resetComplaintForm(formElement, clearFiles) {
  if (!formElement) return;
  // Reset form fields
  formElement.reset();
  // Clear custom validations
  const inputs = formElement.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.setCustomValidity('');
  });
  // Subtype field removed - not needed in current schema
  // Clear files if function provided
  if (typeof clearFiles === 'function') {
    clearFiles();
  }
  // console.log removed for security
}
