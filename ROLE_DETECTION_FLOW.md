# Role Detection Flow - CitizenLink

## Single Source of Truth: `auth.users.raw_user_meta_data.role`

All role detection in the system follows this flow:

```
auth.users.raw_user_meta_data.role
    ↓
src/server/middleware/auth.js (authenticateUser)
    ↓
req.user.role
    ↓
All controllers, services, and middleware
```

## Implementation Details

### 1. Data Storage (Signup & OAuth)
**Location**: `src/server/services/UserService.js` & `src/server/controllers/AuthController.js`

Both email signup and OAuth completion store the role in:
```javascript
await supabase.auth.admin.createUser({
  raw_user_meta_data: {
    role: 'citizen',              // Original role string
    normalized_role: 'citizen',   // Normalized for RLS
    // ... other fields
  }
})
```

### 2. Role Extraction (Every Request)
**Location**: `src/server/middleware/auth.js` (Line 103)

```javascript
req.user = {
  role: rawUserMetaData.role || 'citizen',
  normalized_role: rawUserMetaData.normalized_role || rawUserMetaData.role || 'citizen',
  // ... other fields
}
```

**Key Line**:
```javascript
const rawUserMetaData = user.raw_user_meta_data || {};
```

### 3. Role Validation (Protected Routes)
**Location**: `src/server/middleware/auth.js` (Line 148)

```javascript
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role; // From raw_user_meta_data
    // ... validation logic
  }
}
```

### 4. Role Usage (Controllers)
**Example**: `src/server/controllers/ComplaintController.js` (Line 85)

```javascript
const userRole = user.role || 'citizen'; // user is req.user
```

## Supported Roles

```javascript
const VALID_ROLES = [
  'citizen',
  'lgu',
  'lgu-admin',
  'coordinator',
  'hr',
  'super-admin'
];
```

## Role Hierarchy

```
super-admin
    ↓
hr
    ↓
lgu-admin (department-specific: lgu-admin-wst, lgu-admin-pwd, etc.)
    ↓
coordinator
    ↓
lgu (LGU officer)
    ↓
citizen
```

## Testing Role Detection

To verify a user's role is correctly detected:

1. Check `auth.users.raw_user_meta_data`:
```sql
SELECT raw_user_meta_data->>'role' as role 
FROM auth.users 
WHERE email = 'user@example.com';
```

2. Check server logs when user logs in:
```
[AUTH] ✅ User authenticated successfully: { role: 'citizen', ... }
```

3. Check `req.user` in any controller:
```javascript
console.log('User role:', req.user.role);
console.log('Raw metadata:', req.user.raw_user_meta_data.role);
```

## Important Notes

- ✅ **NO** separate `users` table - only `auth.users`
- ✅ **ALWAYS** use `req.user.role` in backend code
- ✅ Role is set during signup/OAuth and **never changes** unless updated via `UserService.changeUserRole()`
- ✅ `normalized_role` is used for RLS policies (handles variants like `lgu-admin-wst`)
- ✅ Both `role` and `normalized_role` are stored in `raw_user_meta_data`

## Updating a User's Role

**Only through backend**:
```javascript
await UserService.changeUserRole(userId, 'lgu-admin', adminId, 'Promoted to admin');
```

This updates both `user_metadata` and `raw_user_meta_data` in `auth.users`.




