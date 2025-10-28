/**
 * Reminder Service
 * Handles automatic reminders for unworked/unresponded complaints
 */

const Database = require('../config/database');
const supabase = Database.getClient();
const NotificationService = require('./NotificationService');

class ReminderService {
  constructor() {
    this.notificationService = new NotificationService();
    this.reminderIntervals = {
      // First reminder after 24 hours
      first: 24 * 60 * 60 * 1000, // 24 hours
      // Second reminder after 72 hours
      second: 72 * 60 * 60 * 1000, // 72 hours
      // Third reminder after 7 days
      third: 7 * 24 * 60 * 60 * 1000, // 7 days
      // Final reminder after 14 days
      final: 14 * 24 * 60 * 60 * 1000 // 14 days
    };
  }

  /**
   * Start the reminder scheduler
   */
  startScheduler() {
    // console.log removed for security
    
    // Check for reminders every hour
    setInterval(() => {
      this.processReminders();
    }, 60 * 60 * 1000); // 1 hour

    // Initial check
    this.processReminders();
  }

  /**
   * Process all pending reminders
   */
  async processReminders() {
    try {
      // console.log removed for security
      
      const now = new Date();
      const reminders = await this.getPendingReminders(now);
      
      // console.log removed for security
      
      for (const complaint of reminders) {
        await this.sendReminder(complaint);
      }
      
    } catch (error) {
      console.error('[REMINDER_SERVICE] Error processing reminders:', error);
    }
  }

  /**
   * Get complaints that need reminders
   */
  async getPendingReminders(now) {
    try {
      // Get complaints that are assigned but haven't been worked on
      const { data: assignedComplaints, error: assignedError } = await supabase
        .from('complaints')
        .select(`
          id, title, workflow_status, submitted_at, last_activity_at,
          department_r, preferred_departments,
          submitted_by, coordinator_notes
        `)
        .in('workflow_status', ['assigned', 'in_progress'])
        .lt('last_activity_at', new Date(now.getTime() - this.reminderIntervals.first).toISOString());

      if (assignedError) {
        console.error('[REMINDER_SERVICE] Error fetching assigned complaints:', assignedError);
        return [];
      }

      // Get complaints that are pending review for too long
      const { data: pendingComplaints, error: pendingError } = await supabase
        .from('complaints')
        .select(`
          id, title, workflow_status, submitted_at, last_activity_at,
          department_r, preferred_departments,
          submitted_by, coordinator_notes
        `)
        .eq('workflow_status', 'new')
        .lt('submitted_at', new Date(now.getTime() - this.reminderIntervals.first).toISOString());

      if (pendingError) {
        console.error('[REMINDER_SERVICE] Error fetching pending complaints:', pendingError);
        return [];
      }

      // Combine and filter out recently reminded complaints
      const allComplaints = [...(assignedComplaints || []), ...(pendingComplaints || [])];
      const complaintsNeedingReminders = [];

      for (const complaint of allComplaints) {
        const lastReminder = await this.getLastReminder(complaint.id);
        const timeSinceLastReminder = lastReminder ? 
          now.getTime() - new Date(lastReminder.reminded_at).getTime() : 
          now.getTime() - new Date(complaint.submitted_at).getTime();

        // Determine which reminder level this should be
        let reminderLevel = 'first';
        if (timeSinceLastReminder >= this.reminderIntervals.final) {
          reminderLevel = 'final';
        } else if (timeSinceLastReminder >= this.reminderIntervals.third) {
          reminderLevel = 'third';
        } else if (timeSinceLastReminder >= this.reminderIntervals.second) {
          reminderLevel = 'second';
        }

        // Check if we should send this reminder level
        const shouldRemind = this.shouldSendReminder(complaint, reminderLevel, lastReminder);
        
        if (shouldRemind) {
          complaintsNeedingReminders.push({
            ...complaint,
            reminderLevel,
            timeSinceLastReminder
          });
        }
      }

      return complaintsNeedingReminders;
    } catch (error) {
      console.error('[REMINDER_SERVICE] Error getting pending reminders:', error);
      return [];
    }
  }

  /**
   * Determine if a reminder should be sent
   */
  shouldSendReminder(complaint, reminderLevel, lastReminder) {
    const now = new Date();
    const timeSinceLastReminder = lastReminder ? 
      now.getTime() - new Date(lastReminder.reminded_at).getTime() : 
      now.getTime() - new Date(complaint.submitted_at).getTime();

    // Don't send reminders more than once per day
    if (lastReminder && timeSinceLastReminder < 24 * 60 * 60 * 1000) {
      return false;
    }

    // Check if complaint is in a state that needs reminders
    const needsReminder = [
      'new',
      'assigned',
      'in_progress'
    ].includes(complaint.workflow_status);

    if (!needsReminder) {
      return false;
    }

    // Check time thresholds
    switch (reminderLevel) {
      case 'first':
        return timeSinceLastReminder >= this.reminderIntervals.first;
      case 'second':
        return timeSinceLastReminder >= this.reminderIntervals.second;
      case 'third':
        return timeSinceLastReminder >= this.reminderIntervals.third;
      case 'final':
        return timeSinceLastReminder >= this.reminderIntervals.final;
      default:
        return false;
    }
  }

  /**
   * Send reminder for a specific complaint
   */
  async sendReminder(complaint) {
    try {
      // console.log removed for security
      
      // Get department information
      const departments = await this.getComplaintDepartments(complaint);
      
      // Create reminder record
      await this.createReminderRecord(complaint.id, complaint.reminderLevel);
      
      // Send notifications to relevant parties
      await this.sendReminderNotifications(complaint, departments, complaint.reminderLevel);
      
      // console.log removed for security
      
    } catch (error) {
      console.error(`[REMINDER_SERVICE] Error sending reminder for complaint ${complaint.id}:`, error);
    }
  }

  /**
   * Get departments associated with a complaint
   */
  async getComplaintDepartments(complaint) {
    const departments = [];
    
    // Get departments from department_r array
    if (complaint.department_r && complaint.department_r.length > 0) {
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name, code')
        .in('code', complaint.department_r);
      
      if (deptData) {
        departments.push(...deptData);
      }
    }

    // Get preferred departments from JSONB
    if (complaint.preferred_departments && Array.isArray(complaint.preferred_departments)) {
      const { data: preferredDepts } = await supabase
        .from('departments')
        .select('id, name, code')
        .in('code', complaint.preferred_departments);
      
      if (preferredDepts) {
        departments.push(...preferredDepts);
      }
    }

    return departments;
  }

  /**
   * Create reminder record in database
   */
  async createReminderRecord(complaintId, reminderLevel) {
    const { error } = await supabase
      .from('complaint_reminders')
      .insert({
        complaint_id: complaintId,
        reminder_type: reminderLevel,
        reminded_at: new Date().toISOString()
      });

    if (error) {
      console.error('[REMINDER_SERVICE] Error creating reminder record:', error);
      throw error;
    }
  }

  /**
   * Send reminder notifications
   */
  async sendReminderNotifications(complaint, departments, reminderLevel) {
    const reminderMessages = {
      first: {
        title: 'Complaint Reminder',
        message: `Complaint "${complaint.title}" has been pending for 24+ hours and needs attention.`,
        priority: 'warning'
      },
      second: {
        title: 'Urgent Complaint Reminder',
        message: `Complaint "${complaint.title}" has been pending for 3+ days and requires immediate attention.`,
        priority: 'urgent'
      },
      third: {
        title: 'Critical Complaint Reminder',
        message: `Complaint "${complaint.title}" has been pending for 1+ week and needs urgent resolution.`,
        priority: 'urgent'
      },
      final: {
        title: 'Final Complaint Reminder',
        message: `Complaint "${complaint.title}" has been pending for 2+ weeks. This is the final reminder.`,
        priority: 'urgent'
      }
    };

    const reminder = reminderMessages[reminderLevel];
    if (!reminder) return;

    // Notify complaint coordinator
    await this.notifyCoordinator(complaint, reminder);

    // Notify department admins
    await this.notifyDepartmentAdmins(complaint, departments, reminder);

    // Notify citizen if complaint is very overdue
    if (reminderLevel === 'third' || reminderLevel === 'final') {
      await this.notifyCitizen(complaint, reminder);
    }
  }

  /**
   * Notify complaint coordinator
   */
  async notifyCoordinator(complaint, reminder) {
    try {
      // Get coordinator users
      const { data: coordinators } = await supabase.auth.admin.listUsers();
      const coordinatorIds = coordinators?.users
        ?.filter(user => user.raw_user_meta_data?.role === 'complaint-coordinator')
        ?.map(user => user.id) || [];

      if (coordinatorIds.length > 0) {
        for (const coordinatorId of coordinatorIds) {
          await this.notificationService.createNotification(
            coordinatorId,
            'complaint_reminder',
            reminder.title,
            reminder.message,
            {
              priority: reminder.priority,
              link: `/coordinator/review-queue`,
              metadata: {
                complaint_id: complaint.id,
                reminder_level: reminder.reminderLevel
              }
            }
          );
        }
      }
    } catch (error) {
      console.error('[REMINDER_SERVICE] Error notifying coordinator:', error);
    }
  }

  /**
   * Notify department admins
   */
  async notifyDepartmentAdmins(complaint, departments, reminder) {
    try {
      for (const department of departments) {
        // Get department admin users
        const { data: allUsers } = await supabase.auth.admin.listUsers();
        const admins = allUsers?.users
          ?.filter(user => user.raw_user_meta_data?.role === 'lgu-admin' && user.raw_user_meta_data?.dpt === department.code)
          ?.map(user => user.id) || [];

        if (admins.length > 0) {
          for (const adminId of admins) {
            await this.notificationService.createNotification(
              adminId,
              'complaint_reminder',
              reminder.title,
              reminder.message,
              {
                priority: reminder.priority,
                link: `/lgu-admin/department-queue`,
                metadata: {
                  complaint_id: complaint.id,
                  department: department.name,
                  reminder_level: reminder.reminderLevel
                }
              }
            );
          }
        }
      }
    } catch (error) {
      console.error('[REMINDER_SERVICE] Error notifying department admins:', error);
    }
  }

  /**
   * Notify citizen
   */
  async notifyCitizen(complaint, reminder) {
    try {
      if (complaint.submitted_by) {
        await this.notificationService.createNotification(
          complaint.submitted_by,
          'complaint_reminder',
          reminder.title,
          reminder.message,
          {
            priority: reminder.priority,
            link: `/citizen/complaints/${complaint.id}`,
            metadata: {
              complaint_id: complaint.id,
              reminder_level: reminder.reminderLevel
            }
          }
        );
      }
    } catch (error) {
      console.error('[REMINDER_SERVICE] Error notifying citizen:', error);
    }
  }

  /**
   * Get last reminder for a complaint
   */
  async getLastReminder(complaintId) {
    const { data, error } = await supabase
      .from('complaint_reminders')
      .select('*')
      .eq('complaint_id', complaintId)
      .order('reminded_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[REMINDER_SERVICE] Error getting last reminder:', error);
    }

    return data;
  }

  /**
   * Stop the reminder scheduler
   */
  stopScheduler() {
    // console.log removed for security
    // Note: In a real implementation, you'd store the interval ID and clear it here
  }
}

module.exports = ReminderService;
