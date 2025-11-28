require('dotenv').config();
const ReminderService = require('../src/server/services/ReminderService');

async function run() {
  console.log('Triggering ReminderService...');
  const service = new ReminderService();
  await service.processReminders();
  console.log('Done.');
}

run().catch(console.error);
