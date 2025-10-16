# Coordinator Complaint Review Page

## 📋 Overview

The complaint review page allows coordinators to view detailed information about a complaint and take action on it.

**URL Pattern:** `/coordinator/review/:id`

**Example:** `/coordinator/review/11111111-1111-1111-1111-111111111111`

---

## ✅ Features Implemented

### 1. **Complaint Details Display**
- ✅ Title, ID, submitted date, submitter name
- ✅ Status and priority badges
- ✅ Type, subtype, and description
- ✅ Location information
- ✅ Evidence/attachments (if available)
- ✅ Map preview placeholder

### 2. **Similar Complaints Detection**
- ✅ Shows automatically detected similar complaints
- ✅ Displays similarity score (percentage match)
- ✅ Shows similar complaint details (title, type, status, date)
- ✅ Populates duplicate selection dropdown

### 3. **Decision Actions**

#### **Assign to Department**
- Select department from dropdown
- Set priority level (low, medium, high, urgent)
- Optional deadline (date/time picker)
- Optional notes for the department
- Sends notification to department admin

#### **Mark as Duplicate**
- Select master complaint from similar complaints
- Provide reason for marking as duplicate
- Updates complaint status to 'closed'
- Links to master complaint

#### **Mark as Unique**
- Marks complaint as having no duplicates
- Hides similar complaints section
- Updates similarity decisions to 'unique'

#### **Reject Complaint**
- Provide reason for rejection
- Updates complaint status to 'rejected'
- Sends notification to submitter

---

## 🗂️ Files Created

### 1. **HTML Page**
**File:** `views/pages/coordinator/review.html`

**Features:**
- Responsive layout (2-column grid on desktop, stacked on mobile)
- Loading state with spinner
- Error state with helpful message
- Modal dialogs for each action
- Styled badges for status and priority
- Evidence gallery grid
- Similar complaints list

### 2. **Client-Side JavaScript**
**File:** `src/client/coordinator/review.js`

**Functions:**
- `loadComplaint()` - Fetches complaint from API
- `renderComplaint()` - Displays complaint details
- `renderSimilarComplaints()` - Shows similar complaints
- `handleAssign()` - Processes department assignment
- `handleDuplicate()` - Marks as duplicate
- `handleReject()` - Rejects complaint
- `markAsUnique()` - Marks as unique (no duplicates)
- Modal management functions

### 3. **Server Route**
**File:** `src/server/app.js`

**Route:**
```javascript
this.app.get("/coordinator/review/:id", 
  authenticateUser, 
  requireRole(["complaint-coordinator"]), 
  (req, res) => {
    res.sendFile(path.join(config.rootDir, "views", "pages", "coordinator", "review.html"));
  }
);
```

---

## 🔌 API Integration

### Endpoints Used:

1. **GET `/api/coordinator/review-queue/:id`**
   - Fetches complaint details with similarities and workflow logs
   - Returns complaint object with submitter profile
   - Returns array of similar complaints with details

2. **POST `/api/coordinator/review-queue/:id/decide`**
   - Processes coordinator's decision
   - Request body varies by decision type

### Decision Types:

#### **Assign to Department**
```json
{
  "decision": "assign",
  "department": "wst",
  "priority": "high",
  "deadline": "2025-10-15T10:00:00",
  "notes": "Urgent water issue"
}
```

#### **Mark as Duplicate**
```json
{
  "decision": "duplicate",
  "masterComplaintId": "11111111-1111-1111-1111-111111111111",
  "reason": "Same issue reported earlier"
}
```

#### **Reject Complaint**
```json
{
  "decision": "reject",
  "reason": "Not within our jurisdiction"
}
```

#### **Mark as Unique**
```json
{
  "decision": "unique"
}
```

---

## 🎨 UI/UX Features

### **Responsive Design**
- Desktop: 2-column layout (details + action panel)
- Mobile: Stacked layout
- Sticky action panel on desktop

### **Status Indicators**
- Color-coded status badges
- Priority badges (low=blue, medium=yellow, high=red, urgent=dark red)
- Similarity scores shown as percentages

### **User Feedback**
- Loading spinner while fetching data
- Toast notifications for success/error
- Confirmation messages
- Auto-redirect to dashboard after action

### **Accessibility**
- Semantic HTML
- Clear labels and descriptions
- Keyboard-friendly modals
- High-contrast colors

---

## 📊 Data Flow

1. **Page Load**
   - Extract complaint ID from URL
   - Show loading state
   - Fetch complaint from API
   - Render complaint details
   - Check for similar complaints
   - Show/hide action buttons based on similarities

2. **User Action**
   - User clicks action button
   - Modal opens with form
   - User fills form and submits
   - POST request to API
   - Show success/error toast
   - Redirect to dashboard (on success)

3. **Error Handling**
   - API errors show error message
   - Invalid complaint ID shows error state
   - Network errors show toast notification
   - Return to dashboard button provided

---

## 🧪 Testing Checklist

### **Basic Functionality**
- [ ] Page loads for valid complaint ID
- [ ] Complaint details display correctly
- [ ] Status and priority badges show correct colors
- [ ] Back button returns to dashboard

### **Similar Complaints**
- [ ] Similar complaints section shows when similarities exist
- [ ] Similarity scores display correctly
- [ ] Duplicate/Related/Unique buttons appear
- [ ] Master complaint dropdown populated

### **Assign to Department**
- [ ] Modal opens when button clicked
- [ ] All departments listed in dropdown
- [ ] Priority pre-filled from complaint
- [ ] Form submits successfully
- [ ] Notification sent to department admin
- [ ] Redirect to dashboard after success

### **Mark as Duplicate**
- [ ] Modal opens with similar complaints
- [ ] Can select master complaint
- [ ] Reason field required
- [ ] Complaint marked correctly
- [ ] Status updated to 'closed'

### **Mark as Unique**
- [ ] Button marks complaint as unique
- [ ] Similar complaints section hides
- [ ] Action buttons hide
- [ ] Toast notification shows

### **Reject Complaint**
- [ ] Modal opens with reason field
- [ ] Reason required to submit
- [ ] Complaint rejected successfully
- [ ] Notification sent to submitter

### **Error Handling**
- [ ] Invalid complaint ID shows error
- [ ] Network errors handled gracefully
- [ ] API errors show helpful messages
- [ ] Can return to dashboard from error state

---

## 🔗 Related Files

### **Backend**
- `src/server/controllers/CoordinatorController.js` - API handlers
- `src/server/services/CoordinatorService.js` - Business logic
- `src/server/repositories/CoordinatorRepository.js` - Database queries

### **Frontend Components**
- `src/client/components/header.js` - Header component
- `src/client/components/sidebar.js` - Sidebar navigation
- `src/client/components/toast.js` - Toast notifications
- `src/client/auth/authChecker.js` - Authentication check
- `src/client/auth/roleToggle.js` - Role switching

### **Styles**
- `src/client/styles/style.css` - Global styles
- `src/client/styles/toast.css` - Toast notification styles
- Inline styles in `review.html` - Page-specific styles

---

## 🚀 Usage

### **For Coordinators:**

1. **Access from Dashboard**
   - Click on a complaint in the review queue
   - Or click notification link

2. **Review Complaint**
   - Read all details carefully
   - Check for similar complaints (duplicates)
   - Determine appropriate action

3. **Take Action**
   - **Assign:** If valid and should be processed
   - **Duplicate:** If same as existing complaint
   - **Unique:** If no duplicates (removes warning)
   - **Reject:** If invalid or out of scope

4. **After Action**
   - Automatically redirected to dashboard
   - Action reflected in complaint status
   - Notifications sent to relevant parties

---

## 🎯 Next Steps (Future Enhancements)

- [ ] Add map integration (Google Maps/Mapbox)
- [ ] Enable image lightbox for evidence
- [ ] Add workflow history timeline
- [ ] Implement "Link Related Complaints" feature
- [ ] Add bulk actions for multiple complaints
- [ ] Add comment/discussion thread
- [ ] Enable file attachment to notes
- [ ] Add real-time updates (WebSocket)
- [ ] Export complaint details as PDF
- [ ] Add audit trail visibility

---

## 📝 Notes

- **Authentication:** Only complaint coordinators can access this page
- **URL Structure:** Must include valid complaint ID in path
- **API Dependency:** Requires coordinator API endpoints to be working
- **Role Required:** `complaint-coordinator` role
- **Navigation:** Clicking notifications will direct here
- **State Management:** Uses global `currentComplaint` variable

---

**Created:** 2025-10-10  
**Last Updated:** 2025-10-10  
**Status:** ✅ Complete and Ready for Testing


