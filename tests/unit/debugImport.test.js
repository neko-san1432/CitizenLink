describe("Module import smoke tests", () => {
  test("loads active service modules", () => {
    expect(() => require("../../src/server/services/duplicationDetectionService")).not.toThrow();
    expect(() => require("../../src/server/services/similarityCalculatorService")).not.toThrow();
    expect(() => require("../../src/server/services/ruleBasedSuggestionService")).not.toThrow();
    expect(() => require("../../src/server/utils/barangayClassifier")).not.toThrow();
    expect(() => require("../../src/server/services/complaintService")).not.toThrow();
  });
});
