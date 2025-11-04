// CSRF token management utility
let csrfToken = null;
/**
 * Get CSRF token from server
 * @returns {Promise<string>} CSRF token
 */

export const getCsrfToken = async () => {

  if (csrfToken) {
    return csrfToken;
  }
  try {
    const response = await fetch('/api/auth/csrf-token');
    const data = await response.json();
    if (data.success) {
      csrfToken = data.csrfToken;
      return csrfToken;
    }
    throw new Error('Failed to get CSRF token');
  } catch (error) {
    console.error('CSRF token fetch failed:', error);
    throw error;
  }
};
/**
 * Get fresh CSRF token from response headers
 * @param {Response} response - Fetch response object
 * @returns {string|null} CSRF token from headers
 */

export const getCsrfTokenFromHeaders = (response) => {
  return response.headers.get('X-CSRF-Token');
};
/**
 * Add CSRF token to form data
 * @param {FormData} formData - Form data to add token to
 */

export const addCsrfTokenToForm = async (formData) => {
  try {
    const token = await getCsrfToken();
    formData.append('_csrf', token);
  } catch (error) {
    console.error('Failed to add CSRF token to form:', error);
    throw error;
  }
};
/**
 * Add CSRF token to request headers
 * @param {Object} headers - Headers object to add token to
 */

export const addCsrfTokenToHeaders = async (headers = {}) => {
  try {
    const token = await getCsrfToken();
    headers['X-CSRF-Token'] = token;
    return headers;
  } catch (error) {
    console.error('Failed to add CSRF token to headers:', error);
    throw error;
  }
};
/**
 * Clear stored CSRF token (useful after logout)
 */

export const clearCsrfToken = () => {
  csrfToken = null;
};
