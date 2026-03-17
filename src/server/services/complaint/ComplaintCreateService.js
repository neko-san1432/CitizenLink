const {
  getEpsilonForCategory,
  getMinPtsForCategory,
  epsilonToMeters,
} = require("../../utils/similarityUtils");

class ComplaintCreateService {
  constructor(complaintRepo, assignmentRepo, departmentRepo) {
    this.complaintRepo = complaintRepo;
    this.assignmentRepo = assignmentRepo;
    this.departmentRepo = departmentRepo;
    this.complaintRepo = complaintRepo || require("../../repositories/ComplaintRepository");
    this.assignmentRepo = assignmentRepo || require("../../repositories/ComplaintAssignmentRepository");
    this.departmentRepo = departmentRepo || require("../../repositories/DepartmentRepository");
  }

  async processWorkflow(complaint, departmentArray) {
    if (departmentArray.length > 0) {
      try {
        await this.complaintRepo.update(complaint.id, {
          workflow_status: "submitted",
          updated_at: new Date().toISOString(),
        });

        for (const deptCode of departmentArray) {
          try {
            const dept = await this.departmentRepo.findByCode(deptCode);
            if (dept && dept.id) {
              await this.assignmentRepo.assign(
                complaint.id,
                dept.id,
                complaint.submitted_by,
                { status: "pending" }
              );
            }
          } catch (error) {
            console.warn("[WORKFLOW] Assignment creation failed for dept:", deptCode, error.message);
          }
        }
      } catch (error) {
        console.warn("[WORKFLOW] department assignment failed:", error.message);
      }
    }

    if (departmentArray.length > 0) {
      const targetDept = departmentArray[0];
      try {
        const coordinator = await this.complaintRepo.findActiveCoordinator(targetDept);
        if (coordinator) {
          await this.complaintRepo.assignCoordinator(complaint.id, coordinator.user_id);
        }
      } catch (error) {
        console.warn("[WORKFLOW] Coordinator assignment failed:", error.message);
      }
    }
  }

  async detectDuplicates(complaintData) {
    try {
      if (!complaintData.latitude || !complaintData.longitude) return [];

      const { latitude, longitude, category } = complaintData;
      const { isPotentialDuplicate } = require("../../utils/similarityUtils");

      const lookbackDate = new Date();
      lookbackDate.setHours(lookbackDate.getHours() - 48);

      const { createClient } = require("@supabase/supabase-js");
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      let client = this.complaintRepo.supabase;

      if (serviceKey) {
        client = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
      }

      const ROUGH_DEGREE_DIFF = 0.01;
      const { data: candidates, error } = await client
        .from("complaints")
        .select("id, description, latitude, longitude, submitted_at, workflow_status, category, upvote_count")
        .gte("submitted_at", lookbackDate.toISOString())
        .neq("workflow_status", "closed")
        .neq("workflow_status", "rejected")
        .neq("workflow_status", "cancelled")
        .gte("latitude", latitude - ROUGH_DEGREE_DIFF)
        .lte("latitude", latitude + ROUGH_DEGREE_DIFF)
        .gte("longitude", longitude - ROUGH_DEGREE_DIFF)
        .lte("longitude", longitude + ROUGH_DEGREE_DIFF);

      if (error || !candidates || candidates.length === 0) return [];

      return candidates
        .filter((existing) => {
          const check = isPotentialDuplicate(
            { latitude, longitude, category, submitted_at: new Date() },
            existing
          );
          if (check.isMatch) {
            existing.similarity_details = check;
            return true;
          }
          return false;
        })
        .map((c) => ({
          ...c,
          distance: c.similarity_details.distance,
          similarity: "High (3-Layer Match)",
        }))
        .sort((a, b) => a.distance - b.distance);
    } catch (error) {
      console.error("Duplicate detection failed:", error);
      return [];
    }
  }
}

module.exports = ComplaintCreateService;
