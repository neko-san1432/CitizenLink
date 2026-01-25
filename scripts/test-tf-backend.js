const tfService = require('../src/server/services/TensorFlowService');

(async () => {
    try {
        console.log('--- Testing TensorFlow Backend ---');
        // This will trigger the logging logic in the service
        await tfService.initialize();
        console.log('--- Test Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
})();
