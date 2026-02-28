/**
 * Thesis Parameter Verification Script
 * Run this to confirm ADAPTIVE_EPSILON/ADAPTIVE_MINPTS match thesis claims
 * 
 * Usage: node verify-thesis-params.js
 */

const {
    ADAPTIVE_EPSILON,
    ADAPTIVE_MINPTS,
    getEpsilonForCategory,
    getMinPtsForCategory,
    epsilonToMeters,
    verifyThesisParameters
} = require('./src/server/utils/similarityUtils');

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║     THESIS PARAMETER VERIFICATION - CitizenLink v5.0          ║");
console.log("║     Synchronized with CitizenLink_Simulated_System            ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

// Test 1: Infrastructure Radius
console.log("📍 TEST 1: Infrastructure Radius (Should be 0.001125 ≈ 125m)");
console.log("   ├─ ADAPTIVE_EPSILON['Infrastructure']:", ADAPTIVE_EPSILON["Infrastructure"]);
console.log("   ├─ getEpsilonForCategory('Pothole'):", getEpsilonForCategory("Pothole"));
console.log("   ├─ getEpsilonForCategory('Road Damage'):", getEpsilonForCategory("Road Damage"));
console.log("   └─ In meters:", epsilonToMeters(ADAPTIVE_EPSILON["Infrastructure"]), "m");
const infra_pass = ADAPTIVE_EPSILON["Infrastructure"] === 0.001125;
console.log(`   ${infra_pass ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Sanitation Radius
console.log("🗑️ TEST 2: Sanitation Radius (Should be 0.000144 ≈ 16m)");
console.log("   ├─ ADAPTIVE_EPSILON['Sanitation']:", ADAPTIVE_EPSILON["Sanitation"]);
console.log("   ├─ ADAPTIVE_EPSILON['Garbage']:", ADAPTIVE_EPSILON["Garbage"]);
console.log("   ├─ getEpsilonForCategory('Trash'):", getEpsilonForCategory("Trash"));
console.log("   └─ In meters:", epsilonToMeters(ADAPTIVE_EPSILON["Sanitation"]), "m");
const sanitation_pass = ADAPTIVE_EPSILON["Sanitation"] === 0.000144;
console.log(`   ${sanitation_pass ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Public Safety Radius
console.log("🔥 TEST 3: Public Safety Radius (Should be 0.00045 ≈ 50m)");
console.log("   ├─ ADAPTIVE_EPSILON['Fire']:", ADAPTIVE_EPSILON["Fire"]);
console.log("   ├─ ADAPTIVE_EPSILON['Crime']:", ADAPTIVE_EPSILON["Crime"]);
console.log("   ├─ getEpsilonForCategory('Accident'):", getEpsilonForCategory("Accident"));
console.log("   └─ In meters:", epsilonToMeters(ADAPTIVE_EPSILON["Fire"]), "m");
const safety_pass = ADAPTIVE_EPSILON["Fire"] === 0.00045;
console.log(`   ${safety_pass ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: Default Fallback
console.log("⚙️ TEST 4: Default Fallback (Should be 0.00030 ≈ 33m)");
console.log("   ├─ ADAPTIVE_EPSILON['default']:", ADAPTIVE_EPSILON["default"]);
console.log("   ├─ getEpsilonForCategory('UnknownCategory'):", getEpsilonForCategory("UnknownCategory"));
console.log("   └─ In meters:", epsilonToMeters(ADAPTIVE_EPSILON["default"]), "m");
const default_pass = ADAPTIVE_EPSILON["default"] === 0.00030;
console.log(`   ${default_pass ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 5: MinPts Values
console.log("📊 TEST 5: ADAPTIVE_MINPTS Values");
console.log("   ├─ Fire (Critical, should be 2):", ADAPTIVE_MINPTS["Fire"]);
console.log("   ├─ Crime (High Priority, should be 3):", ADAPTIVE_MINPTS["Crime"]);
console.log("   ├─ Pothole (Infrastructure, should be 5):", ADAPTIVE_MINPTS["Pothole"]);
console.log("   ├─ Garbage (Sanitation, should be 4):", ADAPTIVE_MINPTS["Garbage"]);
console.log("   └─ default (should be 3):", ADAPTIVE_MINPTS["default"]);
const minpts_pass =
    ADAPTIVE_MINPTS["Fire"] === 2 &&
    ADAPTIVE_MINPTS["Crime"] === 3 &&
    ADAPTIVE_MINPTS["Pothole"] === 5 &&
    ADAPTIVE_MINPTS["Garbage"] === 4;
console.log(`   ${minpts_pass ? '✅ PASS' : '❌ FAIL'}\n`);

// Summary
console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║                     VERIFICATION SUMMARY                       ║");
console.log("╠════════════════════════════════════════════════════════════════╣");
console.log(`║  Infrastructure (125m):  ${infra_pass ? '✅ PASS' : '❌ FAIL'}                                ║`);
console.log(`║  Sanitation (16m):       ${sanitation_pass ? '✅ PASS' : '❌ FAIL'}                                ║`);
console.log(`║  Public Safety (50m):    ${safety_pass ? '✅ PASS' : '❌ FAIL'}                                ║`);
console.log(`║  Default Fallback (33m): ${default_pass ? '✅ PASS' : '❌ FAIL'}                                ║`);
console.log(`║  MinPts Configuration:   ${minpts_pass ? '✅ PASS' : '❌ FAIL'}                                ║`);
console.log("╠════════════════════════════════════════════════════════════════╣");

const all_pass = infra_pass && sanitation_pass && safety_pass && default_pass && minpts_pass;
console.log(`║  OVERALL RESULT: ${all_pass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}                       ║`);
console.log("╚════════════════════════════════════════════════════════════════╝");

// Exit with appropriate code
process.exit(all_pass ? 0 : 1);
