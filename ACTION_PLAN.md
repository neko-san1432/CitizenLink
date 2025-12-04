# CitizenLink 2.0 - Pre-Testing Action Plan

**Team:** CitizenLink Development Team  
**Date:** December 4, 2025  
**Version:** 2.0.0

---

## A. Summary of Project Status After Progress Reporting

### Completed Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Complaint Management System** | ✅ Complete | Full CRUD operations for citizen complaints with file uploads, status tracking, and workflow management |
| **Multi-Role Authentication** | ✅ Complete | Support for Citizens, LGU Officers, LGU Admins, HR, Complaint Coordinators, and Super Admins |
| **Hierarchical Department Structure** | ✅ Complete | Three-tier organization (Categories → Subcategories → Departments) with automatic routing |
| **DBSCAN Heatmap Clustering** | ✅ Complete | Geospatial analytics for complaint hotspot detection with real-time visualization |
| **Notification System** | ✅ Complete | In-app notifications with deduplication, bulk notifications, and role-specific alerts |
| **Content Management System** | ✅ Complete | News, events, and notices management with draft/published workflow |
| **Duplicate Detection** | ✅ Complete | Similarity-based detection to prevent duplicate complaints |
| **Audit Trail & Logging** | ✅ Complete | Comprehensive logging of all system actions and state changes |
| **Security Implementation** | ✅ Complete | Helmet.js, CSP, XSS protection, input sanitization, rate limiting |
| **Session Management** | ✅ Complete | JWT-based authentication with session invalidation on password change |
| **Role-Based Access Control** | ✅ Complete | Granular permissions with wildcard role matching |
| **File Upload System** | ✅ Complete | Evidence file uploads with Supabase storage integration |
| **Complaint Workflow** | ✅ Complete | Status transitions: new → assigned → in_progress → pending_approval → completed |
| **Boundary Validation** | ✅ Complete | Digos City geographic boundary validation for complaint locations |
| **False Complaint Management** | ✅ Complete | Mark complaints as false with reason tracking |
| **Reminder System** | ✅ Complete | 24-hour cooldown reminder system for citizens |

### Applied Design Patterns

| Pattern | Implementation | Location |
|---------|----------------|----------|
| **MVC + Service Layer (Fat Service, Thin Controller)** | Controllers delegate to services, services contain business logic | `src/server/controllers/`, `src/server/services/` |
| **Repository Pattern** | Data access abstraction with Supabase queries | `src/server/repositories/` |
| **Dependency Injection** | Constructor injection in Controllers and Services | All service and controller constructors |
| **Factory Pattern** | Model constructors, Database client initialization | `src/server/models/`, `src/server/config/database.js` |
| **Singleton Pattern** | Database connection instance | `src/server/config/database.js` |
| **Middleware Pattern** | Auth, security, validation, rate limiting middleware | `src/server/middleware/` |
| **Strategy Pattern** | Role-based access control, notification strategies | `src/server/middleware/auth.js`, `src/server/services/NotificationService.js` |
| **Observer Pattern** | Notification system, event-driven workflows | `src/server/services/NotificationService.js` |
| **Chain of Responsibility** | Express middleware chain for request processing | `src/server/app.js` |
| **Facade Pattern** | Service layer methods orchestrating multiple operations | `src/server/services/ComplaintService.js` |
| **Centralized Error Handling** | ErrorHandler class with asyncWrapper | `src/server/utils/errorHandler.js` |

### Refactoring Accomplished

1. **Removed Debug Print Statements** - Cleaned up `console.log` statements marked as "console.log removed for security" across controllers and services
2. **Normalized Complaint Data** - Created utility functions (`normalizeComplaintData`, `prepareComplaintForInsert`) for consistent data handling
3. **Extracted Auth Utilities** - Moved authentication helper functions to `src/server/utils/authUtils.js`
4. **Role Validation Extraction** - Created dedicated `src/server/utils/roleValidation.js` for role-related logic
5. **Complaint Utils** - Extracted complaint-related utilities to `src/server/utils/complaintUtils.js`
6. **Pagination Implementation** - Consistent pagination across all repository methods
7. **Error Handling Standardization** - Unified error response format across all controllers

### Resolved Issues from Previous Feedback

1. **Session Invalidation** - Implemented token rejection for sessions created before password change
2. **Rate Limiting** - Added multi-tier rate limiting (general, auth, login, password reset, file uploads)
3. **XSS Protection** - Multi-layer XSS prevention with isomorphic-dompurify and xss libraries
4. **SQL Injection Prevention** - Parameterized queries throughout the application
5. **CSRF Protection** - Request verification tokens with proper validation
6. **Cookie Security** - HttpOnly, Secure, SameSite attributes properly configured
7. **Role Wildcard Matching** - Safe wildcard matching for role patterns without vulnerable regex

---

## B. Identified Areas for Improvement

### Critical Priority

| # | Area | Description | Location |
|---|------|-------------|----------|
| 1 | **RPC Function Implementation** | `notifyDepartmentAdminsByCode`, `auto_assign_departments`, `log_complaint_action` RPC functions need implementation or parameter type fixes | `src/server/services/ComplaintService.js:130-189` |
| 2 | **Schema Alignment** | Table update for `confirmed_by_citizen`, `citizen_confirmation_date` columns needs verification | `src/server/services/ComplaintService.js:1395` |
| 3 | **Department Matching Logic** | TODO comment indicates department matching needs fixing | `src/server/controllers/LguAdminController.js:272` |

### High Priority

| # | Area | Description | Location |
|---|------|-------------|----------|
| 4 | **Inline Styles in CSP** | `'unsafe-inline'` needs to be removed after moving inline styles to CSS modules | `src/server/middleware/security.js:9` |
| 5 | **Debug Console Statements** | Remaining `console.log` debug statements need cleanup | `src/server/middleware/auth.js:20,37`, `src/server/models/Complaint.js:62` |
| 6 | **HR Dashboard Stats** | Dashboard statistics implementation incomplete | `src/server/services/HRService.js:230` |
| 7 | **User Listing Implementation** | Proper user listing needs implementation | `src/server/services/RoleManagementService.js:193` |

### Medium Priority

| # | Area | Description | Location |
|---|------|-------------|----------|
| 8 | **OAuth Signup Logging** | Excessive logging in OAuth signup flow | `src/server/controllers/AuthController.js:663-876` |
| 9 | **OCR Logging** | Multiple console.log statements in OCR processing | `src/server/controllers/OCRController.js:392-541` |
| 10 | **SuperAdmin Logging** | Debug logging in role management | `src/server/controllers/SuperAdminController.js:55-172` |
| 11 | **Test Worker Cleanup** | Jest worker process not exiting gracefully (detected open handles) | Test infrastructure |
| 12 | **Error Message Consistency** | Some error messages expose internal details | Various controllers |

### Low Priority

| # | Area | Description | Location |
|---|------|-------------|----------|
| 13 | **Deprecated Dependencies** | Update deprecated packages (eslint, glob, inflight) | `package.json` |
| 14 | **Sharp Optional Dependency** | Handle Sharp unavailability more gracefully | `src/server/controllers/OCRController.js:12` |

---

## C. Pre-Testing Priorities for the Next Meeting

### Checklist

- [x] **All modules compile without errors** - Verified via `npm install` and server startup
- [x] **All existing tests pass** - 182 tests passing (18 test suites)
- [ ] **Stabilize functions with inconsistent outputs**
  - [ ] Fix RPC function parameter types for `log_complaint_action`
  - [ ] Verify database schema for confirmation status columns
  - [ ] Test department matching logic under various scenarios
- [ ] **Finalize expected behaviors for each feature**
  - [ ] Document complaint workflow state transitions
  - [ ] Define expected notification triggers for each status change
  - [ ] Clarify role permissions matrix
- [ ] **Remove debugging print statements**
  - [ ] Clean up AUTH DEBUG statements in `auth.js`
  - [ ] Remove OAuth signup verbose logging
  - [ ] Clean up OCR processing logs
  - [ ] Remove SuperAdmin controller debug logs
- [x] **Freeze feature additions** - No new features during test design phase

### Pre-Testing Verification Steps

1. Run full test suite: `npm test`
2. Verify server startup: `npm start`
3. Check for linting issues if linter is configured
4. Review console output for unexpected errors
5. Validate database connectivity

---

## D. Assignment of Roles for Testing

### Testing Team Assignments

| Role | Assigned To | Responsibilities |
|------|-------------|------------------|
| **Test Case Designer** | Pyrrhus Go | Design test cases, create test scenarios, define expected behaviors, document edge cases |
| **Test Executor** | John Dave Maca | Execute test cases, report bugs, validate fixes, perform regression testing |
| **Test Executor** | Josh Andre Timosan | Execute test cases, report bugs, validate fixes, perform integration testing |

### Testing Areas Distribution

| Tester | Primary Testing Areas |
|--------|----------------------|
| John Dave Maca | Frontend components, UI/UX flows, client-side validation, map visualization |
| Josh Andre Timosan | Database operations, API endpoints, data integrity, performance testing |

---

## Evidence of Improvements

> **Repository:** [neko-san1432/CitizenLink](https://github.com/neko-san1432/CitizenLink)  
> **Main Implementation Commit:** [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea)

### Code Snippets: Before and After

#### 1. Authentication Session Invalidation (Added)

**Commit:** [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) | **File:** [`src/server/middleware/auth.js`](https://github.com/neko-san1432/CitizenLink/blob/610dfea/src/server/middleware/auth.js)

**Before:** No session invalidation on password change

**After:** (`src/server/middleware/auth.js`)
```javascript
// Check if sessions were invalidated (e.g., after password change)
const sessionsInvalidatedAt = userMetadata.sessions_invalidated_at;
const passwordChangedAt = userMetadata.password_changed_at;

if (sessionsInvalidatedAt || passwordChangedAt) {
  // Decode JWT token to get issued-at time (iat claim)
  const tokenParts = token.split('.');
  if (tokenParts.length === 3) {
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const tokenIssuedAt = payload.iat ? new Date(payload.iat * 1000) : null;
    const invalidationTime = sessionsInvalidatedAt || passwordChangedAt;
    
    if (tokenIssuedAt && invalidationTime && new Date(invalidationTime) > tokenIssuedAt) {
      return res.status(401).json({
        success: false,
        error: 'Session invalidated. Please login again.'
      });
    }
  }
}
```

#### 2. Notification Deduplication (Added)

**Commit:** [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) | **File:** [`src/server/services/NotificationService.js`](https://github.com/neko-san1432/CitizenLink/blob/610dfea/src/server/services/NotificationService.js)

**Before:** No duplicate notification prevention

**After:** (`src/server/services/NotificationService.js`)
```javascript
async checkDuplicateNotification(userId, type, title, metadata = {}) {
  const { data, error } = await this.supabase
    .from('notification')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('title', title)
    .eq('read', false)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1);
  
  return {
    exists: data && data.length > 0,
    notification: data?.[0] || null
  };
}
```

#### 3. Centralized Error Handler (Refactored)

**Commit:** [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) | **File:** [`src/server/utils/errorHandler.js`](https://github.com/neko-san1432/CitizenLink/blob/610dfea/src/server/utils/errorHandler.js)

**Before:** Error handling scattered across controllers

**After:** (`src/server/utils/errorHandler.js`)
```javascript
const handleError = (error, context = 'UNKNOWN') => {
  const timestamp = new Date().toISOString();
  
  // Classification based on error type
  if (error.name === 'ValidationError') {
    console.warn(`[${context}] ${timestamp} Validation failed:`, error.message);
    return { status: 400, message: error.message };
  }
  
  // Log with appropriate level
  console.error(`[${context}] ${timestamp} Error:`, error.message);
  return { status: 500, message: 'Internal server error' };
};
```

#### 4. Role Validation Extraction (Refactored)

**Commit:** [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) | **File:** [`src/server/utils/roleValidation.js`](https://github.com/neko-san1432/CitizenLink/blob/610dfea/src/server/utils/roleValidation.js)

**Before:** Role validation logic in auth middleware

**After:** (`src/server/utils/roleValidation.js`)
```javascript
const validateUserRole = async (role) => {
  const validRoles = [
    'citizen', 'lgu-officer', 'lgu-admin', 'lgu-hr',
    'complaint-coordinator', 'super-admin'
  ];
  
  const baseRole = role.split('-').slice(0, 2).join('-');
  const isValid = validRoles.some(r => role.startsWith(r) || baseRole === r);
  
  return {
    isValid,
    error: isValid ? null : `Unknown role: ${role}`
  };
};
```

### Issues Resolved Since Last Report

| # | Issue | Resolution | Commit |
|---|-------|------------|--------|
| 1 | Session tokens valid after password change | Implemented JWT issued-at validation against password change timestamp | [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) |
| 2 | Duplicate notifications flooding users | Added 24-hour deduplication check before creating notifications | [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) |
| 3 | Inconsistent error responses | Created centralized ErrorHandler with standardized response format | [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) |
| 4 | Role validation in multiple locations | Extracted to dedicated roleValidation utility module | [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) |
| 5 | Console.log statements leaking sensitive data | Removed or replaced with secure logging | [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) |
| 6 | Missing rate limiting on sensitive endpoints | Implemented multi-tier rate limiting system | [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) |
| 7 | XSS vulnerabilities in user input | Added multi-layer sanitization with DOMPurify and xss library | [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) |
| 8 | Complaint data normalization issues | Created utility functions for consistent data handling | [`610dfea`](https://github.com/neko-san1432/CitizenLink/commit/610dfea) |

---

*Document prepared for pre-testing phase review*
