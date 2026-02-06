const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logPath = path.join(process.cwd(), 'log.txt');
    }

    /**
     * Log a message to file (and optionally console)
     * @param {string} tag - The log tag (e.g. 'NLP-HITL', 'AUTH')
     * @param {string} message - The message string
     * @param {any} data - Optional data object to stringify
     * @param {boolean} consoleOutput - Whether to also print to console (default: false for reduced noise)
     */
    log(tag, message, data = null, consoleOutput = false) {
        const timestamp = new Date().toISOString();
        const dataStr = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : '';
        const logLine = `[${timestamp}] [${tag}] ${message} ${dataStr}\n`;

        // Write to file
        fs.appendFile(this.logPath, logLine, (err) => {
            if (err) {
                // Fallback to console if file write fails, to ensure we don't lose the error
                console.error(`[LOGGER] Failed to write to log.txt:`, err);
            }
        });

        // Optional console output
        if (consoleOutput) {
            console.log(`[${tag}] ${message}`, data || '');
        }
    }
}

module.exports = new Logger();
