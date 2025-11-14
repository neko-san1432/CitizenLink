/**
 * Initialize Recommended Settings
 *
 * This script creates/updates all recommended settings for the CitizenLink system.
 * Run with: node scripts/initialize-settings.js
 */

require('dotenv').config();
const SettingService = require('../src/server/services/SettingService');

const recommendedSettings = [
  // Workflow & Timing Settings
  {
    key: 'coordinator_review_deadline_hours',
    value: '24',
    type: 'number',
    category: 'workflow',
    description: 'Hours before coordinator review reminder',
    is_public: false
  },
  {
    key: 'admin_assignment_deadline_hours',
    value: '48',
    type: 'number',
    category: 'workflow',
    description: 'Hours before admin assignment reminder',
    is_public: false
  },
  {
    key: 'officer_response_deadline_hours',
    value: '72',
    type: 'number',
    category: 'workflow',
    description: 'Default hours for officer to respond',
    is_public: false
  },
  {
    key: 'citizen_confirmation_deadline_days',
    value: '7',
    type: 'number',
    category: 'workflow',
    description: 'Days for citizen to confirm resolution',
    is_public: true
  },

  // Reminder Settings
  {
    key: 'reminder_first_hours',
    value: '24',
    type: 'number',
    category: 'notifications',
    description: 'Hours before first reminder',
    is_public: false
  },
  {
    key: 'reminder_second_hours',
    value: '72',
    type: 'number',
    category: 'notifications',
    description: 'Hours before second reminder',
    is_public: false
  },
  {
    key: 'reminder_third_days',
    value: '7',
    type: 'number',
    category: 'notifications',
    description: 'Days before third reminder',
    is_public: false
  },
  {
    key: 'reminder_final_days',
    value: '14',
    type: 'number',
    category: 'notifications',
    description: 'Days before final reminder',
    is_public: false
  },
  {
    key: 'reminder_cooldown_hours',
    value: '24',
    type: 'number',
    category: 'notifications',
    description: 'Minimum hours between reminders',
    is_public: false
  },
  {
    key: 'reminder_check_interval_hours',
    value: '1',
    type: 'number',
    category: 'notifications',
    description: 'How often to check for reminders',
    is_public: false
  },

  // File Upload Settings
  {
    key: 'upload_max_file_size_mb',
    value: '10',
    type: 'number',
    category: 'uploads',
    description: 'Maximum file size in MB',
    is_public: true
  },
  {
    key: 'upload_max_files',
    value: '5',
    type: 'number',
    category: 'uploads',
    description: 'Maximum number of files per complaint',
    is_public: true
  },
  {
    key: 'upload_allowed_types',
    value: '["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"]',
    type: 'json',
    category: 'uploads',
    description: 'Allowed MIME types for uploads',
    is_public: true
  },

  // Pagination Settings
  {
    key: 'pagination_default_limit',
    value: '20',
    type: 'number',
    category: 'ui',
    description: 'Default items per page',
    is_public: false
  },
  {
    key: 'pagination_max_limit',
    value: '100',
    type: 'number',
    category: 'ui',
    description: 'Maximum items per page',
    is_public: false
  },

  // Security Settings
  {
    key: 'session_timeout_hours',
    value: '4',
    type: 'number',
    category: 'security',
    description: 'Session timeout in hours',
    is_public: false
  },
  {
    key: 'token_refresh_interval_minutes',
    value: '5',
    type: 'number',
    category: 'security',
    description: 'Token refresh check interval',
    is_public: false
  },
  {
    key: 'password_min_length',
    value: '8',
    type: 'number',
    category: 'security',
    description: 'Minimum password length',
    is_public: true
  },
  {
    key: 'rate_limit_requests_per_minute',
    value: '60',
    type: 'number',
    category: 'security',
    description: 'API rate limit per minute',
    is_public: false
  },

  // Notification Settings
  {
    key: 'notifications_enabled',
    value: 'true',
    type: 'boolean',
    category: 'notifications',
    description: 'Enable system notifications',
    is_public: false
  },
  {
    key: 'email_notifications_enabled',
    value: 'false',
    type: 'boolean',
    category: 'notifications',
    description: 'Enable email notifications (requires email service)',
    is_public: false
  },
  {
    key: 'notification_retention_days',
    value: '30',
    type: 'number',
    category: 'notifications',
    description: 'Days to retain notifications',
    is_public: false
  },

  // Department Settings
  {
    key: 'department_default_response_hours',
    value: '24',
    type: 'number',
    category: 'departments',
    description: 'Default department response time in hours',
    is_public: false
  },
  {
    key: 'department_default_escalation_hours',
    value: '72',
    type: 'number',
    category: 'departments',
    description: 'Default escalation time in hours',
    is_public: false
  },

  // Priority & Escalation Settings
  {
    key: 'priority_auto_escalation_enabled',
    value: 'true',
    type: 'boolean',
    category: 'workflow',
    description: 'Enable automatic priority escalation',
    is_public: false
  },
  {
    key: 'priority_escalation_hours',
    value: '{"low": 168, "medium": 72, "high": 24, "urgent": 4}',
    type: 'json',
    category: 'workflow',
    description: 'Hours before auto-escalation by priority',
    is_public: false
  },

  // UI/UX Settings
  {
    key: 'map_default_zoom',
    value: '13',
    type: 'number',
    category: 'ui',
    description: 'Default map zoom level',
    is_public: false
  },
  {
    key: 'map_default_center',
    value: '{"lat": 7.1917, "lng": 125.0922}',
    type: 'json',
    category: 'ui',
    description: 'Default map center (Digos City coordinates)',
    is_public: false
  },
  {
    key: 'dashboard_refresh_interval_seconds',
    value: '30',
    type: 'number',
    category: 'ui',
    description: 'Dashboard auto-refresh interval',
    is_public: false
  },

  // Feature Flags
  {
    key: 'feature_duplicate_detection',
    value: 'true',
    type: 'boolean',
    category: 'features',
    description: 'Enable duplicate complaint detection',
    is_public: false
  },
  {
    key: 'feature_false_complaint_marking',
    value: 'true',
    type: 'boolean',
    category: 'features',
    description: 'Enable false complaint marking',
    is_public: false
  },
  {
    key: 'feature_task_forces',
    value: 'true',
    type: 'boolean',
    category: 'features',
    description: 'Enable task force assignments',
    is_public: false
  },
  {
    key: 'feature_heatmap',
    value: 'true',
    type: 'boolean',
    category: 'features',
    description: 'Enable complaint heatmap visualization',
    is_public: false
  },
  {
    key: 'feature_citizen_reminders',
    value: 'true',
    type: 'boolean',
    category: 'features',
    description: 'Allow citizens to send manual reminders',
    is_public: true
  },

  // System Maintenance Settings
  {
    key: 'maintenance_mode',
    value: 'false',
    type: 'boolean',
    category: 'system',
    description: 'Enable maintenance mode',
    is_public: true
  },
  {
    key: 'maintenance_message',
    value: 'System is under maintenance. Please check back later.',
    type: 'text',
    category: 'system',
    description: 'Maintenance mode message',
    is_public: true
  },
  {
    key: 'audit_log_retention_days',
    value: '365',
    type: 'number',
    category: 'system',
    description: 'Days to retain audit logs',
    is_public: false
  }
];

async function initializeSettings() {
  console.log('🚀 Starting settings initialization...\n');

  const settingService = new SettingService();
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const setting of recommendedSettings) {
    try {
      await settingService.upsertSetting(setting);
      console.log(`✅ Created/Updated: ${setting.key} (${setting.category})`);
      success++;
    } catch (error) {
      console.error(`❌ Failed: ${setting.key} - ${error.message}`);
      errors.push({ key: setting.key, error: error.message });
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Succeeded: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    errors.forEach(({ key, error }) => {
      console.log(`   - ${key}: ${error}`);
    });
  }

  if (success === recommendedSettings.length) {
    console.log('\n🎉 All settings initialized successfully!');
  } else {
    console.log('\n⚠️  Some settings failed to initialize. Please review errors above.');
  }
}

// Run if called directly
if (require.main === module) {
  initializeSettings()
    .then(() => {
      console.log('\n✨ Settings initialization complete.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { initializeSettings, recommendedSettings };

<<<<<<< HEAD





=======
>>>>>>> 55de51f3fa3db603cdb3e11f736f1c90f3a780b3
