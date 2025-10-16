# Valid Complaint Field Values

## 📋 Quick Reference for Database Constraints

This document lists the valid values for constrained fields in the `complaints` table.

---

## ✅ Valid Values

### 1. **`status`** (Main Status)

Valid values:
```sql
'pending review'
'in progress'
'resolved'
'rejected'
'closed'
```

**Usage:**
- `'pending review'` - Newly submitted, waiting for coordinator
- `'in progress'` - Assigned and being worked on
- `'resolved'` - Work completed successfully
- `'rejected'` - Not valid or out of scope
- `'closed'` - Archived/finalized

---

### 2. **`workflow_status`** (Internal Workflow)

Valid values:
```sql
'new'
'assigned'
'in_progress'
'pending_approval'
'completed'
'cancelled'
```

**⚠️ Important:**
- **NOT** `'resolved'` (that's for `status`, not `workflow_status`)
- Use `'completed'` when work is done

**Usage:**
- `'new'` - Just created
- `'assigned'` - Assigned to department/officer
- `'in_progress'` - Officer is working on it
- `'pending_approval'` - Waiting for approval/confirmation
- `'completed'` - Work finished (maps to status='resolved')
- `'cancelled'` - Abandoned or withdrawn

---

### 3. **`priority`**

Valid values:
```sql
'low'
'medium'
'high'
'urgent'
```

**Usage:**
- `'low'` - Can wait
- `'medium'` - Normal priority
- `'high'` - Important, needs attention soon
- `'urgent'` - Critical, immediate action required

---

## 🎯 Common Combinations

### New Complaint (Just Submitted)
```sql
status = 'pending review'
workflow_status = 'new'
```

### Assigned to Officer
```sql
status = 'in progress'
workflow_status = 'assigned'
```

### Officer Working On It
```sql
status = 'in progress'
workflow_status = 'in_progress'
```

### Completed Successfully
```sql
status = 'resolved'
workflow_status = 'completed'
```

### Rejected/Cancelled
```sql
status = 'rejected'
workflow_status = 'cancelled'
```

---

## ❌ Common Mistakes

### **WRONG:**
```sql
-- ❌ 'resolved' is NOT a valid workflow_status
INSERT INTO complaints (...) VALUES (
  ...,
  'resolved',  -- status (OK)
  'resolved',  -- workflow_status (WRONG!)
  ...
);
```

### **CORRECT:**
```sql
-- ✅ Use 'completed' for workflow_status
INSERT INTO complaints (...) VALUES (
  ...,
  'resolved',   -- status (OK)
  'completed',  -- workflow_status (CORRECT!)
  ...
);
```

---

## 🔍 How to Check Valid Values

Run this query in Supabase:

```sql
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.complaints'::regclass
  AND contype = 'c'; -- check constraints
```

---

## 📚 Reference

These constraints are defined in:
- `DB_FORMAT.sql` (line 135)
- `src/shared/constants.js` (WORKFLOW_STATUS object)
- `src/server/models/Complaint.js` (validation logic)

---

## 💡 Tips

1. **Always use constants** from `src/shared/constants.js` in your code:
   ```javascript
   import { WORKFLOW_STATUS, COMPLAINT_STATUS } from '@/shared/constants';
   
   complaint.status = COMPLAINT_STATUS.RESOLVED;
   complaint.workflow_status = WORKFLOW_STATUS.COMPLETED;
   ```

2. **Don't hardcode strings** - use the constants to avoid typos

3. **Test your SQL** before running seed scripts - use the check query above

---

## 🐛 Error Messages

If you see this error:
```
violates check constraint "complaints_workflow_status_check"
```

**Solution:** You used an invalid `workflow_status` value. Check the valid values list above.

---

**Last Updated:** 2025-10-10


