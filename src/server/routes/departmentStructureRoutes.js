const express = require("express");
const router = express.Router();
const DepartmentService = require("../services/DepartmentService");
const Database = require("../config/database");

const deptService = new DepartmentService();
const supabase = Database.getClient();

// Get all departments (public/citizen accessible)
router.get("/departments/all", async (req, res) => {
  try {
    const departments = await deptService.getActiveDepartments();
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch departments" });
  }
});

// Get all categories (public/citizen accessible)
router.get("/categories", async (req, res) => {
  try {
    // Hardcoded Categories and Subcategories (Fallback due to missing tables)
    const hardcodedData = [
      {
        id: "d9e117a3-6336-4e52-8706-037198305736",
        name: "General",
        description: "General complaints and inquiries",
        subcategories: [
          { id: "s1", name: "Inquiry", description: "General inquiry" },
          { id: "s2", name: "Feedback", description: "General feedback" },
        ],
      },
      {
        id: "a1e117a3-6336-4e52-8706-037198305737",
        name: "Infrastructure",
        description: "Roads, buildings, and public facilities",
        subcategories: [
          { id: "s3", name: "Road Damage", description: "Potholes, cracks" },
          {
            id: "s4",
            name: "Lighting",
            description: "Streetlights not working",
          },
        ],
      },
      {
        id: "b2e117a3-6336-4e52-8706-037198305738",
        name: "Environment",
        description: "Garbage, pollution, and greenery",
        subcategories: [
          { id: "s5", name: "Garbage" },
          { id: "s6", name: "Noise" },
        ],
      },
      {
        id: "c3e117a3-6336-4e52-8706-037198305739",
        name: "Utilities",
        description: "Water, electricity, and telecommunications",
        subcategories: [
          { id: "s7", name: "Water Leak" },
          { id: "s8", name: "No Power" },
        ],
      },
    ];

    res.json({ success: true, data: hardcodedData });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories: " + error.message,
    });
  }
});

module.exports = router;
