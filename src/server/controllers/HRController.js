/**
 * HR Controller
 * Handles HR-specific operations including signup link generation
 */
const HRService = require("../services/HRService");
const UserService = require("../services/UserService");
const ComplaintService = require("../services/ComplaintService");

class HRController {

  constructor() {
    this.hrService = new HRService();
    this.userService = UserService;
    this.complaintService = new ComplaintService();
  }
  /**
   * Generate signup link
   */
  async generateSignupLink(req, res) {
    try {
      const { role, department_code, expires_in_hours } = req.body;
      const hrId = req.user.id;
      if (!role) {
        return res.status(400).json({
          success: false,
          error: "Role is required"
        });
      }
      const result = await this.hrService.generateSignupLink(
        hrId,
        role,
        department_code,
        expires_in_hours || 24
      );
      res.json(result);
    } catch (error) {
      console.error("Generate signup link error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate signup link"
      });
    }
  }
  /**
   * Get signup links
   */
  async getSignupLinks(req, res) {
    try {
      const hrId = req.user.id;
      const filters = {
        role: req.query.role,
        department_code: req.query.department_code,
        is_active: req.query.is_active !== undefined ? req.query.is_active === "true" : undefined
      };
      const result = await this.hrService.getSignupLinks(hrId, filters);
      res.json(result);
    } catch (error) {
      console.error("Get signup links error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get signup links"
      });
    }
  }
  /**
   * Deactivate signup link
   */
  async deactivateSignupLink(req, res) {
    try {
      // console.log removed for security
      const { linkId } = req.params;
      const hrId = req.user.id;
      // console.log removed for security
      const result = await this.hrService.deactivateSignupLink(hrId, linkId);
      // console.log removed for security
      res.json(result);
    } catch (error) {
      console.error("[HR-CONTROLLER] Deactivate signup link error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to deactivate signup link"
      });
    }
  }
  /**
   * Validate signup code (public endpoint)
   */
  async validateSignupCode(req, res) {
    try {
      // console.log removed for security
      const { code } = req.params;
      if (!code) {
        // console.log removed for security
        return res.status(400).json({
          success: false,
          error: "Code is required"
        });
      }
      // console.log removed for security
      const result = await this.hrService.validateSignupCode(code);
      // console.log removed for security
      res.json(result);
    } catch (error) {
      console.error("[HR] Validate signup code error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to validate signup code"
      });
    }
  }
  /**
   * Get HR dashboard
   */
  async getDashboard(req, res) {
    try {
      const hrId = req.user.id;
      const result = await this.hrService.getHRDashboard(hrId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Get HR dashboard error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get HR dashboard"
      });
    }
  }
  /**
   * POST /api/hr/promote-to-officer
   */
  async promoteToOfficer(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, department, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, error: "user_id is required" });
      }
      const result = await this.hrService.promoteToOfficer(user_id, hrId, { department, reason });
      return res.json(result);
    } catch (error) {
      console.error("[HR] promoteToOfficer error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to promote user" });
    }
  }
  /**
   * POST /api/hr/promote-to-admin
   */
  async promoteToAdmin(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, department, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, error: "user_id is required" });
      }
      const result = await this.hrService.promoteToAdmin(user_id, hrId, { department, reason });
      return res.json(result);
    } catch (error) {
      console.error("[HR] promoteToAdmin error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to promote user" });
    }
  }
  /**
   * POST /api/hr/demote-to-officer
   */
  async demoteToOfficer(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, error: "user_id is required" });
      }
      const result = await this.hrService.demoteAdminToOfficer(user_id, hrId, { reason });
      return res.json(result);
    } catch (error) {
      console.error("[HR] demoteToOfficer error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to demote user" });
    }
  }
  /**
   * POST /api/hr/strip-titles -> revert to citizen
   */
  async stripTitles(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, error: "user_id is required" });
      }
      if (!reason) {
        return res.status(400).json({ success: false, error: "reason is required" });
      }
      const result = await this.hrService.stripTitles(user_id, hrId, reason);
      return res.json(result);
    } catch (error) {
      console.error("[HR] stripTitles error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to strip titles" });
    }
  }
  /**
   * POST /api/hr/assign-department
   */
  async assignDepartment(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, department_id } = req.body;
      if (!user_id || !department_id) {
        return res.status(400).json({ success: false, error: "user_id and department_id are required" });
      }
      const result = await this.hrService.assignOfficerToDepartment(user_id, department_id, hrId);
      return res.json(result);
    } catch (error) {
      console.error("[HR] assignDepartment error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to assign department" });
    }
  }
  /**
   * GET /api/hr/users
   * Supports search and barangay filter
   */
  async getUsers(req, res) {
    try {
      const { search, barangay, role, department, status, page, limit } = req.query;
      const filters = { role, department, status, search, includeInactive: true };
      const pagination = { page: page ? parseInt(page) : 1, limit: limit ? parseInt(limit) : 20 };
      const result = await this.userService.getUsers(filters, pagination);
      // Apply barangay filter client-side since admin.listUsers lacks server filters
      const filteredUsers = barangay
        ? (result.users || []).filter(u => (u.address?.barangay || "").toLowerCase() === String(barangay).toLowerCase())
        : result.users;
      return res.json({
        success: true,
        data: filteredUsers,
        pagination: result.pagination
      });
    } catch (error) {
      console.error("[HR] getUsers error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to fetch users" });
    }
  }
  /**
   * GET /api/hr/pending-signups
   * List users with status pending_approval (HR-scoped)
   */
  async getPendingSignups(req, res) {
    try {
      const hrId = req.user.id;
      // Reuse UserService listing, then filter by metadata
      const result = await this.userService.getUsers({ includeInactive: true }, { page: 1, limit: 200 });
      const hrDept = req.user?.department || req.user?.raw_user_meta_data?.department || req.user?.raw_user_meta_data?.dpt || null;

      // Get list of users who used signup codes (check signup_links table)
      const Database = require("../config/database");
      const db = Database.getInstance();
      const supabase = db.getClient();

      // Map of user_id -> { role, department_code } from signup_links table
      const usersWithSignupCodes = new Map();
      try {
        const { data: usedLinks, error: linksError } = await supabase
          .from("signup_links")
          .select("used_by, role, department_code")
          .not("used_by", "is", null);

        if (!linksError && usedLinks) {
          usedLinks.forEach(link => {
            if (link.used_by) {
              usersWithSignupCodes.set(link.used_by, {
                role: link.role,
                department_code: link.department_code
              });
            }
          });
          console.log("[HR] Found", usersWithSignupCodes.size, "users who used signup codes");
        } else if (linksError) {
          console.error("[HR] Error fetching signup links:", linksError);
        }
      } catch (linksErr) {
        console.error("[HR] Error fetching signup links:", linksErr);
      }

      // Debug: Log all users to see what we're working with
      console.log("[HR] getPendingSignups - Total users fetched:", result.users?.length || 0);
      console.log("[HR] Sample users (first 5):", result.users?.slice(0, 5).map(u => ({
        email: "[REDACTED]",
        status: u.status,
        raw_status: u.raw_user_meta_data?.status,
        meta_status: u.user_metadata?.status,
        pending_role: u.raw_user_meta_data?.pending_role || u.user_metadata?.pending_role,
        pending_dept: u.raw_user_meta_data?.pending_department || u.user_metadata?.pending_department,
        role: u.role,
        used_signup_code: usersWithSignupCodes.has(u.id)
      })));

      // Filter for pending signups - check both status field and pending_role in metadata
      const pending = (result.users || []).filter(u => {
        // Check status in multiple places
        const status = u.status ||
                      u.raw_user_meta_data?.status ||
                      u.user_metadata?.status ||
                      null;

        // Check for pending_role in metadata (this indicates pending approval)
        const hasPendingRole = u.raw_user_meta_data?.pending_role ||
                              u.user_metadata?.pending_role ||
                              null;

        // Check for pending_signup_code (indicates they used a signup code)
        const hasPendingCode = u.raw_user_meta_data?.pending_signup_code ||
                              u.user_metadata?.pending_signup_code ||
                              null;

        // Check if user used a signup code (from signup_links table)
        const signupCodeInfo = usersWithSignupCodes.get(u.id);
        const usedSignupCode = signupCodeInfo !== undefined;

        // Get pending department from metadata OR from signup_links table
        let pendingDept = u.raw_user_meta_data?.pending_department ||
                         u.user_metadata?.pending_department ||
                         null;
        // If metadata doesn't have pending_department but user used a signup code, get it from signup_links
        if (!pendingDept && signupCodeInfo) {
          pendingDept = signupCodeInfo.department_code;
        }

        // Get pending role from metadata OR from signup_links table
        let pendingRole = hasPendingRole;
        if (!pendingRole && signupCodeInfo) {
          pendingRole = signupCodeInfo.role;
        }

        // User is pending if:
        // 1. status is 'pending_approval' OR
        // 2. has pending_role (from metadata or signup_links) OR
        // 3. has pending_signup_code OR
        // 4. has status 'pending_verification' AND used a signup code (metadata update failed) AND is citizen
        const isPending = status === "pending_approval" ||
                         pendingRole ||
                         hasPendingCode ||
                         (status === "pending_verification" && usedSignupCode && u.role === "citizen");

        if (!isPending) {
          return false;
        }

        // Department filtering:
        // - Super-admin can see ALL pending signups across all offices (no filter)
        // - HR users can only see pending signups within their own office
        const isSuperAdmin = req.user?.normalized_role === "super-admin" || req.user?.role === "super-admin";

        if (!isSuperAdmin && hrDept) {
          // HR user: only show pending signups for their department
          // If pending signup has a department and it doesn't match HR's department, filter it out
          if (pendingDept && pendingDept !== hrDept) {
            return false;
          }
          // If HR has a department but pending signup doesn't have one, we might want to filter it out too
          // (This depends on business logic - for now, we'll allow it if pendingDept is null)
        }

        return true;
      });

      // Enhance pending users with signup code info if metadata is missing
      const enhancedPending = pending.map(u => {
        const signupCodeInfo = usersWithSignupCodes.get(u.id);
        if (signupCodeInfo && (!u.raw_user_meta_data?.pending_role && !u.user_metadata?.pending_role)) {
          // Add pending fields from signup_links if metadata doesn't have them
          return {
            ...u,
            raw_user_meta_data: {
              ...u.raw_user_meta_data,
              pending_role: signupCodeInfo.role,
              pending_department: signupCodeInfo.department_code
            }
          };
        }
        return u;
      });

      console.log("[HR] getPendingSignups - Found", enhancedPending.length, "pending signups for HR:", hrId, "department:", hrDept);
      console.log("[HR] Sample pending users:", enhancedPending.slice(0, 3).map(u => ({
        id: u.id,
        email: "[REDACTED]",
        status: u.status,
        pending_role: u.raw_user_meta_data?.pending_role || u.user_metadata?.pending_role,
        pending_department: u.raw_user_meta_data?.pending_department || u.user_metadata?.pending_department,
        from_signup_links: usersWithSignupCodes.has(u.id)
      })));

      return res.json({ success: true, data: enhancedPending });
    } catch (error) {
      console.error("[HR] getPendingSignups error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to fetch pending signups" });
    }
  }
  /**
   * POST /api/hr/pending-signups/:id/approve
   * Approve a pending signup and apply role/department
   */
  async approvePendingSignup(req, res) {
    try {
      const hrId = req.user.id;
      const userId = req.params.id;
      const user = await this.userService.getUserById(userId);
      if (!user) return res.status(404).json({ success: false, error: "User not found" });

      // Get pending role and department from metadata first
      let pendingRole = user?.raw_user_meta_data?.pending_role || user?.user_metadata?.pending_role;
      let pendingDept = user?.raw_user_meta_data?.pending_department || user?.user_metadata?.pending_department;

      // If not in metadata, check signup_links table (metadata update may have failed)
      if (!pendingRole || !pendingDept) {
        const Database = require("../config/database");
        const db = Database.getInstance();
        const supabase = db.getClient();

        try {
          const { data: signupLinks, error: linkError } = await supabase
            .from("signup_links")
            .select("role, department_code")
            .eq("used_by", userId)
            .not("used_by", "is", null)
            .order("used_at", { ascending: false })
            .limit(1);

          const signupLink = signupLinks && signupLinks.length > 0 ? signupLinks[0] : null;

          if (!linkError && signupLink) {
            if (!pendingRole && signupLink.role) {
              pendingRole = signupLink.role;
            }
            if (!pendingDept && signupLink.department_code) {
              pendingDept = signupLink.department_code;
            }
            console.log("[HR] Got pending role/dept from signup_links:", {
              userId,
              pendingRole,
              pendingDept,
              fromTable: true
            });
          } else if (linkError) {
            console.error("[HR] Error fetching signup link:", linkError);
          }
        } catch (linkErr) {
          console.error("[HR] Error fetching signup link:", linkErr);
        }
      }

      if (!pendingRole) {
        console.error("[HR] No pending role found for user:", userId);
        return res.status(400).json({ success: false, error: "No pending role to approve. User may not have registered with a signup code." });
      }

      // Normalize role using general normalization function
      const { normalizeRole } = require("../utils/roleValidation");
      const normalizedRole = normalizeRole(pendingRole);

      if (pendingRole !== normalizedRole) {
        console.log("[HR] Normalizing role from", pendingRole, "to", normalizedRole, "for user:", userId);
      }

      // Ensure we're using the normalized role consistently
      console.log("[HR] Approval role mapping:", {
        pendingRole,
        normalizedRole,
        userId
      });

      // HR department scope enforcement (super-admin bypasses)
      const isSuper = (req.user?.normalized_role === "super-admin" || req.user?.role === "super-admin");
      if (!isSuper && req.user?.department && pendingDept && String(req.user.department) !== String(pendingDept)) {
        return res.status(403).json({ success: false, error: "You can only approve for your own office" });
      }

      // Apply role/department and clear pending flags
      // Set department in both formats for consistency (department and dpt)
      const updated = await this.userService.updateUser(userId, {
        role: normalizedRole,
        normalized_role: normalizedRole,
        base_role: normalizedRole, // Store base role for reference
        department: pendingDept,
        dpt: pendingDept, // Also set dpt field for consistency
        status: "active",
        pending_role: null,
        pending_department: null,
        pending_signup_code: null
      }, hrId);

      console.log("[HR] Approved signup:", {
        userId,
        role: normalizedRole,
        department: pendingDept,
        originalPendingRole: pendingRole
      });
      return res.json({ success: true, message: "Signup approved", data: updated });
    } catch (error) {
      console.error("[HR] approvePendingSignup error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to approve signup" });
    }
  }
  /**
   * POST /api/hr/pending-signups/:id/reject
   * Reject a pending signup; keep user as citizen and clear flags
   */
  async rejectPendingSignup(req, res) {
    try {
      const hrId = req.user.id;
      const userId = req.params.id;
      const user = await this.userService.getUserById(userId);
      if (!user) return res.status(404).json({ success: false, error: "User not found" });
      const isSuper = (req.user?.normalized_role === "super-admin" || req.user?.role === "super-admin");
      const pendingDept = user?.raw_user_meta_data?.pending_department || user?.user_metadata?.pending_department;
      if (!isSuper && req.user?.department && pendingDept && String(req.user.department) !== String(pendingDept)) {
        return res.status(403).json({ success: false, error: "You can only reject for your own office" });
      }
      const updated = await this.userService.updateUser(userId, {
        role: "citizen",
        normalized_role: "citizen",
        status: "rejected",
        pending_role: null,
        pending_department: null,
        pending_signup_code: null
      }, hrId);
      return res.json({ success: true, message: "Signup rejected", data: updated });
    } catch (error) {
      console.error("[HR] rejectPendingSignup error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to reject signup" });
    }
  }
  /**
   * GET /api/hr/users/:id
   */
  async getUserDetails(req, res) {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      return res.json({ success: true, data: user });
    } catch (error) {
      console.error("[HR] getUserDetails error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to fetch user" });
    }
  }
  /**
   * GET /api/hr/users/:id/complaints
   */
  async getUserComplaints(req, res) {
    try {
      const { id } = req.params;
      const options = {
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 10,
        status: req.query.status,
        type: req.query.type
      };
      const result = await this.complaintService.getUserComplaints(id, options);
      return res.json({
        success: true,
        data: result.complaints,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error("[HR] getUserComplaints error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to fetch complaints" });
    }
  }
}

module.exports = HRController;
