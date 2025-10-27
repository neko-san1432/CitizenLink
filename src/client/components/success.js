import { supabase } from '../config/config.js';
import { saveUserMeta, setOAuthContext, clearOAuthContext } from '../auth/authChecker.js';

const run = async () => {
  try {
    // After OAuth or email confirmation, Supabase sets a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    console.log('[SUCCESS] Session check:', {
      hasSession: !!session,
      hasError: !!sessionError,
      sessionError: sessionError?.message
    });

    const user = session?.user;
    const accessToken = session?.access_token || null;
    const role = user?.user_metadata?.role || null;
    const name = user?.user_metadata?.name || null;
    const email = user?.email || null;

    console.log('[SUCCESS] User data:', {
      hasUser: !!user,
      email: email,
      role: role,
      name: name,
      userMetadata: user?.user_metadata,
      hasMobile: !!user?.user_metadata?.mobile,
      mobile: user?.user_metadata?.mobile
    });

    if (role || name) saveUserMeta({ role, name });

    // Track provider
    const provider = user?.identities?.[0]?.provider || null;
    console.log('[SUCCESS] Provider:', provider);

    if (provider) {
      setOAuthContext({ provider, email });
      // merge into oauth_providers array
      try {
        const currentProviders = Array.isArray(user?.user_metadata?.oauth_providers)
          ? user.user_metadata.oauth_providers
          : [];
        const nextProviders = Array.from(new Set([...currentProviders, provider]));
        await supabase.auth.updateUser({ data: { oauth_providers: nextProviders } });
      } catch (error) {
        console.error('[SUCCESS] Error updating OAuth providers:', error);
      }
    }

    // Persist access token to HttpOnly cookie for server-protected pages
    try {
      if (accessToken) {
        const resp = await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken })
        });

        console.log('[SUCCESS] Session cookie response:', resp.ok);

        // Verify cookie by hitting a protected endpoint before redirecting
        if (resp.ok) {
          let ok = false;
          try {
            const check1 = await fetch('/api/user/role', { method: 'GET' });
            ok = check1.ok;
            console.log('[SUCCESS] First role check:', check1.ok);
          } catch (error) {
            console.error('[SUCCESS] First role check error:', error);
          }

          if (!ok) {
            await new Promise(r => setTimeout(r, 300));
            try {
              const check2 = await fetch('/api/user/role', { method: 'GET' });
              ok = check2.ok;
              console.log('[SUCCESS] Second role check:', check2.ok);
            } catch (error) {
              console.error('[SUCCESS] Second role check error:', error);
            }
          }

          if (!ok) {
            console.log('[SUCCESS] Cookie verification failed, staying on page');
            // If cannot verify, stay on page and let user refresh
            return;
          }
        }
      }
    } catch (error) {
      console.error('[SUCCESS] Session persistence error:', error);
    }

    // redirect based on registration status
    console.log('[SUCCESS] Redirect decision:', {
      provider: provider,
      hasMobile: !!user?.user_metadata?.mobile
    });

    // Check if user needs to complete OAuth registration
    // Mobile could be in different places: user_metadata.mobile, user_metadata.phone, etc.
    const hasMobile = user?.user_metadata?.mobile ||
                     user?.user_metadata?.phone ||
                     user?.user_metadata?.phone_number ||
                     user?.phone;

    console.log('[SUCCESS] Mobile check details:', {
      mobile: user?.user_metadata?.mobile,
      phone: user?.user_metadata?.phone,
      phone_number: user?.user_metadata?.phone_number,
      user_phone: user?.phone,
      final_hasMobile: !!hasMobile
    });

    if (provider && !hasMobile) {
      // OAuth user needs to complete registration (no phone number)
      console.log('[SUCCESS] Redirecting to OAuth continuation');
      window.location.href = '/oauth-continuation';
    } else {
      // Regular user or OAuth user with complete profile (has phone number)
      console.log('[SUCCESS] Redirecting to dashboard');
      window.location.href = '/dashboard';
    }
  } catch (error) {
    console.error('[SUCCESS] Main error:', error);
    // Fallback: redirect to dashboard anyway
    window.location.href = '/dashboard';
  }
};

run();
