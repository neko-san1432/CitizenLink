-- Migration: Update raw_user_meta_data for all existing users
-- This script adds required metadata keys based on email patterns

-- Update citizen1@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'role', 'citizen',
  'base_role', 'citizen',
  'dpt', null,
  'name', 'Citizen 1',
  'status', 'active',
  'email_verified', true,
  'normalized_role', 'citizen',
  'mobile_number', '+639171234567'
)
WHERE email = 'citizen1@gmail.com';

-- Update citizen2@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'role', 'citizen',
  'base_role', 'citizen',
  'dpt', null,
  'name', 'Citizen 2',
  'status', 'active',
  'email_verified', true,
  'normalized_role', 'citizen',
  'mobile_number', '+639171234568'
)
WHERE email = 'citizen2@gmail.com';

-- Update citizen3@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'role', 'citizen',
  'base_role', 'citizen',
  'dpt', null,
  'name', 'Citizen 3',
  'status', 'active',
  'email_verified', true,
  'normalized_role', 'citizen',
  'mobile_number', '+639171234569'
)
WHERE email = 'citizen3@gmail.com';

-- Update citizen4@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'role', 'citizen',
  'base_role', 'citizen',
  'dpt', null,
  'name', 'Citizen 4',
  'status', 'active',
  'email_verified', true,
  'normalized_role', 'citizen',
  'mobile_number', '+639171234570'
)
WHERE email = 'citizen4@gmail.com';

-- Update citizen5@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'role', 'citizen',
  'base_role', 'citizen',
  'dpt', null,
  'name', 'Citizen 5',
  'status', 'active',
  'email_verified', true,
  'normalized_role', 'citizen',
  'mobile_number', '+639171234571'
)
WHERE email = 'citizen5@gmail.com';

-- Update coordinator@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'role', 'complaint-coordinator',
  'base_role', 'complaint-coordinator',
  'dpt', null,
  'name', 'Coordinator',
  'status', 'active',
  'email_verified', true,
  'normalized_role', 'complaint-coordinator',
  'mobile_number', '+639171234572'
)
WHERE email = 'coordinator@gmail.com';

-- Update admin@gmail.com
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'role', 'super-admin',
  'base_role', 'super-admin',
  'dpt', null,
  'name', 'Admin',
  'status', 'active',
  'email_verified', true,
  'normalized_role', 'super-admin',
  'mobile_number', '+639171234573'
)
WHERE email = 'admin@gmail.com';

-- Update pnp@gmail.com (LGU Officer)
UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
      'role', 'lgu',
      'base_role', 'lgu',
      'dpt', 'PNP',
      'name', 'PNP Officer',
      'status', 'active',
      'email_verified', true,
      'normalized_role', 'lgu',
      'mobile_number', '+639171234574'
    )
WHERE email = 'pnp@gmail.com';

-- Update pnpadmin@gmail.com (LGU Admin)
UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
      'role', 'lgu-admin',
      'base_role', 'lgu-admin',
      'dpt', 'PNP',
      'name', 'PNP Admin',
      'status', 'active',
      'email_verified', true,
      'normalized_role', 'lgu-admin',
      'mobile_number', '+639171234575'
    )
WHERE email = 'pnpadmin@gmail.com';

-- Update pnphr@gmail.com (LGU HR)
UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
      'role', 'lgu-hr',
      'base_role', 'lgu-hr',
      'dpt', 'PNP',
      'name', 'PNP HR',
      'status', 'active',
      'email_verified', true,
      'normalized_role', 'lgu-hr',
      'mobile_number', '+639171234576'
    )
WHERE email = 'pnphr@gmail.com';

-- Verify the updates
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'base_role' as base_role,
  raw_user_meta_data->>'dpt' as department,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'mobile_number' as mobile_number
FROM auth.users
ORDER BY email;
