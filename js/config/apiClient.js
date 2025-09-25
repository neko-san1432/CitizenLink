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

  async getComplaints() {
    return await this.get('/api/complaints');
  }

  async createComplaint(complaintData) {
    return await this.post('/api/complaints', complaintData);
  }

  async getAdminStats() {
    return await this.get('/api/admin/stats');
  }
}

const apiClient = new ApiClient();

// Export supabase instance for direct access
apiClient.supabase = supabase;

export default apiClient;
