const ComplaintController = require("../../src/server/controllers/ComplaintController");
const ComplaintService = require("../../src/server/services/ComplaintService");

jest.mock("../../src/server/services/ComplaintService");

describe("ComplaintController Error Handling", () => {
  let controller;
  let mockReq;
  let mockRes;
  let mockService;

  beforeEach(() => {
    mockService = new ComplaintService();
    controller = new ComplaintController();
    controller.complaintService = mockService;

    mockReq = {
      params: {},
      body: {},
      user: { id: "user-123" }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe("markAsFalseComplaint", () => {


    it("should throw error if service throws (Centralized Error Handling)", async () => {
      mockReq.params.id = "comp-123";
      mockReq.body.reason = "Fake";

      const error = new Error("Database connection failed");
      mockService.markAsFalseComplaint.mockRejectedValue(error);

      // Since we removed try-catch, this should reject
      await expect(controller.markAsFalseComplaint(mockReq, mockRes))
        .rejects
        .toThrow("Database connection failed");
    });

    it("should return success if service succeeds", async () => {
      mockReq.params.id = "comp-123";
      mockReq.body.reason = "Fake";

      mockService.markAsFalseComplaint.mockResolvedValue({
        success: true,
        data: { id: "comp-123" }
      });

      await controller.markAsFalseComplaint(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: "comp-123" }
      });
    });
  });
});
