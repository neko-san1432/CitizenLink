# Complaint Assignment Status - LGU vs Officer Level

## Two-Level System

### 1. **Complaints Table** (`complaints` table)
This tracks the **overall complaint status** at the LGU/department level:

**Key Fields:**
- `workflow_status` - Overall complaint status:
  - `new` - Just submitted
  - `assigned` - Assigned to department (no specific officer yet)
  - `in_progress` - LGU is working on it
  - `completed` - LGU has finished
  - `cancelled` - Citizen cancelled
  
- `department_r` (ARRAY) - Which departments are responsible:
  - Example: `['WST', 'ENGINEERING']`
  - Initially empty on submission
  - Populated by coordinator when approving
  
- `assigned_coordinator_id` - Which coordinator is reviewing

### 2. **Complaint Assignments Table** (`complaint_assignments` table)
This tracks **specific officer assignments** within a department:

**Key Fields:**
- `complaint_id` - Which complaint
- `department_id` - Which department (if department-level assignment)
- `assigned_to` - Which specific officer (NULL if department-level only)
- `assigned_by` - Admin who made the assignment
- `status` - Assignment status:
  - `pending` - Not yet accepted
  - `assigned` - Officer notified
  - `in_progress` - Officer working on it
  - `completed` - Officer finished
  - `cancelled` - Assignment cancelled

## Status Flow

```
Citizen Submits
    ↓
complaints.workflow_status = 'new'
complaints.department_r = [] (empty)

Coordinator Reviews & Approves
    ↓
complaints.workflow_status = 'assigned'
complaints.department_r = ['WST']
complaint_assignments created (department-level, no assigned_to)

LGU Admin Assigns to Officers
    ↓
complaint_assignments.assigned_to = officer_id (specific officer)
complaint_assignments.status = 'assigned'

Officer Starts Work
    ↓
complaint_assignments.status = 'in_progress'
complaints.workflow_status = 'in_progress'

Officer Completes
    ↓
complaint_assignments.status = 'completed'
complaints.workflow_status = 'completed' (when all assignments done)
```

## Answer to Your Question

**To change complaint status to "LGU as a whole" (department-level):**

1. **Update `complaints` table:**
   - Set `workflow_status` = 'assigned' or 'in_progress'
   - Set `department_r` array with department codes

2. **Update `complaint_assignments` table:**
   - Create assignment with `department_id` set
   - Keep `assigned_to` = NULL (department-level assignment)
   - Set `status` = 'pending'

**To change to "specific officer":**

1. **Keep `complaints` table unchanged**
2. **Update `complaint_assignments` table:**
   - Update existing assignment OR create new one
   - Set `assigned_to` = officer user ID
   - Set `assigned_by` = admin user ID  
   - Set `status` = 'assigned'

## Key Difference

| Level | Table Used | Status Field |
|-------|-----------|--------------|
| LGU/Department Overall | `complaints` | `workflow_status` |
| Individual Officer | `complaint_assignments` | `status` |
| Department Assignment | `complaints` | `department_r` (array) |



