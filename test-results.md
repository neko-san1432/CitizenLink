## Test Execution Report
Generated: 2025-10-28T02:52:30.029Z

### TC-001: Valid citizen credentials
- **Input**: citizen1@gmail.com / 12345678
- **Expected**: Citizen Dashboard loads
- **Actual**: Error: Request failed with status code 401
- **Status**: ❌ Fail

### TC-002: Invalid password
- **Input**: citizen1@email.com / 123456789
- **Expected**: Error message: "Invalid credentials."
- **Actual**: Status: 401, Message: Invalid email or password
- **Status**: ✅ Pass

### TC-005: Valid complaint submission
- **Input**: Type: Waste, Location: Rizal Ave, Description: Garbage pile
- **Expected**: Success message. User redirected to My Complaints
- **Actual**: Status: 200, Message: Created
- **Status**: ✅ Pass

### TC-006: Missing required field (Description)
- **Input**: Type: Noise, Location: Magsaysay St, Description: (empty)
- **Expected**: Validation error: "Description is required."
- **Actual**: Expected validation error but got success
- **Status**: ❌ Fail

### TC-007: User has existing complaints
- **Input**: Login as citizen1@email.com
- **Expected**: List of complaints displayed correctly
- **Actual**: Status: 200, Complaints: 0
- **Status**: ✅ Pass

### TC-009: Admin navigates to heatmap page
- **Input**: Login as pnpadmin@gmail.com
- **Expected**: Map interface loads, centered on Digos City
- **Actual**: Status: 200
- **Status**: ✅ Pass


## Summary
Total Tests: 6
Passed: 4
Failed: 2
Pass Rate: 66.7%
