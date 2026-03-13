const Database = require("../../config/database");

class NotificationReadService {
  constructor(supabase) {
    this.supabase = supabase || Database.getClient();
  }

  async getUserNotifications(userId, page = 0, limit = 10) {
    try {
      const offset = page * limit;
      const { data, error } = await this.supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { success: true, notifications: data || [] };
    } catch (error) {
      console.error("[NOTIFICATION] Get error:", error);
      return { success: false, error: error.message };
    }
  }

  async getUnreadCount(userId) {
    try {
      const { count, error } = await this.supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error) {
      console.error("[NOTIFICATION] Count error:", error);
      return { success: false, error: error.message };
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      const { error } = await this.supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[NOTIFICATION] Mark read error:", error);
      return { success: false, error: error.message };
    }
  }

  async markAllAsRead(userId) {
    try {
      const { error } = await this.supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[NOTIFICATION] Mark all read error:", error);
      return { success: false, error: error.message };
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      const { error } = await this.supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[NOTIFICATION] Delete error:", error);
      return { success: false, error: error.message };
    }
  }

  async getNotificationSummary(userId) {
    try {
      const { data, error } = await this.supabase
        .from("notifications")
        .select("type, is_read")
        .eq("user_id", userId);

      if (error) throw error;

      const total = data?.length || 0;
      const unread = data?.filter(n => !n.is_read).length || 0;
      const read = total - unread;

      return {
        success: true,
        summary: { total, unread, read }
      };
    } catch (error) {
      console.error("[NOTIFICATION] Summary error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationReadService;
