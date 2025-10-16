# Troubleshooting: Empty Complaints List

## 🔍 Issue
The coordinator dashboard or complaints list appears empty.

---

## ✅ Step 1: Check if Complaints Exist

Run this query in your Supabase SQL Editor:

```sql
-- File: sql/check_complaints.sql
SELECT COUNT(*) as total_complaints FROM public.complaints;
```

### Result Analysis:

- **If count = 0**: Your database has no complaints yet → Go to **Step 2**
- **If count > 0**: Complaints exist but aren't showing → Go to **Step 3**

---

## ✅ Step 2: Create Sample Complaints

### Option A: Dynamic Seed (Recommended)
Uses your actual user IDs from the database:

```bash
# Run in Supabase SQL Editor
File: sql/seed_sample_complaints_dynamic.sql
```

This will:
- ✅ Find actual citizen/coordinator/officer users in your database
- ✅ Create 5 sample complaints with various statuses
- ✅ Create assignments if officers exist
- ✅ Show you which user IDs were used

### Option B: Manual Seed (If you know your user IDs)
If you've already created specific test users:

```bash
# Run in Supabase SQL Editor
File: sql/seed_complaints_and_notifications.sql
```

⚠️ **Note**: This uses hardcoded UUIDs. You'll need to:
1. Find your actual user IDs first
2. Replace the UUIDs in the file

---

## ✅ Step 3: Verify Complaint Status

If complaints exist but coordinator dashboard is empty, check the status:

```sql
-- Check complaint statuses
SELECT status, COUNT(*) as count 
FROM public.complaints 
GROUP BY status;

-- The coordinator dashboard shows complaints with status = 'pending review'
SELECT COUNT(*) as pending_review_count 
FROM public.complaints 
WHERE status = 'pending review';
```

### Common Issues:

| Status | Dashboard Shown | Fix |
|--------|-----------------|-----|
| `pending review` | ✅ Coordinator Dashboard | Working as expected |
| `in progress` | ❌ Coordinator Dashboard | Need to create complaints with 'pending review' status |
| `new` | ❌ Coordinator Dashboard | Update status to 'pending review' |

---

## ✅ Step 4: Check User Permissions

Make sure you're logged in as a **complaint coordinator**:

```sql
-- Check your user role
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com';
```

Expected role: `complaint-coordinator`

---

## ✅ Step 5: Verify Table Schema

Check if the complaints table has the correct structure:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'complaints'
ORDER BY ordinal_position;
```

Required columns:
- `id` (uuid)
- `submitted_by` (uuid)
- `title` (text)
- `status` (text)
- `type` (text)
- `descriptive_su` (text)
- `submitted_at` (timestamptz)

---

## 🔧 Quick Fix Commands

### Create Test Complaint Manually

```sql
-- Replace USER_ID with an actual user UUID from auth.users
INSERT INTO public.complaints (
  submitted_by, 
  title, 
  type, 
  subtype, 
  descriptive_su, 
  location_text,
  latitude, 
  longitude, 
  status, 
  workflow_status, 
  priority,
  submitted_at, 
  updated_at
) VALUES (
  'USER_ID_HERE',  -- Replace with actual UUID
  'Test Complaint - Broken Street Light',
  'Infrastructure',
  'Street Lighting',
  'This is a test complaint to verify the system is working.',
  'Test Location',
  14.5995, 
  120.9842,
  'pending review',  -- Important: This makes it show in coordinator dashboard
  'new',
  'medium',
  NOW(),
  NOW()
);
```

### Update Existing Complaints to Pending Review

```sql
-- Make some complaints visible to coordinator
UPDATE public.complaints 
SET 
  status = 'pending review',
  workflow_status = 'new'
WHERE status != 'resolved' 
  AND status != 'closed'
LIMIT 5;
```

---

## 📊 Verify Dashboard Works

After creating complaints:

1. **Refresh** the coordinator dashboard
2. **Check console logs** for:
   ```
   [COORDINATOR_SERVICE] Pending count: X
   [COORDINATOR_SERVICE] Queue items: X
   ```
3. **Expected result**: Dashboard shows complaints count and list

---

## 🐛 Still Not Working?

Check server logs for specific errors:

```bash
# In your terminal where the server is running, look for:
[COORDINATOR_CONTROLLER] Get dashboard error: ...
[COORDINATOR_SERVICE] Get dashboard error: ...
[COORDINATOR_REPO] Get review queue error: ...
```

**Common errors:**
- `table "complaints" does not exist` → Run `database_complete_setup.sql`
- `column "submitted_by" does not exist` → Check table schema
- `invalid input syntax for type uuid` → Check user IDs in seed data

---

## 📝 Summary

1. ✅ Check if complaints exist
2. ✅ Run dynamic seed script
3. ✅ Verify status is 'pending review'
4. ✅ Confirm you're logged in as coordinator
5. ✅ Check server logs for errors

---

**Need help?** Share:
- Result of `SELECT COUNT(*) FROM public.complaints;`
- Your user role from `auth.users`
- Server console logs when loading dashboard


