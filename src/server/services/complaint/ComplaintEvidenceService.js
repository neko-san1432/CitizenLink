const Database = require("../../config/database");

class ComplaintEvidenceService {
  constructor(complaintRepo) {
    this.complaintRepo = complaintRepo || require("../../repositories/ComplaintRepository");
    this.supabase = Database.getClient();
  }

  async addEvidence(complaintId, files, userId = null) {
    const uploadedFiles = [];

    for (const file of files) {
      try {
        const fileName = `${complaintId}/${Date.now()}-${file.originalname}`;
        const { data, error } = await this.supabase.storage
          .from("complaint-evidence")
          .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (error) throw error;

        const { data: urlData } = this.supabase.storage
          .from("complaint-evidence")
          .getPublicUrl(fileName);

        await this.supabase.from("complaint_evidence").insert({
          complaint_id: complaintId,
          file_name: file.originalname,
          file_path: fileName,
          file_url: urlData.publicUrl,
          file_type: file.mimetype,
          file_size: file.size,
          uploaded_by: userId
        });

        uploadedFiles.push({ name: file.originalname, url: urlData.publicUrl });
      } catch (err) {
        console.error("[FILE] Evidence upload error:", err);
      }
    }

    return uploadedFiles;
  }

  async getEvidence(complaintId) {
    const { data, error } = await this.supabase
      .from("complaint_evidence")
      .select("*")
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

module.exports = ComplaintEvidenceService;
