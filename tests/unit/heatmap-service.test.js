/**
 * Unit Tests: Heatmap Service
 *
 * Tests the heatmap data transformation and filtering logic
 */

describe("Heatmap Data Processing", () => {
  describe("Coordinate Validation", () => {
    it("should validate numeric coordinates", () => {
      const validateCoordinates = (lat, lng) => {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        return !isNaN(parsedLat) && !isNaN(parsedLng) &&
               isFinite(parsedLat) && isFinite(parsedLng);
      };

      expect(validateCoordinates(14.5995, 120.9842)).toBe(true);
      expect(validateCoordinates("14.5995", "120.9842")).toBe(true);
      expect(validateCoordinates(null, 120.9842)).toBe(false);
      expect(validateCoordinates(14.5995, undefined)).toBe(false);
      expect(validateCoordinates("invalid", 120.9842)).toBe(false);
      expect(validateCoordinates(Infinity, 120.9842)).toBe(false);
    });

    it("should parse string coordinates to numbers", () => {
      const lat = parseFloat("14.5995");
      const lng = parseFloat("120.9842");

      expect(lat).toBe(14.5995);
      expect(lng).toBe(120.9842);
      expect(typeof lat).toBe("number");
      expect(typeof lng).toBe("number");
    });
  });

  describe("Department Array Handling", () => {
    it("should handle department_r as array", () => {
      const complaint = {
        department_r: ["DPWH", "DPS"]
      };

      const departmentR = Array.isArray(complaint.department_r)
        ? complaint.department_r
        : (complaint.department_r ? [complaint.department_r] : []);

      expect(departmentR).toEqual(["DPWH", "DPS"]);
      expect(departmentR.length).toBe(2);
    });

    it("should convert string department_r to array", () => {
      const complaint = {
        department_r: "DPWH"
      };

      const departmentR = Array.isArray(complaint.department_r)
        ? complaint.department_r
        : (complaint.department_r ? [complaint.department_r] : []);

      expect(departmentR).toEqual(["DPWH"]);
      expect(Array.isArray(departmentR)).toBe(true);
    });

    it("should handle null/undefined department_r", () => {
      const complaint = {
        department_r: null
      };

      const departmentR = Array.isArray(complaint.department_r)
        ? complaint.department_r
        : (complaint.department_r ? [complaint.department_r] : []);

      expect(departmentR).toEqual([]);
    });
  });

  describe("Heatmap Data Transformation", () => {
    it("should transform complaint to heatmap format", () => {
      const mockComplaint = {
        id: "complaint-123",
        title: "Pothole on Main Street",
        workflow_status: "assigned",
        priority: "high",
        latitude: "14.5995",
        longitude: "120.9842",
        location_text: "Manila City Hall",
        submitted_at: "2023-01-15T10:00:00Z",
        department_r: ["DPWH", "DOT"],
        category: "infrastructure-cat-id",
        subcategory: "roads-subcat-id"
      };

      // Simulate transformation logic
      const lat = parseFloat(mockComplaint.latitude);
      const lng = parseFloat(mockComplaint.longitude);
      const departmentR = Array.isArray(mockComplaint.department_r)
        ? mockComplaint.department_r
        : (mockComplaint.department_r ? [mockComplaint.department_r] : []);

      const transformed = {
        id: mockComplaint.id,
        title: mockComplaint.title,
        status: mockComplaint.workflow_status,
        priority: mockComplaint.priority || "medium",
        lat,
        lng,
        location: mockComplaint.location_text || "",
        submittedAt: mockComplaint.submitted_at,
        department: departmentR.length > 0 ? departmentR[0] : "Unknown",
        departments: departmentR,
        secondaryDepartments: departmentR.length > 1 ? departmentR.slice(1) : [],
        type: mockComplaint.category || "General",
        category: mockComplaint.category,
        subcategory: mockComplaint.subcategory
      };

      expect(transformed.lat).toBe(14.5995);
      expect(transformed.lng).toBe(120.9842);
      expect(transformed.department).toBe("DPWH");
      expect(transformed.departments).toEqual(["DPWH", "DOT"]);
      expect(transformed.secondaryDepartments).toEqual(["DOT"]);
      expect(transformed.status).toBe("assigned");
    });

    it("should filter out complaints with invalid coordinates", () => {
      const mockComplaints = [
        { id: "1", latitude: 14.5, longitude: 120.9, title: "Valid 1" },
        { id: "2", latitude: null, longitude: 120.9, title: "Invalid - null lat" },
        { id: "3", latitude: 14.5, longitude: undefined, title: "Invalid - undefined lng" },
        { id: "4", latitude: "invalid", longitude: 120.9, title: "Invalid - string lat" },
        { id: "5", latitude: 14.6, longitude: 121.0, title: "Valid 2" }
      ];

      const validComplaints = mockComplaints
        .map(complaint => {
          const lat = parseFloat(complaint.latitude);
          const lng = parseFloat(complaint.longitude);

          if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
            return null;
          }

          return { ...complaint, lat, lng };
        })
        .filter(Boolean);

      expect(validComplaints).toHaveLength(2);
      expect(validComplaints[0].id).toBe("1");
      expect(validComplaints[1].id).toBe("5");
    });
  });

  describe("Status Filtering", () => {
    it("should filter by single status", () => {
      const complaints = [
        { id: "1", workflow_status: "new" },
        { id: "2", workflow_status: "assigned" },
        { id: "3", workflow_status: "new" },
        { id: "4", workflow_status: "completed" }
      ];

      const status = "new";
      const filtered = complaints.filter(c => c.workflow_status === status);

      expect(filtered).toHaveLength(2);
      expect(filtered.map(c => c.id)).toEqual(["1", "3"]);
    });

    it("should filter by multiple statuses", () => {
      const complaints = [
        { id: "1", workflow_status: "new" },
        { id: "2", workflow_status: "assigned" },
        { id: "3", workflow_status: "in_progress" },
        { id: "4", workflow_status: "completed" }
      ];

      const statuses = ["new", "assigned"];
      const filtered = complaints.filter(c => statuses.includes(c.workflow_status));

      expect(filtered).toHaveLength(2);
      expect(filtered.map(c => c.id)).toEqual(["1", "2"]);
    });
  });

  describe("Department Filtering", () => {
    it("should filter by department code", () => {
      const complaints = [
        { id: "1", department_r: ["DPWH"] },
        { id: "2", department_r: ["DPS"] },
        { id: "3", department_r: ["DPWH", "DOT"] },
        { id: "4", department_r: ["DOH"] }
      ];

      const department = "DPWH";
      const filtered = complaints.filter(c =>
        Array.isArray(c.department_r) && c.department_r.includes(department)
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(c => c.id)).toEqual(["1", "3"]);
    });
  });

  describe("Priority Handling", () => {
    it("should default to medium priority when not specified", () => {
      const complaint = {
        id: "1",
        title: "Test"
      };

      const priority = complaint.priority || "medium";
      expect(priority).toBe("medium");
    });

    it("should preserve explicit priority", () => {
      const complaint = {
        id: "1",
        title: "Test",
        priority: "high"
      };

      const priority = complaint.priority || "medium";
      expect(priority).toBe("high");
    });
  });
});
