import { supabase } from '../config/config.js';

// Check authentication and redirect to appropriate dashboard
const checkAuthAndRedirect = async () => {
  try {
    console.log('🔍 Dashboard auth check starting...');

    // Prevent multiple redirects
    if (window.location.pathname === '/login') {
      console.log('⚠️ Already on login page, skipping auth check');
      return;
    }

    // Get current session
    console.log('🔐 Getting current session...');
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      console.log('❌ No session found - Error:', error, 'Session:', session);
      console.log('🔄 Redirecting to login');
      window.location.href = '/login';
      return;
    }

    console.log('✅ Session found, extracting user metadata...');
    // Get user metadata
    const user = session.user;

    // Check both user_metadata and raw_user_meta_data
    const userMetadata = user?.user_metadata || {};
    const rawUserMetaData = user?.raw_user_meta_data || {};
    const combinedMetadata = { ...rawUserMetaData, ...userMetadata };

    // Prioritize original role, but fall back to normalized role for backward compatibility
    const role = combinedMetadata.role || combinedMetadata.normalized_role || 'citizen';
    const name = combinedMetadata.name || userMetadata.name || rawUserMetaData.name || '';
    console.log('👤 User metadata - Role:', role, 'Name:', name, 'Combined metadata:', combinedMetadata);

    // Check if user has completed registration (role should always exist now)
    if (!name) {
      console.log('❌ User profile incomplete - Role:', role, 'Name:', name);
      console.log('🔄 Redirecting to OAuth continuation');
      window.location.href = '/oauth-continuation';
      return;
    }

    // Save user metadata to localStorage
    console.log('💾 Saving user metadata to localStorage...');
    const { saveUserMeta } = await import('./authChecker.js');
    saveUserMeta({ role, name });

    // Redirect to dashboard (role-based routing handled by server)
    console.log('🎯 Redirecting to dashboard for role:', role);
    window.location.href = '/dashboard';

  } catch (error) {
    console.error('💥 Authentication check failed:', error);
    console.log('🔄 Redirecting to login due to error');

    // Show error toast before redirecting
    try {
      const { default: showMessage } = await import('../components/toast.js');
      showMessage('error', 'Authentication failed. Redirecting to login...');
    } catch (toastError) {
      console.error('Failed to show error toast:', toastError);
    }

    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  }
};

// Run authentication check
checkAuthAndRedirect();
