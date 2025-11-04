/**
 * Toast Notification Service
 * Handles real-time toast notifications using Server-Sent Events
 */

import showToast from '../components/toast.js';

class ToastNotificationService {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
  }

  /**
   * Start listening for real-time notifications
   */
  startListening() {
    if (this.isConnected) {
      console.log('[TOAST_NOTIFICATION] Already connected to notification stream');
      return;
    }

    try {
      this.eventSource = new EventSource('/api/notifications/stream', {
        withCredentials: true
      });

      this.eventSource.onopen = () => {
        console.log('[TOAST_NOTIFICATION] Connected to notification stream');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleNotification(data);
        } catch (error) {
          console.error('[TOAST_NOTIFICATION] Error parsing notification data:', error);
        }
      };

      this.eventSource.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleNotification(data);
        } catch (error) {
          console.error('[TOAST_NOTIFICATION] Error parsing notification event:', error);
        }
      });

      this.eventSource.onerror = (error) => {
        console.error('[TOAST_NOTIFICATION] EventSource error:', error);
        this.isConnected = false;
        this.handleReconnect();
      };

      this.eventSource.addEventListener('error', (error) => {
        console.error('[TOAST_NOTIFICATION] EventSource error event:', error);
        this.isConnected = false;
        this.handleReconnect();
      });

    } catch (error) {
      console.error('[TOAST_NOTIFICATION] Failed to start notification stream:', error);
      this.handleReconnect();
    }
  }

  /**
   * Handle incoming notification
   */
  handleNotification(data) {
    console.log('[TOAST_NOTIFICATION] Received notification:', data);

    // Skip ping messages
    if (data.type === 'ping') {
      return;
    }

    // Skip connection messages
    if (data.type === 'connected') {
      return;
    }

    // Show toast notification
    if (data.title && data.message) {
      const priority = data.priority || 'info';
      const duration = priority === 'urgent' ? 8000 : 5000;
      
      showToast(data.message, priority, duration, {
        title: data.title,
        link: data.link,
        metadata: data.metadata
      });
    }
  }

  /**
   * Handle reconnection logic
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[TOAST_NOTIFICATION] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`[TOAST_NOTIFICATION] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.stopListening();
      this.startListening();
    }, delay);
  }

  /**
   * Stop listening for notifications
   */
  stopListening() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    console.log('[TOAST_NOTIFICATION] Stopped listening for notifications');
  }

  /**
   * Check if currently connected
   */
  isConnectedToStream() {
    return this.isConnected && this.eventSource && this.eventSource.readyState === EventSource.OPEN;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.eventSource ? this.eventSource.readyState : null
    };
  }
}

// Create singleton instance
const toastNotificationService = new ToastNotificationService();

export default toastNotificationService;
