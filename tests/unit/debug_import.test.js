describe("Module import smoke tests", () => {
  test("loads active service modules", () => {
    expect(() => require("../../src/server/services/DuplicationDetectionService")).not.toThrow();
    expect(() => require("../../src/server/services/SimilarityCalculatorService")).not.toThrow();
    expect(() => require("../../src/server/services/RuleBasedSuggestionService")).not.toThrow();
    expect(() => require("../../src/server/utils/barangayClassifier")).not.toThrow();
    expect(() => require("../../src/server/services/ComplaintService")).not.toThrow();
  });
});
