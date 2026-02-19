
const tfService = require('./src/server/services/TensorFlowService');

(async () => {
    try {
        console.log('Attempting to initialize TensorFlowService...');
        await tfService.initialize();
        console.log('Initialization complete.');
    } catch (error) {
        console.error('Initialization failed:', error);
    }
})();
