/**
 * Console Logger
 * Captures console output for display in server logs page
 */

class ConsoleLogger {
  constructor(maxLogs = 1000) {
    this.logs = [];
    this.maxLogs = maxLogs;
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };
    this.isCapturing = false;
  }

  /**
   * Start capturing console output
   */
  startCapture() {
    if (this.isCapturing) return;

    this.isCapturing = true;
    const self = this;

    const formatTimestamp = () => {
      return `[${new Date().toISOString()}]`;
    };

    // Override console.log
    console.log = function (...args) {
      self.addLog("log", args);
      self.originalConsole.log.apply(console, [formatTimestamp(), ...args]);
    };

    // Override console.error
    console.error = function (...args) {
      self.addLog("error", args);
      self.originalConsole.error.apply(console, [formatTimestamp(), ...args]);
    };

    // Override console.warn
    console.warn = function (...args) {
      self.addLog("warn", args);
      self.originalConsole.warn.apply(console, [formatTimestamp(), ...args]);
    };

    // Override console.info
    console.info = function (...args) {
      self.addLog("info", args);
      self.originalConsole.info.apply(console, [formatTimestamp(), ...args]);
    };

    // Override console.debug
    console.debug = function (...args) {
      self.addLog("debug", args);
      self.originalConsole.debug.apply(console, [formatTimestamp(), ...args]);
    };
  }

  /**
   * Stop capturing console output
   */
  stopCapture() {
    if (!this.isCapturing) return;

    this.isCapturing = false;
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
  }

  /**
   * Add a log entry
   */
  addLog(level, args) {
    const timestamp = new Date();
    const message = args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    this.logs.push({
      level,
      message,
      timestamp: timestamp.toISOString(),
      timestampFormatted: timestamp.toLocaleString(),
    });

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(options = {}) {
    const { level, limit = 500, since = null } = options;

    let filteredLogs = [...this.logs];

    // Filter by level
    if (level && level !== "all") {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }

    // Filter by timestamp
    if (since) {
      const sinceDate = new Date(since);
      filteredLogs = filteredLogs.filter(
        (log) => new Date(log.timestamp) >= sinceDate
      );
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    return filteredLogs.slice(0, limit);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Get log count
   */
  getLogCount() {
    return this.logs.length;
  }
}

// Create singleton instance
const consoleLogger = new ConsoleLogger(1000);

// Start capturing immediately
consoleLogger.startCapture();

module.exports = consoleLogger;
