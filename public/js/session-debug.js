// Session Debugging Tool
// Add this script to any page to debug session issues

class SessionDebugger {
  constructor() {
    this.debugLog = [];
    this.startDebugging();
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, data };
    this.debugLog.push(logEntry);
    console.log(`[SESSION DEBUG ${timestamp}] ${message}`, data || '');
  }

  async checkSupabaseSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        this.log('Supabase session error', error);
        return false;
      }
      
      if (!session) {
        this.log('No Supabase session found');
        return false;
      }
      
      this.log('Supabase session found', {
        userId: session.user?.id,
        email: session.user?.email,
        expiresAt: session.expires_at,
        isExpired: session.expires_at ? Math.floor(Date.now() / 1000) >= session.expires_at : 'unknown'
      });
      
      return true;
    } catch (error) {
      this.log('Failed to check Supabase session', error);
      return false;
    }
  }

  async checkServerSession() {
    try {
      const response = await fetch('/auth/session/health');
      const data = await response.json();
      
      if (response.ok) {
        this.log('Server session is valid', data);
        return true;
      } else {
        this.log('Server session invalid', data);
        return false;
      }
    } catch (error) {
      this.log('Failed to check server session', error);
      return false;
    }
  }

  async checkApiAccess() {
    try {
      const response = await fetch('/api/user/role');
      
      if (response.ok) {
        const data = await response.json();
        this.log('API access successful', data);
        return true;
      } else {
        this.log('API access failed', { status: response.status, statusText: response.statusText });
        return false;
      }
    } catch (error) {
      this.log('API access error', error);
      return false;
    }
  }

  checkCookies() {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    this.log('Current cookies', cookies);
    
    const sessionCookie = cookies.sb_access_token;
    if (sessionCookie) {
      this.log('Session cookie found', { length: sessionCookie.length });
    } else {
      this.log('No session cookie found');
    }
    
    return !!sessionCookie;
  }

  async performFullDiagnostic() {
    this.log('=== SESSION DIAGNOSTIC START ===');
    
    const results = {
      cookies: this.checkCookies(),
      supabaseSession: await this.checkSupabaseSession(),
      serverSession: await this.checkServerSession(),
      apiAccess: await this.checkApiAccess()
    };
    
    this.log('=== DIAGNOSTIC RESULTS ===', results);
    
    // Determine the issue
    if (!results.cookies) {
      this.log('ISSUE: No session cookie found - user needs to login');
    } else if (!results.supabaseSession) {
      this.log('ISSUE: Supabase session missing - possible token refresh failure');
    } else if (!results.serverSession) {
      this.log('ISSUE: Server session invalid - cookie/server sync problem');
    } else if (!results.apiAccess) {
      this.log('ISSUE: API access denied - authentication middleware problem');
    } else {
      this.log('SUCCESS: All session checks passed');
    }
    
    return results;
  }

  startDebugging() {
    this.log('Session debugger initialized');
    
    // Check session every 30 seconds
    setInterval(async () => {
      await this.performFullDiagnostic();
    }, 30000);
    
    // Check session on page visibility change
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        this.log('Page became visible, checking session...');
        await this.performFullDiagnostic();
      }
    });
    
    // Check session on focus
    window.addEventListener('focus', async () => {
      this.log('Window focused, checking session...');
      await this.performFullDiagnostic();
    });
  }

  getDebugLog() {
    return this.debugLog;
  }

  exportDebugLog() {
    const logData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      logs: this.debugLog
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Initialize debugger if supabase is available
if (typeof supabase !== 'undefined') {
  window.sessionDebugger = new SessionDebugger();
  
  // Add debug button to page
  const debugButton = document.createElement('button');
  debugButton.textContent = 'Debug Session';
  debugButton.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999;
    background: #007bff;
    color: white;
    border: none;
    padding: 10px;
    border-radius: 5px;
    cursor: pointer;
  `;
  
  debugButton.addEventListener('click', async () => {
    await window.sessionDebugger.performFullDiagnostic();
  });
  
  document.body.appendChild(debugButton);
  
  console.log('Session debugger loaded. Use window.sessionDebugger to access debug functions.');
}
