/**
 * CitizenLink Live Sync Module v1.0
 * ==================================
 * Real-time data synchronization for thesis defense demonstration.
 * 
 * This module enables:
 * - Cross-tab communication via BroadcastChannel API
 * - LocalStorage-based persistence for same-origin sharing
 * - Automatic polling fallback for older browsers
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  PANELIST DEVICE (Mobile/Laptop)                            │
 * │  http://192.168.x.x:5500/src/submit/index.html             │
 * │  └─> Submits complaints → localStorage + BroadcastChannel  │
 * └────────────────────────┬────────────────────────────────────┘
 *                          │ Same WiFi Network
 *                          │ (localStorage sync via polling)
 * ┌────────────────────────▼────────────────────────────────────┐
 * │  PRESENTER DEVICE (Main Display)                            │
 * │  http://192.168.x.x:5500/src/dashboard/index.html          │
 * │  └─> Receives complaints → Updates map in real-time        │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * @author CitizenLink Development Team
 * @version 1.0.0
 */

(function(global) {
    'use strict';
    
    // ==================== CONFIGURATION ====================
    
    const CONFIG = {
        STORAGE_KEY: 'citizenlink_live_complaints',
        BROADCAST_CHANNEL: 'citizenlink_sync',
        POLL_INTERVAL: 2000,  // Check for new data every 2 seconds
        MAX_COMPLAINTS: 500,  // Maximum complaints to store
        DEBUG: true
    };
    
    // ==================== STATE ====================
    
    let broadcastChannel = null;
    let pollInterval = null;
    let lastKnownCount = 0;
    let onNewComplaintCallbacks = [];
    let onSyncCallbacks = [];
    
    // ==================== LOGGING ====================
    
    function log(message, data = null) {
        if (CONFIG.DEBUG) {
            const timestamp = new Date().toLocaleTimeString();
            if (data) {
                console.log(`[LIVE-SYNC ${timestamp}] ${message}`, data);
            } else {
                console.log(`[LIVE-SYNC ${timestamp}] ${message}`);
            }
        }
    }
    
    // ==================== BROADCAST CHANNEL ====================
    
    function initBroadcastChannel() {
        try {
            broadcastChannel = new BroadcastChannel(CONFIG.BROADCAST_CHANNEL);
            
            broadcastChannel.onmessage = (event) => {
                log('Received broadcast message:', event.data);
                
                if (event.data.type === 'NEW_COMPLAINT') {
                    handleNewComplaint(event.data.complaint, 'broadcast');
                } else if (event.data.type === 'SYNC_REQUEST') {
                    // Another tab is requesting sync
                    broadcastAllComplaints();
                } else if (event.data.type === 'SYNC_DATA') {
                    // Received full sync data
                    handleSyncData(event.data.complaints);
                }
            };
            
            broadcastChannel.onerror = (error) => {
                log('BroadcastChannel error:', error);
            };
            
            log('BroadcastChannel initialized successfully');
            return true;
        } catch (error) {
            log('BroadcastChannel not supported:', error.message);
            return false;
        }
    }
    
    function broadcastNewComplaint(complaint) {
        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage({
                    type: 'NEW_COMPLAINT',
                    complaint: complaint
                });
                log('Broadcasted new complaint:', complaint.id);
            } catch (error) {
                log('Broadcast failed:', error.message);
            }
        }
    }
    
    function broadcastAllComplaints() {
        if (broadcastChannel) {
            const complaints = getAllComplaints();
            broadcastChannel.postMessage({
                type: 'SYNC_DATA',
                complaints: complaints
            });
            log('Broadcasted full sync data:', complaints.length, 'complaints');
        }
    }
    
    function requestSync() {
        if (broadcastChannel) {
            broadcastChannel.postMessage({ type: 'SYNC_REQUEST' });
            log('Requested sync from other tabs');
        }
    }
    
    // ==================== LOCAL STORAGE ====================
    
    function getAllComplaints() {
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            log('Error reading localStorage:', error.message);
            return [];
        }
    }
    
    function saveComplaint(complaint) {
        try {
            const complaints = getAllComplaints();
            
            // Check for duplicates
            if (complaints.some(c => c.id === complaint.id)) {
                log('Duplicate complaint skipped:', complaint.id);
                return false;
            }
            
            complaints.push(complaint);
            
            // Trim if too many
            if (complaints.length > CONFIG.MAX_COMPLAINTS) {
                complaints.splice(0, complaints.length - CONFIG.MAX_COMPLAINTS);
            }
            
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(complaints));
            log('Saved complaint to localStorage:', complaint.id);
            
            // Trigger storage event for cross-tab sync
            triggerStorageEvent();
            
            return true;
        } catch (error) {
            log('Error saving to localStorage:', error.message);
            return false;
        }
    }
    
    function triggerStorageEvent() {
        // Force storage event for same-origin tabs
        const key = CONFIG.STORAGE_KEY + '_trigger';
        localStorage.setItem(key, Date.now().toString());
        localStorage.removeItem(key);
    }
    
    function clearAllComplaints() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            lastKnownCount = 0;
            log('Cleared all live complaints');
            return true;
        } catch (error) {
            log('Error clearing localStorage:', error.message);
            return false;
        }
    }
    
    // ==================== POLLING (FALLBACK SYNC) ====================
    
    function startPolling() {
        if (pollInterval) return;
        
        lastKnownCount = getAllComplaints().length;
        
        pollInterval = setInterval(() => {
            checkForNewComplaints();
        }, CONFIG.POLL_INTERVAL);
        
        log('Started polling for new complaints every', CONFIG.POLL_INTERVAL, 'ms');
    }
    
    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
            log('Stopped polling');
        }
    }
    
    function checkForNewComplaints() {
        const complaints = getAllComplaints();
        const currentCount = complaints.length;
        
        if (currentCount > lastKnownCount) {
            // New complaints detected
            const newComplaints = complaints.slice(lastKnownCount);
            log('Detected', newComplaints.length, 'new complaints via polling');
            
            newComplaints.forEach(complaint => {
                handleNewComplaint(complaint, 'poll');
            });
            
            lastKnownCount = currentCount;
        }
    }
    
    // ==================== EVENT HANDLERS ====================
    
    function handleNewComplaint(complaint, source) {
        log(`New complaint from ${source}:`, complaint.id, complaint.category);
        
        // Notify all registered callbacks
        onNewComplaintCallbacks.forEach(callback => {
            try {
                callback(complaint, source);
            } catch (error) {
                log('Callback error:', error.message);
            }
        });
    }
    
    function handleSyncData(complaints) {
        log('Received sync data:', complaints.length, 'complaints');
        
        onSyncCallbacks.forEach(callback => {
            try {
                callback(complaints);
            } catch (error) {
                log('Sync callback error:', error.message);
            }
        });
    }
    
    // ==================== STORAGE EVENT LISTENER ====================
    
    function initStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key === CONFIG.STORAGE_KEY && event.newValue) {
                log('Storage event detected');
                checkForNewComplaints();
            }
        });
        log('Storage event listener initialized');
    }
    
    // ==================== PUBLIC API ====================
    
    const LiveSync = {
        /**
         * Initialize the live sync module.
         * Call this once on page load.
         * 
         * @param {Object} options - Configuration options
         * @param {boolean} options.enablePolling - Enable polling fallback (default: true)
         * @param {number} options.pollInterval - Polling interval in ms (default: 2000)
         */
        init: function(options = {}) {
            log('Initializing LiveSync module...');
            
            // Apply custom options
            if (options.pollInterval) {
                CONFIG.POLL_INTERVAL = options.pollInterval;
            }
            
            // Initialize BroadcastChannel
            initBroadcastChannel();
            
            // Initialize storage event listener
            initStorageListener();
            
            // Start polling (fallback for cross-device sync)
            if (options.enablePolling !== false) {
                startPolling();
            }
            
            // Load initial count
            lastKnownCount = getAllComplaints().length;
            
            log('LiveSync initialized with', lastKnownCount, 'existing complaints');
            
            return this;
        },
        
        /**
         * Submit a new complaint.
         * Saves to localStorage and broadcasts to other tabs.
         * 
         * @param {Object} complaint - The complaint object
         * @returns {boolean} Success status
         */
        submitComplaint: function(complaint) {
            // Ensure required fields
            if (!complaint.id) {
                complaint.id = this.generateId();
            }
            if (!complaint.timestamp) {
                complaint.timestamp = new Date().toISOString();
            }
            if (!complaint.source) {
                complaint.source = 'live_submission';
            }
            
            // Save locally
            const saved = saveComplaint(complaint);
            
            if (saved) {
                // Broadcast to other tabs
                broadcastNewComplaint(complaint);
                lastKnownCount++;
            }
            
            return saved;
        },
        
        /**
         * Get all live complaints.
         * 
         * @returns {Array} Array of complaint objects
         */
        getAllComplaints: function() {
            return getAllComplaints();
        },
        
        /**
         * Get live complaints filtered by time range.
         * 
         * @param {number} hoursAgo - Only return complaints from last N hours
         * @returns {Array} Filtered array of complaints
         */
        getRecentComplaints: function(hoursAgo = 2) {
            const cutoff = Date.now() - (hoursAgo * 60 * 60 * 1000);
            return getAllComplaints().filter(c => {
                return new Date(c.timestamp).getTime() > cutoff;
            });
        },
        
        /**
         * Register a callback for new complaints.
         * 
         * @param {Function} callback - Function(complaint, source) to call
         */
        onNewComplaint: function(callback) {
            if (typeof callback === 'function') {
                onNewComplaintCallbacks.push(callback);
                log('Registered new complaint callback');
            }
        },
        
        /**
         * Register a callback for full sync events.
         * 
         * @param {Function} callback - Function(complaints) to call
         */
        onSync: function(callback) {
            if (typeof callback === 'function') {
                onSyncCallbacks.push(callback);
                log('Registered sync callback');
            }
        },
        
        /**
         * Request sync from other tabs.
         */
        requestSync: function() {
            requestSync();
        },
        
        /**
         * Clear all live complaints.
         */
        clear: function() {
            return clearAllComplaints();
        },
        
        /**
         * Generate a unique complaint ID.
         */
        generateId: function() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 8);
            return `LIVE-${timestamp}-${random}`.toUpperCase();
        },
        
        /**
         * Get the current count of live complaints.
         */
        getCount: function() {
            return getAllComplaints().length;
        },
        
        /**
         * Stop the sync module.
         */
        destroy: function() {
            stopPolling();
            if (broadcastChannel) {
                broadcastChannel.close();
                broadcastChannel = null;
            }
            onNewComplaintCallbacks = [];
            onSyncCallbacks = [];
            log('LiveSync destroyed');
        }
    };
    
    // Export to global scope
    global.LiveSync = LiveSync;
    
})(typeof window !== 'undefined' ? window : this);
