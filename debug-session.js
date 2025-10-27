/**
 * Debug script to check current session state
 * Run this in browser console on the success page
 */
const debugSession = async () => {
  console.log('=== SESSION DEBUG ===');

  try {
    // Check Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('Session:', session);
    console.log('Session error:', error);

    if (session?.user) {
      console.log('User:', session.user);
      console.log('User metadata:', session.user.user_metadata);
      console.log('Raw user metadata:', session.user.raw_user_meta_data);
      console.log('User identities:', session.user.identities);

      // Check mobile in different locations
      console.log('Mobile checks:', {
        'user.user_metadata.mobile': session.user.user_metadata?.mobile,
        'user.user_metadata.phone': session.user.user_metadata?.phone,
        'user.user_metadata.phone_number': session.user.user_metadata?.phone_number,
        'user.phone': session.user.phone
      });
    }

    // Check API endpoints
    try {
      const roleResponse = await fetch('/api/user/role');
      console.log('Role API response:', roleResponse.ok, await roleResponse.text());
    } catch (error) {
      console.log('Role API error:', error);
    }

    try {
      const profileResponse = await fetch('/api/auth/profile');
      console.log('Profile API response:', profileResponse.ok, await profileResponse.text());
    } catch (error) {
      console.log('Profile API error:', error);
    }

  } catch (error) {
    console.error('Debug error:', error);
  }
};

// Run debug
debugSession();
