/**
 * Complaint Form Submission Handler
 * Handles the actual submission of complaint forms to the API
 */

import apiClient from '../../config/apiClient.js';
import { extractComplaintFormData, validateComplaintForm } from '../../utils/validation.js';
import showMessage from '../toast.js';

/**
 * Handle complaint form submission
 * @param {HTMLFormElement} formElement - The form element
 * @param {Array} selectedFiles - Array of selected files for upload
 * @returns {Promise<Object>} - Submission result
 */
export async function handleComplaintSubmit(formElement, selectedFiles = []) {
  const submitBtn = formElement.querySelector('.submit-btn');
  const originalText = submitBtn?.textContent || 'Submit Complaint';

  try {
    // Disable submit button
    if (submitBtn) {
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;
    }

    // Extract and validate form data
    const formData = extractComplaintFormData(formElement);
    const validation = validateComplaintForm(formData);

    if (!validation.valid) {
      throw new Error(validation.errors.join('. '));
    }

    // Create FormData for API submission
    const apiFormData = new FormData();

    // Add basic fields
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (key === 'departments' && Array.isArray(value)) {
          // Handle departments array - append each department ID separately
          value.forEach(deptId => {
            apiFormData.append('departments', deptId);
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

    // Submit via API client (CSRF token handled internally)
    const result = await apiClient.submitComplaint(apiFormData);

    if (!result.success) {
      throw new Error(result.error || 'Submission failed');
    }

    showMessage('success', result.message || 'Complaint submitted successfully');
    // console.log removed for security

    return result.data;

  } catch (error) {
    console.error('[COMPLAINT] Submission error:', error);
    showMessage('error', error.message || 'Failed to submit complaint');
    throw error;
  } finally {
    // Re-enable submit button
    if (submitBtn) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
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