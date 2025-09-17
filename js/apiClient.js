import { supabase } from './db.js';

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
        // Token expired or invalid, redirect to login
        window.location.href = '/login';
        return;
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
        window.location.href = '/login';
        return;
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

export default new ApiClient();
