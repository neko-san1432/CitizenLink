const { extractdepartmentCode } = require("../src/server/utils/roleValidation");
console.log("extractdepartmentCode type:", typeof extractdepartmentCode);
if (typeof extractdepartmentCode !== "function") {
    console.error("FAIL: extractdepartmentCode is not a function!");
} else {
    console.log("SUCCESS: extractdepartmentCode is a function.");
}
