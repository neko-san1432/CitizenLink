import { supabase } from "./config.js";

// API client with automatic JWT token handling
class ApiClient {
  async getAuthHeaders() {
    // SECURITY: Use Supabase session only, never localStorage or cookies
    // HttpOnly cookies are handled server-side, client uses Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }
  async get(url) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        method: "GET",
        headers
      });
      if (response.status === 401) {
        // Try to refresh token before redirecting
        try {
          // console.log removed for security
          const { data: { session }, error } = await supabase.auth.refreshSession();
          if (error || !session) {
            // console.log removed for security
            // Import and show session expired toast
            const { showMessage } = await import("../components/toast.js");
            showMessage("error", "Session expired. Please log in again.", 5000);
            setTimeout(() => {
              window.location.href = `${window.location.origin  }/login`;
            }, 3000);
            return;
          }
          // Update server cookie with new token
          await fetch("/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: session.access_token })
          });
          // Retry the original request with new token
          // console.log removed for security
          const newHeaders = await this.getAuthHeaders();
          const retryResponse = await fetch(url, {
            method: "GET",
            headers: newHeaders
          });
          if (retryResponse.status === 401) {
            // console.log removed for security
            const { showMessage } = await import("../components/toast.js");
            showMessage("error", "Session expired. Please log in again.", 5000);
            setTimeout(() => {
              window.location.href = `${window.location.origin  }/login`;
            }, 3000);
            return;
          }
          return await retryResponse.json();
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          const { showMessage } = await import("../components/toast.js");
          showMessage("error", "Session expired. Please log in again.", 5000);
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
          return;
        }
      }
      if (response.status === 403) {
        throw new Error("Insufficient permissions");
      }
      return await response.json();
    } catch (error) {
      // Handle connection errors gracefully
      if (error.message?.includes("Failed to fetch") ||
          error.message?.includes("ERR_CONNECTION_REFUSED") ||
          error.name === "TypeError") {
        // Server is likely down or unreachable
        console.warn("[API_CLIENT] Server connection error:", error.message);
        // Return a structured error response instead of throwing
        return {
          success: false,
          error: "Connection refused. Server may be unavailable.",
          connectionError: true
        };
      }
      console.error("API GET error:", error);
      throw error;
    }
  }
  async post(url, data) {
    try {
      let headers = await this.getAuthHeaders();
      let response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
      });
      if (response.status === 401) {
        console.warn("Token expired, attempting refresh");
        // SECURITY: Use Supabase session refresh, never localStorage
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session) {
          // Update server cookie with new token
          try {
            await fetch("/auth/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access_token: refreshed.session.access_token })
            });
          } catch (cookieError) {
            console.error("Failed to update server cookie:", cookieError);
          }
          // Retry with new token
          headers = await this.getAuthHeaders();
          response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(data)
          });
        } else {
          console.error("Token refresh failed");
          const { showMessage } = await import("../components/toast.js");
          showMessage("error", "Session expired. Please log in again.");
          setTimeout(() => { window.location.href = "/login"; }, 3000);
          return null;
        }
      }
      if (response.status === 403) {
        throw new Error("Insufficient permissions");
      }
      return await response.json();
    } catch (error) {
      console.error("API POST error:", error);
      throw error;
    }
  }
  async put(url, data) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(data)
      });
      if (response.status === 401) {
        // Try to refresh token before redirecting
        try {
          // console.log removed for security
          const { data: { session }, error } = await supabase.auth.refreshSession();
          if (error || !session) {
            // console.log removed for security
            const { showMessage } = await import("../components/toast.js");
            showMessage("error", "Session expired. Please log in again.", 5000);
            setTimeout(() => {
              window.location.href = `${window.location.origin  }/login`;
            }, 3000);
            return;
          }
          // Update server cookie with new token
          await fetch("/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: session.access_token })
          });
          // Retry the original request with new token
          // console.log removed for security
          const newHeaders = await this.getAuthHeaders();
          const retryResponse = await fetch(url, {
            method: "PUT",
            headers: newHeaders,
            body: JSON.stringify(data)
          });
          if (retryResponse.status === 401) {
            // console.log removed for security
            const { showMessage } = await import("../components/toast.js");
            showMessage("error", "Session expired. Please log in again.", 5000);
            setTimeout(() => {
              window.location.href = `${window.location.origin  }/login`;
            }, 3000);
            return;
          }
          return await retryResponse.json();
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          const { showMessage } = await import("../components/toast.js");
          showMessage("error", "Session expired. Please log in again.", 5000);
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
          return;
        }
      }
      if (response.status === 403) {
        throw new Error("Insufficient permissions");
      }
      return await response.json();
    } catch (error) {
      console.error("API PUT error:", error);
      throw error;
    }
  }
  async delete(url) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        method: "DELETE",
        headers
      });
      if (response.status === 401) {
        // Try to refresh token before redirecting
        try {
          // console.log removed for security
          const { data: { session }, error } = await supabase.auth.refreshSession();
          if (error || !session) {
            // console.log removed for security
            const { showMessage } = await import("../components/toast.js");
            showMessage("error", "Session expired. Please log in again.", 5000);
            setTimeout(() => {
              window.location.href = `${window.location.origin  }/login`;
            }, 3000);
            return;
          }
          // Update server cookie with new token
          await fetch("/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: session.access_token })
          });
          // Retry the original request with new token
          // console.log removed for security
          const newHeaders = await this.getAuthHeaders();
          const retryResponse = await fetch(url, {
            method: "DELETE",
            headers: newHeaders
          });
          if (retryResponse.status === 401) {
            // console.log removed for security
            const { showMessage } = await import("../components/toast.js");
            showMessage("error", "Session expired. Please log in again.", 5000);
            setTimeout(() => {
              window.location.href = `${window.location.origin  }/login`;
            }, 3000);
            return;
          }
          return await retryResponse.json();
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          const { showMessage } = await import("../components/toast.js");
          showMessage("error", "Session expired. Please log in again.", 5000);
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
          return;
        }
      }
      if (response.status === 403) {
        throw new Error("Insufficient permissions");
      }
      return await response.json();
    } catch (error) {
      console.error("API DELETE error:", error);
      throw error;
    }
  }
  async refreshToken() {
    try {
      // SECURITY: Use Supabase session refresh, never localStorage
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data?.session) throw error || new Error("No session");
      // Update server cookie with new token
      try {
        await fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: data.session.access_token })
        });
      } catch (cookieError) {
        console.error("Failed to update server cookie:", cookieError);
      }
      return true;
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      return false;
    }
  }
  // Convenience methods for common API calls
  async getUserProfile() {
    return await this.get("/api/user/profile");
  }
  async getUserRole() {
    return await this.get("/api/user/role");
  }
  async getAdminStats() {
    return await this.get("/api/admin/stats");
  }
  // Complaint management methods
  async submitComplaint(formData) {
    try {
      // Get fresh CSRF token for this request
      const csrfResponse = await fetch("/api/auth/csrf-token");
      const csrfData = await csrfResponse.json();
      if (!csrfData.success) {
        throw new Error("Failed to get CSRF token");
      }
      // Add the fresh CSRF token to FormData
      formData.append("_csrf", csrfData.csrfToken);
      const response = await fetch("/api/complaints", {
        method: "POST",
        body: formData
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Complaint submission failed");
      }
      return result;
    } catch (error) {
      console.error("[API CLIENT] Complaint submission error:", error);
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
  async updateComplaintStatus(id, status, notes = "") {
    return await this.post(`/api/complaints/${id}/status`, { status, notes });
  }
  // Department Management Methods
  async getDepartments() {
    return await this.get("/api/departments");
  }
  async getActiveDepartments() {
    return await this.get("/api/departments/active");
  }
  async getDepartmentsByType(type) {
    return await this.get(`/api/departments/type/${type}`);
  }
  async getDepartmentOfficers(departmentId) {
    return await this.get(`/api/departments/${departmentId}/officers`);
  }
  async getDepartment(id) {
    return await this.get(`/api/departments/${id}`);
  }
  async createDepartment(data) {
    return await this.post("/api/departments", data);
  }
  // HR Methods
  async generateSignupLink(data) {
    return await this.post("/api/hr/signup-links", data);
  }
  async getSignupLinks(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return await this.get(`/api/hr/signup-links?${queryParams}`);
  }
  async deactivateSignupLink(linkId) {
    return await this.delete(`/api/hr/signup-links/${linkId}`);
  }
  async validateSignupCode(code) {
    return await this.get(`/api/hr/validate-signup-code/${code}`);
  }
  async getHRDashboard() {
    return await this.get("/api/hr/dashboard");
  }
  async updateDepartment(id, data) {
    return await this.put(`/api/departments/${id}`, data);
  }
  async deleteDepartment(id) {
    return await this.delete(`/api/departments/${id}`);
  }
  // Settings Management Methods
  async getSettings() {
    return await this.get("/api/settings");
  }
  async getPublicSettings() {
    return await this.get("/api/settings/public");
  }
  async getSettingsByCategory(category) {
    return await this.get(`/api/settings/category/${category}`);
  }
  async getSetting(key) {
    return await this.get(`/api/settings/${key}`);
  }
  async createSetting(data) {
    return await this.post("/api/settings", data);
  }
  async updateSetting(key, data) {
    return await this.put(`/api/settings/${key}`, data);
  }
  async deleteSetting(key) {
    return await this.delete(`/api/settings/${key}`);
  }
  async initializeDefaultSettings() {
    return await this.post("/api/settings/initialize");
  }
}
const apiClient = new ApiClient();
// Export supabase instance for direct access
apiClient.supabase = supabase;

export default apiClient;
