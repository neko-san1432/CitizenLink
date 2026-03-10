const ComplaintController = require("../../src/server/controllers/complaintController");
const ComplaintService = require("../../src/server/services/complaintService");

jest.mock("../../src/server/services/complaintService");

describe("complaintController Error Handling", () => {
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

  describe("markAsFalsecomplaint", () => {


    it("should throw error if service throws (Centralized Error Handling)", async () => {
      mockReq.params.id = "comp-123";
      mockReq.body.reason = "Fake";

      const error = new Error("Database connection failed");
      mockService.markAsFalsecomplaint.mockRejectedValue(error);

      // Since we removed try-catch, this should reject
      await expect(controller.markAsFalsecomplaint(mockReq, mockRes))
        .rejects
        .toThrow("Database connection failed");
    });

    it("should return success if service succeeds", async () => {
      mockReq.params.id = "comp-123";
      mockReq.body.reason = "Fake";

      mockService.markAsFalsecomplaint.mockResolvedValue({
        success: true,
        data: { id: "comp-123" }
      });

      await controller.markAsFalsecomplaint(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: "comp-123" }
      });
    });
  });
});
