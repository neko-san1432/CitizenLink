import { supabase } from './config.js';

// API client with automatic JWT token handling
class ApiClient {
  async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async get(url) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, { 
        method: 'GET',
        headers 
      });
      
      if (response.status === 401) {
        // Try to refresh token before redirecting
        try {
          console.log('Token expired, attempting refresh...');
          const { data: { session }, error } = await supabase.auth.refreshSession();
          
          if (error || !session) {
            console.log('Token refresh failed, showing session expired toast');
            // Import and show session expired toast
            const { showMessage } = await import('../components/toast.js');
            showMessage('error', 'Session expired. Please log in again.', 5000);
            setTimeout(() => {
              window.location.href = '/login';
            }, 3000);
            return;
          }
          
          // Update server cookie with new token
          await fetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: session.access_token })
          });
          
          // Retry the original request with new token
          console.log('Token refreshed, retrying request...');
          const newHeaders = await this.getAuthHeaders();
          const retryResponse = await fetch(url, {
            method: 'GET',
            headers: newHeaders
          });
          
          if (retryResponse.status === 401) {
            console.log('Retry failed, showing session expired toast');
            const { showMessage } = await import('../components/toast.js');
            showMessage('error', 'Session expired. Please log in again.', 5000);
            setTimeout(() => {
              window.location.href = '/login';
            }, 3000);
            return;
          }
          
          return await retryResponse.json();
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          const { showMessage } = await import('../components/toast.js');
          showMessage('error', 'Session expired. Please log in again.', 5000);
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
          return;
        }
      }
      
      if (response.status === 403) {
        throw new Error('Insufficient permissions');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API GET error:', error);
      throw error;
    }
  }

  async post(url, data) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      
      if (response.status === 401) {
        // Try to refresh token before redirecting
        try {
          console.log('Token expired, attempting refresh...');
          const { data: { session }, error } = await supabase.auth.refreshSession();
          
          if (error || !session) {
            console.log('Token refresh failed, showing session expired toast');
            const { showMessage } = await import('../components/toast.js');
            showMessage('error', 'Session expired. Please log in again.', 5000);
            setTimeout(() => {
              window.location.href = '/login';
            }, 3000);
            return;
          }
          
          // Update server cookie with new token
          await fetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: session.access_token })
          });
          
          // Retry the original request with new token
          console.log('Token refreshed, retrying request...');
          const newHeaders = await this.getAuthHeaders();
          const retryResponse = await fetch(url, {
            method: 'POST',
            headers: newHeaders,
            body: JSON.stringify(data)
          });
          
          if (retryResponse.status === 401) {
            console.log('Retry failed, showing session expired toast');
            const { showMessage } = await import('../components/toast.js');
            showMessage('error', 'Session expired. Please log in again.', 5000);
            setTimeout(() => {
              window.location.href = '/login';
            }, 3000);
            return;
          }
          
          return await retryResponse.json();
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          const { showMessage } = await import('../components/toast.js');
          showMessage('error', 'Session expired. Please log in again.', 5000);
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
          return;
        }
      }
      
      if (response.status === 403) {
        throw new Error('Insufficient permissions');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API POST error:', error);
      throw error;
    }
  }

  // Convenience methods for common API calls
  async getUserProfile() {
    return await this.get('/api/user/profile');
  }

  async getUserRole() {
    return await this.get('/api/user/role');
  }

  async getAdminStats() {
    return await this.get('/api/admin/stats');
  }

  // Complaint management methods
  async submitComplaint(formData) {
    try {
      const response = await fetch('/api/complaints', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Complaint submission failed');
      }
      
      return result;
    } catch (error) {
      console.error('[API CLIENT] Complaint submission error:', error);
      throw error;
    }
  }

  async getMyComplaints(filters = {}) {
    const params = new URLSearchParams(filters);
    return await this.get(`/api/complaints/my?${params}`);
  }

  async getComplaint(id) {
    return await this.get(`/api/complaints/${id}`);
  }

  async getAllComplaints(filters = {}) {
    const params = new URLSearchParams(filters);
    return await this.get(`/api/complaints?${params}`);
  }

  async updateComplaintStatus(id, status, notes = '') {
    return await this.post(`/api/complaints/${id}/status`, { status, notes });
  }

  // Department Management Methods
  async getDepartments() {
    return await this.get('/api/departments');
  }

  async getActiveDepartments() {
    return await this.get('/api/departments/active');
  }

  async getDepartmentsByType(type) {
    return await this.get(`/api/departments/type/${type}`);
  }

  async getDepartment(id) {
    return await this.get(`/api/departments/${id}`);
  }

  async createDepartment(data) {
    return await this.post('/api/departments', data);
  }

  async updateDepartment(id, data) {
    return await this.put(`/api/departments/${id}`, data);
  }

  async deleteDepartment(id) {
    return await this.delete(`/api/departments/${id}`);
  }

  // Settings Management Methods
  async getSettings() {
    return await this.get('/api/settings');
  }

  async getPublicSettings() {
    return await this.get('/api/settings/public');
  }

  async getSettingsByCategory(category) {
    return await this.get(`/api/settings/category/${category}`);
  }

  async getSetting(key) {
    return await this.get(`/api/settings/${key}`);
  }

  async createSetting(data) {
    return await this.post('/api/settings', data);
  }

  async updateSetting(key, data) {
    return await this.put(`/api/settings/${key}`, data);
  }

  async deleteSetting(key) {
    return await this.delete(`/api/settings/${key}`);
  }

  async initializeDefaultSettings() {
    return await this.post('/api/settings/initialize');
  }
}

const apiClient = new ApiClient();

// Export supabase instance for direct access
apiClient.supabase = supabase;

export default apiClient;
