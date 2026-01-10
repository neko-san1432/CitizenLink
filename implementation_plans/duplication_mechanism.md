# Duplication Mechanism Implementation Plan

## Objective

To reduce redundancy in complaint reporting, improve data quality for the LGU, and provide citizens with immediate feedback if their issue has already been reported.

## 1. Database Schema Enhancements

We need to track how many people are affected by a single issue without creating distinct rows for each.

- **Table**: `complaints`
  - Add `group_id` (UUID, nullable): To cluster duplicates together (or we can use `master_complaint_id`).
  - Add `upvote_count` (Integer, default 0): To track "me too" reports.
  - Add `affected_users` (JSONB/Array): List of user IDs who "upvoted" or reported duplicates.

_Decision_: We will stick with the existing `master_complaint_id` and `is_duplicate` fields but add `upvote_count` to the master complaint to aggregate impact.

## 2. Backend Logic (Service Layer)

### A. Detection (`ComplaintService.detectDuplicates`)

Before a complaint is saved, we will check for existing _active_ (not resolved/closed) complaints that match:

1.  **Location**: Within a 50-meter radius.
2.  **Category**: Same `category` and `subcategory`.
3.  **Time**: Reported within the last 30 days.

### B. Resolution (`ComplaintService.markAsDuplicate`)

If a duplicate is confirmed (either by user or admin):

1.  Set `is_duplicate = true` on the new complaint.
2.  Set `master_complaint_id = [OriginalComplaintID]`.
3.  Update the **Master Complaint**:
    - Increment `upvote_count`.
    - Append the new reporter's ID to `affected_users` (if we implement that field) or just keep a log.

## 3. Frontend Experience (Citizen)

### "Smart Reporting" Steps

1.  **Location Pin**: When the user pins a location, an API call is made (`/api/complaints/nearby?lat=...&lng=...&category=...`).
2.  **Visual Cue**: If existing complaints are found nearby, show markers on the mini-map or a list below. "Found 3 similar reports nearby: [Title 1], [Title 2]."
3.  **Action**:
    - **"This is it"**: Use updates the existing report (Upvote).
    - **"New Issue"**: User proceeds to create a fresh complaint.

## 4. Admin/Coordinator Tools

### Review Queue

- When opening a complaint, run the `detectDuplicates` logic in the background.
- Show "Potential Duplicates Detected" alert.
- **Merge Tool**: Interface to select complaints and merge them into one Master record.

## 5. Development Steps

1.  **Database**: Add `upvote_count` column to `complaints`.
2.  **API**: Create `/api/complaints/check-duplicates` endpoint.
3.  **Frontend**: Update the `ComplaintForm` to listen to location changes and query the API.
4.  **Admin**: Add "Merge" button in Complaint Details view.
