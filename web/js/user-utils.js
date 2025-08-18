// User utilities for CitizenLink
// This file provides common functions for getting and displaying user information

// Get current user data from Supabase
async function getCurrentUser() {
  try {
    // Wait for Supabase to be ready
    const supabase = await window.supabaseManager.initialize();
    
    // Get current user session
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error getting user:', error);
      return null;
    }
    
    if (!user) {
      console.log('No user found');
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || 
            user.user_metadata?.name || 
            user.email?.split('@')[0] || 
            'User',
      phone: user.user_metadata?.phone || '',
      address: user.user_metadata?.address || '',
      role: user.user_metadata?.role || 'citizen',
      metadata: user.user_metadata || {}
    };
    
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Update user profile in Supabase
async function updateUserProfile(profileData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    // Prepare metadata update (name is read-only, so we don't update it)
    const metadata = {
      phone: profileData.phone,
      address: profileData.address
    };
    
    // Update user metadata
    const { data, error } = await supabase.auth.updateUser({
      data: metadata
    });
    
    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
    
    // Update password if provided
    if (profileData.newPassword) {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: profileData.newPassword
      });
      
      if (passwordError) {
        console.error('Error updating password:', passwordError);
        throw passwordError;
      }
    }
    
    console.log('Profile updated successfully');
    return data.user;
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Update header with user's name
function updateHeaderWithUserName(user) {
  const headerUserName = document.getElementById('header-user-name');
  if (headerUserName && user) {
    headerUserName.textContent = user.name;
    console.log('Updated header with user name:', user.name);
  }
  
  // Also refresh sidebar user name if sidebar loader is available
  if (window.refreshSidebarUserName) {
    window.refreshSidebarUserName();
  }
}

// Initialize user data and update UI
async function initializeUserData() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      console.log('No authenticated user, redirecting to login');
      window.location.href = '/login';
      return null;
    }
    
    // Update header with user's name
    updateHeaderWithUserName(user);
    
    // Store user data globally for other scripts to use
    window.currentUser = user;
    
    return user;
    
  } catch (error) {
    console.error('Error initializing user data:', error);
    window.location.href = '/login';
    return null;
  }
}

// Check if user is authenticated
async function isAuthenticated() {
  try {
    const supabase = await window.supabaseManager.initialize();
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

// Logout user
async function logoutUser() {
  try {
    const supabase = await window.supabaseManager.initialize();
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
    }
    
    // Clear any stored user data
    window.currentUser = null;
    sessionStorage.removeItem('user');
    
    // Redirect to login
    window.location.href = '/login';
    
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect even if there's an error
    window.location.href = '/login';
  }
}

// ============================================================================
// LGU PROFILE MANAGEMENT FUNCTIONS
// ============================================================================

// Get LGU profile data
async function getLGUProfile(userId) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    // This would typically fetch from a user_profiles table
    // For now, we'll return the user metadata
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error fetching LGU profile:', error);
      return null;
    }
    
    return {
      department: user.user_metadata?.department || '',
      position: user.user_metadata?.position || '',
      office_address: user.user_metadata?.office_address || '',
      office_hours: user.user_metadata?.office_hours || '',
      phone: user.user_metadata?.phone || '',
      emergency_contact: user.user_metadata?.emergency_contact || '',
      email_notifications: user.user_metadata?.email_notifications !== false,
      sms_notifications: user.user_metadata?.sms_notifications !== false,
      push_notifications: user.user_metadata?.push_notifications !== false,
      language: user.user_metadata?.language || 'en',
      timezone: user.user_metadata?.timezone || 'UTC',
      theme: user.user_metadata?.theme || 'light'
    };
    
  } catch (error) {
    console.error('Error in getLGUProfile:', error);
    return null;
  }
}

// Update LGU profile
async function updateLGUProfile(userId, profileData) {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    // Update user metadata with profile information
    const { data, error } = await supabase.auth.updateUser({
      data: profileData
    });
    
    if (error) {
      console.error('Error updating LGU profile:', error);
      throw error;
    }
    
    // Update session storage
    const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const updatedUser = { ...currentUser, ...profileData };
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
    
    console.log('LGU profile updated successfully');
    return updatedUser;
    
  } catch (error) {
    console.error('Error in updateLGUProfile:', error);
    throw error;
  }
}

// Export functions for use in other scripts
window.userUtils = {
  getCurrentUser,
  updateUserProfile,
  updateHeaderWithUserName,
  initializeUserData,
  isAuthenticated,
  logoutUser,
  getLGUProfile,
  updateLGUProfile
};

// Make LGU profile functions available globally
if (typeof window !== 'undefined') {
  window.getLGUProfile = getLGUProfile;
  window.updateLGUProfile = updateLGUProfile;
}
