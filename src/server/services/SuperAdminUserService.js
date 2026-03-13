const RoleManagementService = require("./RoleManagementService");
const { USER_ROLES } = require("../../shared/constants");
const Database = require("../config/database");

class SuperAdminUserService {
  constructor(supabase) {
    this.roleService = new RoleManagementService();
    this.supabase = supabase || Database.getClient();
  }

  async roleSwap(userId, newRole, superAdminId, reason) {
    const adminRole = await this.roleService.getUserRole(superAdminId);
    if (adminRole !== "super-admin") {
      throw new Error("Only Super Admin can perform role swaps");
    }

    const currentRole = await this.roleService.getUserRole(userId);
    if (currentRole === "super-admin" && userId !== superAdminId) {
      throw new Error("Cannot change another Super Admin's role");
    }

    const validRoles = Object.values(USER_ROLES);
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }

    if (process.env.SIMPLE_WORKFLOW_MODE === "true") {
      const allowedSwaps = ["citizen", "lgu", "super-admin"];
      if (!allowedSwaps.includes(newRole)) {
        throw new Error(`Role '${newRole}' is not allowed in Simple Workflow Mode.`);
      }
    }

    const metadata = {
      reason: reason || "Role swap by Super Admin",
      swap_type: "super_admin_role_swap",
    };

    if (newRole === "citizen") {
      metadata.department = null;
      metadata.clear_department = true;
    }

    return await this.roleService.updateUserRole(userId, newRole, superAdminId, metadata);
  }

  async getAllUsers(filters = {}) {
    let query = this.supabase
      .from("profiles")
      .select("*, profiles!inner(*)");

    if (filters.role) {
      query = query.eq("role", filters.role);
    }
    if (filters.department) {
      query = query.eq("department", filters.department);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getUserById(userId) {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data;
  }

  async updateUser(userId, updates) {
    const { data, error } = await this.supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteUser(userId) {
    const { error } = await this.supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (error) throw error;
    return { success: true };
  }
}

module.exports = SuperAdminUserService;
