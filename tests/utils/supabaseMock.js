/**
 * Mock Supabase client for testing
 */

class SupabaseMock {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.rateLimits = new Map();
    this.reset();
  }

  reset() {
    this.users.clear();
    this.sessions.clear();
    this.rateLimits.clear();
  }

  // Mock auth methods
  auth = {
    signUp: jest.fn(async ({ email, password, options }) => {
      const userId = `user_${Date.now()}_${Math.random()}`;
      const user = {
        id: userId,
        email,
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        user_metadata: options?.data || {},
      };
      this.users.set(userId, { ...user, password });
      return {
        data: { user, session: null },
        error: null,
      };
    }),

    signInWithPassword: jest.fn(async ({ email, password }) => {
      const user = Array.from(this.users.values()).find(u => u.email === email);
      if (!user || user.password !== password) {
        return {
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials', status: 400 },
        };
      }
      const session = {
        access_token: `token_${Date.now()}_${Math.random()}`,
        refresh_token: `refresh_${Date.now()}`,
        expires_at: Date.now() + 3600000,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
        },
      };
      this.sessions.set(session.access_token, session);
      return {
        data: { user, session },
        error: null,
      };
    }),

    getUser: jest.fn(async (token) => {
      const session = this.sessions.get(token);
      if (!session) {
        return {
          data: { user: null },
          error: { message: 'Invalid token', status: 401 },
        };
      }
      const user = this.users.get(session.user.id);
      return {
        data: { user },
        error: null,
      };
    }),

    signOut: jest.fn(async () => {
      this.sessions.clear();
      return { data: {}, error: null };
    }),

    resetPasswordForEmail: jest.fn(async (email) => {
      const user = Array.from(this.users.values()).find(u => u.email === email);
      if (!user) {
        // Don't reveal if email exists (security best practice)
        return { data: {}, error: null };
      }
      return { data: {}, error: null };
    }),

    verifyOtp: jest.fn(async ({ token_hash, type: _type }) => {
      // Mock token verification
      if (token_hash === 'valid_token') {
        return {
          data: {
            user: {
              id: 'user_123',
              email: 'test@example.com',
            },
          },
          error: null,
        };
      }
      return {
        data: { user: null },
        error: { message: 'Invalid or expired token', status: 400 },
      };
    }),

    updateUser: jest.fn(async ({ password: _password }) => {
      return {
        data: { user: { id: 'user_123' } },
        error: null,
      };
    }),

    admin: {
      updateUserById: jest.fn(async (userId, { password }) => {
        const user = this.users.get(userId);
        if (user) {
          user.password = password;
        }
        return {
          data: { user },
          error: null,
        };
      }),

      generateLink: jest.fn(async ({ type, email: _email }) => {
        return {
          data: {
            action_link: `https://example.com/reset?token=test_token&type=${type}`,
          },
          error: null,
        };
      }),
    },
  };

  // Mock database methods
  from(_table) {
    return {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({ data: null, error: null })),
      limit: jest.fn(async () => ({ data: [], error: null })),
      order: jest.fn().mockReturnThis(),
    };
  }
}

module.exports = SupabaseMock;

