class ComplaintVoteService {
  constructor(complaintRepo) {
    this.complaintRepo = complaintRepo || require("../../repositories/ComplaintRepository");
  }

  async upvoteComplaint(complaintId, userId) {
    const client = this.complaintRepo.supabase;

    const { data: existingVote, error: checkError } = await client
      .from("complaint_upvotes")
      .select("id")
      .eq("complaint_id", complaintId)
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingVote) {
      await client.from("complaint_upvotes").delete().eq("id", existingVote.id);
      return { action: "removed" };
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: limitError } = await client
      .from("complaint_upvotes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneDayAgo);

    if (!limitError && count >= 10) {
      throw new Error("Daily limit reached: You can only upvote 10 complaints per day.");
    }

    await client.from("complaint_upvotes").insert({ complaint_id: complaintId, user_id: userId });

    const { data: complaint } = await client.from("complaints").select("upvote_count").eq("id", complaintId).single();
    const newCount = (complaint?.upvote_count || 0) + 1;
    await client.from("complaints").update({ upvote_count: newCount }).eq("id", complaintId);

    return { action: "added", newCount };
  }

  async getPotentialDuplicatesForId(complaintId) {
    return await this.complaintRepo.findDuplicatesForId(complaintId);
  }

  async bulkMergeComplaints(masterId, childIds) {
    const client = this.complaintRepo.supabase;
    const { error } = await client.from("complaints").update({
      merged_into: masterId,
      workflow_status: "duplicate"
    }).in("id", childIds);

    if (error) throw error;
    return { success: true };
  }
}

module.exports = ComplaintVoteService;
