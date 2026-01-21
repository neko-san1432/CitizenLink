const {
  isPotentialDuplicate,
} = require("../../src/server/utils/similarityUtils");

describe("Duplicate Detection Logic (3-Layer)", () => {
  // Test Data
  const BASE_COMPLAINT = {
    latitude: 6.7578,
    longitude: 125.3572,
    category: "uuid-1",
    categoryName: "Pothole Repair",
    submitted_at: new Date().toISOString(),
  };

  test("Should match Exact Duplicate (Low Epsilon)", () => {
    const candidate = {
      ...BASE_COMPLAINT,
      id: "1",
      latitude: 6.7578 + 0.00001, // ~1m
      longitude: 125.3572,
      category: "uuid-1", // Match
      submitted_at: new Date(Date.now() - 3600000).toISOString(),
    };

    const result = isPotentialDuplicate(BASE_COMPLAINT, candidate);
    expect(result.isMatch).toBe(true);
  });

  test("Should REJECT Wide Radius for Pothole (Spatial)", () => {
    const candidate = {
      ...BASE_COMPLAINT,
      id: "2",
      latitude: 6.7578 + 0.003, // ~330m
      longitude: 125.3572,
      category: "uuid-1",
      submitted_at: new Date().toISOString(),
    };

    const result = isPotentialDuplicate(BASE_COMPLAINT, candidate);
    // Pothole radius is 20m. 330m > 20m. Should fail.
    expect(result.isMatch).toBe(false);
    expect(result.reason).toBe("spatial");
  });

  test("Should match Wide Radius for Flood (Environmental)", () => {
    const FLOOD_COMPLAINT = {
      latitude: 6.7578,
      longitude: 125.3572,
      category: "uuid-2",
      categoryName: "Flood Report", // Triggers Large Epsilon (500m)
      submitted_at: new Date().toISOString(),
    };

    const candidate = {
      ...FLOOD_COMPLAINT,
      id: "3",
      latitude: 6.7578 + 0.003, // ~330m
      longitude: 125.3572,
      category: "uuid-2",
      submitted_at: new Date().toISOString(),
    };

    const result = isPotentialDuplicate(FLOOD_COMPLAINT, candidate);
    // Flood radius is 500m. 330m < 500m. Should match.
    expect(result.isMatch).toBe(true);
  });

  test("Should REJECT Temporal Duplicate (>48h)", () => {
    const candidate = {
      ...BASE_COMPLAINT,
      id: "4",
      submitted_at: new Date(Date.now() - 50 * 3600000).toISOString(), // 50h ago
    };

    const result = isPotentialDuplicate(BASE_COMPLAINT, candidate);
    expect(result.isMatch).toBe(false);
    expect(result.reason).toBe("temporal");
  });
});
