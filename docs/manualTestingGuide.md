 manualTestingGuide.md

## 🚀 Live User Testing Guide: Duplicate Reporting & Admin Tools

Follow these steps to manually verify the new features as a "Live User".

### **Prerequisites**

1.  **Server Running**: Ensure `npm run dev` is running.
2.  **Two Accounts**:
    - **Citizen Account**: To file reports.
    - **Admin/Coordinator Account**: To merge reports.

---

### **Test 1: Voice Input & Language Hints**

**Goal**: Verify the language hint and voice capture works.

1.  **Login** as a **Citizen**.
2.  Navigate to **"File a complaint"**.
3.  Scroll to the **Description** field.
4.  **Check Hint**: Verify the text `(For Taglish/Bisayish, select the main language used)` is visible below the label.
5.  **Select Language**: Choose **Filipino (Tagalog)** or **Cebuano (Bisaya)** from the dropdown.
6.  **Record**: Click the **Microphone Icon** and speak a sentence (e.g., _"Sira ang kalsada sa may kanto."_).
7.  **Verify**:
    - Toast message should say _"Listening... (Speak clearly...)"_.
    - Text should appear in the text box.

---

### **Test 2: Duplicate Warning (Low Volume)**

**Goal**: Verify the "Yellow Warning" appears when a similar report exists.

1.  **Step 1: Create the "Original" Report**

    - **Location**: Click a specific spot on the map (e.g., specific street corner).
    - **Category**: Choose **Infrastructure**.
    - **Title**: "Big Pothole Test 1".
    - **Submit** the complaint.

2.  **Step 2: Create a "Duplicate" Report**
    - Go back to **"File a complaint"**.
    - **Location**: Click **near** the same spot (within ~20 meters).
    - **Category**: Choose the **SAME** category (Infrastructure).
    - **Title**: "Pothole Again".
    - **Wait**: As you type the description or select the category, the system checks for duplicates.
    - **Verify**:
      - A **Yellow Warning Box** should appear above the form.
      - It should show "Big Pothole Test 1".
      - It should have a **"Me Too / Upvote"** button.

---

### **Test 3: Blocking Mode (Flood)**

**Goal**: Verify the system **BLOCKS** submission if there are too many reports (5+).

_Note: You can spam the form manually 5 times OR use the seed script._

1.  **Run Seed Script** (Optional shortcut):
    - Run: `node src/server/scripts/seedDuplicates.js`
    - This creates 6 duplicate complaints at a specific location.
2.  **Try to Report**:
    - Login as Citizen.
    - Go to **File complaint**.
    - **Location**: Pin the location outputted by the seed script (check console log, usually default Digos coordinates).
    - **Category**: Infrastructure.
    - **Verify**:
      - A **Red Blocking Alert** appears immediately.
      - "We have received high volume of reports...".
      - **Submit Button** is DISABLED.

---

### **Test 4: Admin Merge Tool**

**Goal**: Verify an Admin can merge these duplicates.

1.  **Login** as **complaint Coordinator** or **Admin**.
2.  **Navigate** to **complaints List**.
3.  **Open** the "Original" complaint (or any of the duplicates).
4.  **Check Alert**:
    - You should see a **Orange Alert Box** at the top: _"⚠️ Potential Duplicates Detected"_.
5.  **Merge**:
    - Click **"Review & Merge"**.
    - A modal opens listing the other reports.
    - **Select** all checkboxes.
    - Click **"Merge Selected"**.
6.  **Verify Results**:
    - The page refreshes.
    - **Upvote Count**: Should increase (Original + Merged counts).
    - **Status**: If you check the _other_ complaints, they should now be marked as **Closed/Duplicate**.

---

### **Troubleshooting**

- **No Warning?** Ensure you are picking the exact same **Category** and are physically close enough on the map.
- **No Admin Alert?** Ensure you are logged in as a Coordinator/Admin, not a Citizen.
