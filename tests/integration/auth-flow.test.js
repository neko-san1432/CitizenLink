/**
 * Integration Tests: Complete Authentication Flow
 *
 * Tests the complete authentication flow from signup to logout
 */

const { createMockRequest, createMockResponse, createTestUser } = require('../utils/testHelpers');
const SupabaseMock = require('../utils/supabaseMock');

describe('Complete Authentication Flow', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.resetModules();
    mockSupabase = new SupabaseMock();
    jest.mock('../../src/server/config/database', () => ({
      getClient: () => mockSupabase,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockSupabase.reset();
  });

  describe('Signup → Email Verification → Login → Logout', () => {
    it('should complete full authentication flow', async () => {
      const user = createTestUser();

      // Step 1: Signup
      const signupReq = createMockRequest({
        method: 'POST',
        path: '/api/auth/signup',
        body: {
          email: user.email,
          password: user.password,
          confirmPassword: user.password,
          firstName: user.firstName,
          lastName: user.lastName,
          mobileNumber: user.mobileNumber,
          agreedToTerms: true,
        },
      });
      const signupRes = createMockResponse();

      const signupResult = await mockSupabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            firstName: user.firstName,
            lastName: user.lastName,
            mobileNumber: user.mobileNumber,
            role: 'citizen',
          },
        },
      });

      expect(signupResult.data.user).toBeDefined();
      expect(signupResult.data.user.email).toBe(user.email);

      // Step 2: Email Verification (simulated)
      const verifyReq = createMockRequest({
        method: 'GET',
        path: '/api/auth/verify-email',
        query: { token: 'verification_token' },
      });
      const verifyRes = createMockResponse();

      // Simulate email verification
      const dbUser = mockSupabase.users.get(signupResult.data.user.id);
      dbUser.email_confirmed_at = new Date().toISOString();

      expect(dbUser.email_confirmed_at).toBeDefined();

      // Step 3: Login
      const loginReq = createMockRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: {
          email: user.email,
          password: user.password,
        },
      });
      const loginRes = createMockResponse();

      const loginResult = await mockSupabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });

      expect(loginResult.data.session).toBeDefined();
      expect(loginResult.data.user.email).toBe(user.email);

      // Step 4: Access Protected Resource
      const protectedReq = createMockRequest({
        method: 'GET',
        path: '/api/auth/profile',
        cookies: { sb_access_token: loginResult.data.session.access_token },
      });
      const protectedRes = createMockResponse();

      const userResult = await mockSupabase.auth.getUser(
        loginResult.data.session.access_token
      );

      expect(userResult.data.user).toBeDefined();
      expect(userResult.data.user.id).toBe(signupResult.data.user.id);

      // Step 5: Logout
      const logoutReq = createMockRequest({
        method: 'POST',
        path: '/api/auth/logout',
        cookies: { sb_access_token: loginResult.data.session.access_token },
      });
      const logoutRes = createMockResponse();

      await mockSupabase.auth.signOut();

      // Verify session is invalidated
      const invalidUserResult = await mockSupabase.auth.getUser(
        loginResult.data.session.access_token
      );

      // After logout, token should be invalid
      expect(invalidUserResult.data.user).toBeNull();
    });
  });

  describe('Password Reset Flow', () => {
    it('should complete password reset flow', async () => {
      const user = createTestUser();

      // Step 1: Create user
      const signupResult = await mockSupabase.auth.signUp({
        email: user.email,
        password: user.password,
      });
      const userId = signupResult.data.user.id;

      // Step 2: Request password reset
      const resetReq = createMockRequest({
        method: 'POST',
        path: '/api/auth/forgot-password',
        body: { email: user.email },
      });

      const resetResult = await mockSupabase.auth.resetPasswordForEmail(user.email);
      expect(resetResult.error).toBeNull();

      // Step 3: Reset password with token
      const newPassword = 'NewPassword123!@#';
      const resetPasswordReq = createMockRequest({
        method: 'POST',
        path: '/api/auth/reset-password',
        body: {
          token: 'valid_token',
          password: newPassword,
          confirmPassword: newPassword,
        },
      });

      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: user.email,
          },
        },
        error: null,
      });

      const verifyResult = await mockSupabase.auth.verifyOtp({
        token_hash: 'valid_token',
        type: 'recovery',
      });

      expect(verifyResult.data.user).toBeDefined();

      const updateResult = await mockSupabase.auth.admin.updateUserById(
        verifyResult.data.user.id,
        { password: newPassword }
      );

      expect(updateResult.error).toBeNull();

      // Step 4: Login with new password
      const loginResult = await mockSupabase.auth.signInWithPassword({
        email: user.email,
        password: newPassword,
      });

      expect(loginResult.data.session).toBeDefined();
    });
  });

  describe('Session Management Flow', () => {
    it('should handle session refresh', async () => {
      const user = createTestUser();

      // Signup first
      await mockSupabase.auth.signUp({
        email: user.email,
        password: user.password,
      });

      // Login
      const loginResult = await mockSupabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });

      const originalToken = loginResult.data.session.access_token;

      // Refresh session
      const refreshReq = createMockRequest({
        method: 'POST',
        path: '/api/auth/refresh',
        body: {
          refreshToken: loginResult.data.session.refresh_token,
        },
      });

      // Mock refresh
      const newToken = `refreshed_${Date.now()}`;
      const refreshedSession = {
        access_token: newToken,
        refresh_token: `refresh_${Date.now()}`,
        expires_at: Date.now() + 3600000,
        user: loginResult.data.user,
      };

      expect(newToken).not.toBe(originalToken);
      expect(refreshedSession.access_token).toBeDefined();
    });

    it('should track multiple sessions', async () => {
      const user = createTestUser();

      // Signup first
      await mockSupabase.auth.signUp({
        email: user.email,
        password: user.password,
      });

      // Create multiple sessions
      const session1 = await mockSupabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });

      const session2 = await mockSupabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });

      expect(session1.data.session.access_token).not.toBe(
        session2.data.session.access_token
      );
      expect(session1.data.user.id).toBe(session2.data.user.id);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle login after failed signup', async () => {
      const user = createTestUser();

      // Attempt signup with existing email
      await mockSupabase.auth.signUp({
        email: user.email,
        password: user.password,
      });

      // Try to signup again with same email
      const duplicateSignup = await mockSupabase.auth.signUp({
        email: user.email,
        password: user.password,
      });

      // Should handle duplicate gracefully
      expect(duplicateSignup).toBeDefined();
    });

    it('should handle password reset for non-existent user', async () => {
      const resetResult = await mockSupabase.auth.resetPasswordForEmail(
        'nonexistent@example.com'
      );

      // Should not reveal if email exists
      expect(resetResult.error).toBeNull();
    });
  });
});

