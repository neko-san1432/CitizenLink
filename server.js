import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';
import cookieParser from 'cookie-parser';
dotenv.config()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
app.use(
  helmet({
    contentSecurityPolicy: false, // OR minimal directives
  })
);

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('css'));
app.use(express.static('js'));
app.use(express.static('assets'));
// serve node_modules for browser ESM imports (import maps)
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
//file MIME bypass
app.use(express.static(__dirname, {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    }
  }
}));

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.cookies?.sb_access_token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
// Endpoint to set HttpOnly cookie with access token
app.post('/auth/session', (req, res) => {
  try {
    const token = req.body?.access_token;
    if (!token) return res.status(400).json({ ok: false, error: 'missing_token' });
    res.cookie('sb_access_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 * 1000
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false });
  }
});

// Role-based authorization middleware with regex support
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.user_metadata?.role;
    if (!userRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Check if user role matches any allowed role (including regex patterns)
    const hasPermission = allowedRoles.some(allowedRole => {
      if (typeof allowedRole === 'string') {
        return userRole === allowedRole;
      } else if (allowedRole instanceof RegExp) {
        return allowedRole.test(userRole);
      }
      return false;
    });
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// expose minimal env to browser as a tiny JS module
app.get('/env.js', (_req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || '';
  const captchaClientKey = process.env.CAPTCHA_CLIENT_KEY || '';
  const body = `window.__ENV__ = { SUPABASE_URL: ${JSON.stringify(url)}, SUPABASE_ANON_KEY: ${JSON.stringify(anon)}, CAPTCHA_CLIENT_KEY: ${JSON.stringify(captchaClientKey)} };`;
  res.set('Content-Type', 'application/javascript');
  res.send(body);
});

// captcha verification endpoint
app.post('/captcha/verify', async (req, res) => {
  try {
    const token = req.body && (req.body.token || req.body.captcha || req.body.response);
    if (!token) {
      return res.status(400).json({ success: false, error: 'missing_token' });
    }
    const secret = process.env.CAPTCHA_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ success: false, error: 'server_misconfigured' });
    }
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (req.ip) params.append('remoteip', req.ip);
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const result = await resp.json();
    if (result && result.success) {
      return res.json({ success: true, score: result.score, action: result.action });
    }
    return res.status(400).json({ success: false, error: 'verification_failed', details: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'server_error' });
  }
});

// Public routes (no authentication required)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "signup.html"));
});
app.get("/resetPassword", (req, res) => {
  res.sendFile(path.join(__dirname, "resetPass.html"));
});
app.get("/success", (req, res) => {
  res.sendFile(path.join(__dirname, "success.html"));
});
app.get("/oauth-continuation", (req, res) => {
  res.sendFile(path.join(__dirname, "OAuthContinuation.html"));
});

// Helper function to determine dashboard path based on role
const getDashboardPath = (userRole) => {
  // Super admin - distinct dashboard
  if (userRole === 'super-admin') {
    return path.join(__dirname, "pages", "super-admin", "dashboard.html");
  }
  
  // LGU Admin - distinct dashboard
  if (userRole === 'lgu-admin') {
    return path.join(__dirname, "pages", "lgu-admin", "dashboard.html");
  }
  
  // LGU departments (regex pattern: lgu-*) - use general LGU dashboard
  if (/^lgu-/.test(userRole)) {
    return path.join(__dirname, "pages", "lgu", "dashboard.html");
  }
  
  // General LGU role - distinct dashboard
  if (userRole === 'lgu') {
    return path.join(__dirname, "pages", "lgu", "dashboard.html");
  }
  
  // Default to citizen - distinct dashboard
  return path.join(__dirname, "pages", "citizen", "dashboard.html");
};

// Dashboard route - protected and routed by role
app.get("/dashboard", authenticateUser, (req, res) => {
  const userRole = req.user?.user_metadata?.role || 'citizen';
  const dashboardPath = getDashboardPath(userRole);
  res.sendFile(dashboardPath);
});

// Clean routes for general pages
app.get('/myProfile', authenticateUser, (_req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'myProfile.html'))
})

app.get('/fileComplaint', authenticateUser, (_req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'fileComplaint.html'))
})

// Clean routes for role-specific pages
app.get('/myComplaints', authenticateUser, requireRole(['citizen']), (_req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'citizen', 'myComplaints.html'))
})

app.get('/taskAssigned', authenticateUser, requireRole(['lgu', /^lgu-/]), (_req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'lgu', 'taskAssigned.html'))
})

// Optional explicit role dashboard routes (shortcuts)
app.get('/citizen', authenticateUser, requireRole(['citizen']), (_req, res) => {
  res.redirect('/dashboard')
})
app.get('/lgu', authenticateUser, requireRole(['lgu', /^lgu-/]), (_req, res) => {
  res.redirect('/dashboard')
})
app.get('/lgu-admin', authenticateUser, requireRole(['lgu-admin']), (_req, res) => {
  res.redirect('/dashboard')
})
app.get('/super-admin', authenticateUser, requireRole(['super-admin']), (_req, res) => {
  res.redirect('/dashboard')
})


// Protected API endpoints
app.get("/api/user/profile", authenticateUser, (req, res) => {
  const { user } = req;
  res.json({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name,
    role: user.user_metadata?.role,
    mobile: user.user_metadata?.mobile,
    oauth_providers: user.user_metadata?.oauth_providers || []
  });
});

app.get("/api/user/role", authenticateUser, (req, res) => {
  const { user } = req;
  res.json({ role: user.user_metadata?.role || 'citizen' });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});


// server running stat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("server is running :3");
  console.log(`Running at: http://localhost:${PORT}`);
});

export default app;
