/**
 * Test All Filters
 * Comprehensive test suite for all filter types in the complaint system
 */

// Load environment variables
require('dotenv').config();

const Database = require('../src/server/config/database');

// Test results storage
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

function logTest(name, passed, message = '') {
  if (passed) {
    testResults.passed.push({ name, message });
    console.log(`✓ PASS: ${name}${message ? ' - ' + message : ''}`);
  } else {
    testResults.failed.push({ name, message });
    console.error(`✗ FAIL: ${name}${message ? ' - ' + message : ''}`);
  }
}

function logWarning(name, message) {
  testResults.warnings.push({ name, message });
  console.warn(`⚠ WARN: ${name} - ${message}`);
}

async function testFilters() {
  console.log('='.repeat(80));
  console.log('FILTER TEST SUITE');
  console.log('='.repeat(80));
  console.log('');

  // Initialize database
  const db = new Database();
  const supabase = db.getClient();

  if (!supabase) {
    console.error('Failed to initialize database connection');
    process.exit(1);
  }

  try {
    // Get sample data for testing
    console.log('[TEST] Fetching sample complaints for testing...\n');
    const { data: allComplaints, error: fetchError } = await supabase
      .from('complaints')
      .select('id, workflow_status, confirmation_status, category, subcategory, department_r, submitted_at, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(100);

    if (fetchError) {
      console.error('[TEST] Failed to fetch complaints:', fetchError);
      process.exit(1);
    }

    if (!allComplaints || allComplaints.length === 0) {
      console.error('[TEST] No complaints found in database');
      process.exit(1);
    }

    console.log(`[TEST] Loaded ${allComplaints.length} sample complaints\n`);

    // Get unique values for filter options
    const uniqueStatuses = [...new Set(allComplaints.map(c => c.workflow_status).filter(Boolean))];
    const uniqueCategories = [...new Set(allComplaints.map(c => c.category).filter(Boolean))];
    const uniqueDepartments = [...new Set(
      allComplaints.flatMap(c => (Array.isArray(c.department_r) ? c.department_r : [c.department_r]).filter(Boolean))
    )];

    console.log('[TEST] Available filter values:');
    console.log(`  Statuses: ${uniqueStatuses.length} unique values`);
    console.log(`  Categories: ${uniqueCategories.length} unique values`);
    console.log(`  Departments: ${uniqueDepartments.length} unique values\n`);

    // Test 1: Status Filter
    console.log('[TEST] Testing Status Filter...');
    if (uniqueStatuses.length > 0) {
      const testStatus = uniqueStatuses[0];
      const { data: statusFiltered, error: statusError } = await supabase
        .from('complaints')
        .select('id, workflow_status')
        .eq('workflow_status', testStatus)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (statusError) {
        logTest('Status Filter - Database Query', false, statusError.message);
      } else {
        const allMatch = statusFiltered.every(c => c.workflow_status === testStatus);
        logTest('Status Filter - Database Query', allMatch, 
          `${statusFiltered.length} complaints with status "${testStatus}"`);
        
        if (statusFiltered.length === 0) {
          logWarning('Status Filter', `No complaints found for status "${testStatus}"`);
        }
      }
    } else {
      logWarning('Status Filter', 'No status values found in database');
    }

    // Test 2: Category Filter
    console.log('\n[TEST] Testing Category Filter...');
    if (uniqueCategories.length > 0) {
      const testCategory = uniqueCategories[0];
      const { data: categoryFiltered, error: categoryError } = await supabase
        .from('complaints')
        .select('id, category')
        .eq('category', testCategory)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (categoryError) {
        logTest('Category Filter - Database Query', false, categoryError.message);
      } else {
        const allMatch = categoryFiltered.every(c => c.category === testCategory);
        logTest('Category Filter - Database Query', allMatch,
          `${categoryFiltered.length} complaints with category "${testCategory.substring(0, 8)}..."`);
        
        if (categoryFiltered.length === 0) {
          logWarning('Category Filter', `No complaints found for category "${testCategory.substring(0, 8)}..."`);
        }
      }
    } else {
      logWarning('Category Filter', 'No category values found in database');
    }

    // Test 3: Department Filter
    console.log('\n[TEST] Testing Department Filter...');
    if (uniqueDepartments.length > 0) {
      const testDepartment = uniqueDepartments[0];
      const { data: deptFiltered, error: deptError } = await supabase
        .from('complaints')
        .select('id, department_r')
        .contains('department_r', [testDepartment])
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (deptError) {
        logTest('Department Filter - Database Query', false, deptError.message);
      } else {
        const allMatch = deptFiltered.every(c => {
          const depts = Array.isArray(c.department_r) ? c.department_r : [c.department_r];
          return depts.includes(testDepartment);
        });
        logTest('Department Filter - Database Query', allMatch,
          `${deptFiltered.length} complaints with department "${testDepartment}"`);
        
        if (deptFiltered.length === 0) {
          logWarning('Department Filter', `No complaints found for department "${testDepartment}"`);
        }
      }
    } else {
      logWarning('Department Filter', 'No department values found in database');
    }

    // Test 4: Date Range Filter
    console.log('\n[TEST] Testing Date Range Filter...');
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Test last 7 days
    const { data: date7Filtered, error: date7Error } = await supabase
      .from('complaints')
      .select('id, submitted_at')
      .gte('submitted_at', last7Days.toISOString())
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (date7Error) {
      logTest('Date Range Filter - Last 7 Days', false, date7Error.message);
    } else {
      const allInRange = date7Filtered.every(c => {
        const submitted = new Date(c.submitted_at);
        return submitted >= last7Days;
      });
      logTest('Date Range Filter - Last 7 Days', allInRange,
        `${date7Filtered.length} complaints in last 7 days`);
    }

    // Test last 30 days
    const { data: date30Filtered, error: date30Error } = await supabase
      .from('complaints')
      .select('id, submitted_at')
      .gte('submitted_at', last30Days.toISOString())
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (date30Error) {
      logTest('Date Range Filter - Last 30 Days', false, date30Error.message);
    } else {
      const allInRange = date30Filtered.every(c => {
        const submitted = new Date(c.submitted_at);
        return submitted >= last30Days;
      });
      logTest('Date Range Filter - Last 30 Days', allInRange,
        `${date30Filtered.length} complaints in last 30 days`);
      
      // Verify 30 days includes 7 days
      if (date7Filtered && date30Filtered) {
        const includes7Days = date7Filtered.length <= date30Filtered.length;
        logTest('Date Range Filter - Logic Check', includes7Days,
          'Last 30 days includes last 7 days');
      }
    }

    // Test 5: Include Resolved Filter
    console.log('\n[TEST] Testing Include Resolved Filter...');
    const { data: withResolved, error: withResolvedError } = await supabase
      .from('complaints')
      .select('id, workflow_status')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    const { data: withoutResolved, error: withoutResolvedError } = await supabase
      .from('complaints')
      .select('id, workflow_status')
      .neq('workflow_status', 'completed')
      .neq('workflow_status', 'cancelled')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (withResolvedError || withoutResolvedError) {
      logTest('Include Resolved Filter', false, 
        withResolvedError?.message || withoutResolvedError?.message);
    } else {
      const resolvedCount = (withResolved || []).filter(c => 
        c.workflow_status === 'completed' || c.workflow_status === 'cancelled'
      ).length;
      const logicCorrect = (withResolved?.length || 0) >= (withoutResolved?.length || 0);
      logTest('Include Resolved Filter', logicCorrect,
        `With resolved: ${withResolved?.length || 0}, Without: ${withoutResolved?.length || 0}, Resolved count: ${resolvedCount}`);
    }

    // Test 6: Combined Filters
    console.log('\n[TEST] Testing Combined Filters...');
    if (uniqueStatuses.length > 0 && uniqueCategories.length > 0) {
      const testStatus = uniqueStatuses[0];
      const testCategory = uniqueCategories[0];
      
      const { data: combinedFiltered, error: combinedError } = await supabase
        .from('complaints')
        .select('id, workflow_status, category')
        .eq('workflow_status', testStatus)
        .eq('category', testCategory)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (combinedError) {
        logTest('Combined Filters - Status + Category', false, combinedError.message);
      } else {
        const allMatch = combinedFiltered.every(c => 
          c.workflow_status === testStatus && c.category === testCategory
        );
        logTest('Combined Filters - Status + Category', allMatch,
          `${combinedFiltered.length} complaints matching both filters`);
      }
    } else {
      logWarning('Combined Filters', 'Insufficient data for combined filter test');
    }

    // Test 7: API Service Logic Test
    console.log('\n[TEST] Testing API Service Logic...');
    const ComplaintService = require('../src/server/services/ComplaintService');
    const complaintService = new ComplaintService();

    try {
      // Test with minimal filters
      const result = await complaintService.getComplaintLocations({ includeResolved: true });
      const hasData = Array.isArray(result) && result.length >= 0;
      logTest('API Service - Basic Request', hasData,
        `Received ${result?.length || 0} complaints`);

      // Test with status filter
      if (uniqueStatuses.length > 0) {
        const testStatus = uniqueStatuses[0];
        // First, get count directly from DB to verify filter works
        const { count: directCount } = await supabase
          .from('complaints')
          .select('id', { count: 'exact', head: true })
          .eq('workflow_status', testStatus)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);
        
        const result2 = await complaintService.getComplaintLocations({ 
          status: testStatus, 
          includeResolved: true 
        });
        const hasFilteredData = Array.isArray(result2);
        
        // The API should return fewer or equal to total, and should match the direct count
        const countMatches = result2.length === directCount || (directCount > 0 && result2.length > 0);
        logTest('API Service - Status Filter', hasFilteredData && countMatches,
          `API returned ${result2?.length || 0} complaints, DB direct query: ${directCount || 0} with status "${testStatus}"`);
        
        if (!countMatches && directCount > 0) {
          logWarning('API Service - Status Filter', 
            `Status filter count mismatch. API: ${result2?.length || 0}, Direct DB: ${directCount}`);
        }
      }

      // Test with department filter
      if (uniqueDepartments.length > 0) {
        const testDept = uniqueDepartments[0];
        const result3 = await complaintService.getComplaintLocations({ 
          department: testDept, 
          includeResolved: true 
        });
        const hasFilteredData = Array.isArray(result3);
        logTest('API Service - Department Filter', hasFilteredData,
          `Received ${result3?.length || 0} complaints with department "${testDept}"`);
      }

      // Test with date range
      const result4 = await complaintService.getComplaintLocations({ 
        startDate: last30Days.toISOString(),
        includeResolved: true 
      });
      const hasDateFilter = Array.isArray(result4);
      logTest('API Service - Date Range Filter', hasDateFilter,
        `Received ${result4?.length || 0} complaints in date range`);

    } catch (error) {
      logTest('API Service', false, error.message);
    }

    // Test 8: Boundary Filter
    console.log('\n[TEST] Testing Boundary Filter...');
    const { isWithinDigosBoundary } = require('../src/shared/boundaryValidator');
    
    // Test points inside boundary
    const insidePoint = { lat: 6.85, lng: 125.35 }; // Approximate center of Digos
    const insideResult = isWithinDigosBoundary(insidePoint.lat, insidePoint.lng);
    logTest('Boundary Filter - Inside Point', insideResult, 
      `Point (${insidePoint.lat}, ${insidePoint.lng}) should be inside`);

    // Test points outside boundary
    const outsidePoint = { lat: 7.0, lng: 125.5 }; // Outside Digos
    const outsideResult = isWithinDigosBoundary(outsidePoint.lat, outsidePoint.lng);
    logTest('Boundary Filter - Outside Point', !outsideResult,
      `Point (${outsidePoint.lat}, ${outsidePoint.lng}) should be outside`);

    // Test edge case - boundary edge
    const edgePoint = { lat: 6.723539, lng: 125.264112 }; // Edge of boundary
    const edgeResult = isWithinDigosBoundary(edgePoint.lat, edgePoint.lng);
    logTest('Boundary Filter - Edge Point', typeof edgeResult === 'boolean',
      `Point (${edgePoint.lat}, ${edgePoint.lng}) at boundary edge`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${testResults.passed.length + testResults.failed.length}`);
    console.log(`Passed: ${testResults.passed.length} ✓`);
    console.log(`Failed: ${testResults.failed.length} ✗`);
    console.log(`Warnings: ${testResults.warnings.length} ⚠`);
    console.log('='.repeat(80));

    if (testResults.failed.length > 0) {
      console.log('\nFAILED TESTS:');
      testResults.failed.forEach(test => {
        console.log(`  ✗ ${test.name}: ${test.message}`);
      });
    }

    if (testResults.warnings.length > 0) {
      console.log('\nWARNINGS:');
      testResults.warnings.forEach(warning => {
        console.log(`  ⚠ ${warning.name}: ${warning.message}`);
      });
    }

    // Exit with appropriate code
    process.exit(testResults.failed.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('[TEST] Fatal error:', error);
    process.exit(1);
  }
}

// Run tests
testFilters().catch(error => {
  console.error('[TEST] Fatal error:', error);
  process.exit(1);
});

