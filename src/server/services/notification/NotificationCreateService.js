const Database = require("../../config/database");

const {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_ICONS
} = require("../../../shared/constants");

class NotificationCreateService {
  constructor(supabase) {
    this.supabase = supabase || Database.getClient();
  }

  async createNotification(userIdOrOptions, type, title, message, options = {}) {
    try {
      let userId, notifType, notifTitle, notifMessage, notifOptions;
      if (typeof userIdOrOptions === "object" && !type) {
        const opts = userIdOrOptions;
        userId = opts.userId;
        notifType = opts.type;
        notifTitle = opts.title;
        notifMessage = opts.message;
        notifOptions = {
          priority: opts.priority,
          link: opts.link,
          metadata: opts.metadata
        };
      } else {
        userId = userIdOrOptions;
        notifType = type;
        notifTitle = title;
        notifMessage = message;
        notifOptions = options;
      }

      const { data, error } = await this.supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          priority: notifOptions.priority || NOTIFICATION_PRIORITY.INFO,
          link: notifOptions.link || null,
          metadata: notifOptions.metadata || null,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, notification: data };
    } catch (error) {
      console.error("[NOTIFICATION] Create error:", error);
      return { success: false, error: error.message };
    }
  }

  async createBulkNotifications(notifications, deduplicate = true) {
    if (!notifications || notifications.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      let toInsert = notifications;
      if (deduplicate) {
        const unique = new Map();
        for (const n of notifications) {
          const key = `${n.userId}-${n.type}-${n.title}`;
          if (!unique.has(key)) unique.set(key, n);
        }
        toInsert = Array.from(unique.values());
      }

      const inserts = toInsert.map(n => ({
        user_id: n.userId,
        type: n.type || NOTIFICATION_TYPES.GENERAL,
        title: n.title,
        message: n.message,
        priority: n.priority || NOTIFICATION_PRIORITY.INFO,
        link: n.link || null,
        metadata: n.metadata || null,
        is_read: false
      }));

      const { data, error } = await this.supabase
        .from("notifications")
        .insert(inserts)
        .select();

      if (error) throw error;
      return { success: true, count: data?.length || 0, notifications: data };
    } catch (error) {
      console.error("[NOTIFICATION] Bulk create error:", error);
      return { success: false, error: error.message };
    }
  }

  async notifyComplaintSubmitted(citizenId, complaintId, complaintTitle) {
    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
      title: "Complaint Submitted",
      message: `Your complaint "${complaintTitle}" has been submitted successfully.`,
      priority: NOTIFICATION_PRIORITY.SUCCESS,
      link: `/complaint/${complaintId}`
    });
  }

  async checkDuplicateNotification(userId, type, title, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("title", title)
        .eq("is_read", false)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.warn("[NOTIFICATION] Duplicate check error:", error.message);
        return { exists: false };
      }

      const exists = data && data.length > 0;
      return { exists, notification: exists ? data[0] : null };
    } catch (error) {
      console.warn("[NOTIFICATION] Duplicate check error:", error.message);
      return { exists: false };
    }
  }
}

module.exports = NotificationCreateService;
