const { NOTIFICATION_TYPES, _NOTIFICATION_PRIORITY } = require("../../src/shared/constants");

describe("Notification System", () => {
  let NotificationService;
  let NotificationController;
  let notificationService;
  let notificationController;
  let mockSupabase;
  let mockDatabase;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.resetModules();

    mockSupabase = {
      from: jest.fn(),
      rpc: jest.fn(),
      channel: jest.fn(),
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      eq: jest.fn(),
      gte: jest.fn(),
      lt: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
      range: jest.fn(),
      single: jest.fn(),
      // Make the mock thenable to simulate Supabase Promise-like builder
      then: jest.fn((resolve, _reject) => resolve({ data: [], error: null }))
    };

    // Setup common mock chain return values
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.delete.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.gte.mockReturnThis();
    mockSupabase.lt.mockReturnThis();
    mockSupabase.order.mockReturnThis();
    mockSupabase.limit.mockReturnThis();
    mockSupabase.range.mockReturnThis();
    mockSupabase.single.mockReturnThis(); // single() usually returns Promise, but we can override per test

    // Mock channel/subscription for SSE
    const mockSubscription = { unsubscribe: jest.fn() };
    const mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue(mockSubscription)
    };
    mockSupabase.channel.mockReturnValue(mockChannel);

    mockDatabase = {
      getClient: jest.fn().mockReturnValue(mockSupabase),
      getInstance: jest.fn().mockReturnThis()
    };

    jest.doMock("../../src/server/config/database", () => ({
      getInstance: () => mockDatabase,
      getClient: () => mockSupabase
    }));

    NotificationService = require("../../src/server/services/NotificationService");
    NotificationController = require("../../src/server/controllers/NotificationController");

    notificationService = new NotificationService();
    notificationController = new NotificationController();

    mockReq = {
      user: { id: "user-123" },
      query: {},
      params: {},
      on: jest.fn()
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      destroyed: false
    };
  });

  describe("NotificationService", () => {
    describe("createNotification", () => {
      it("should create a notification successfully", async () => {
        const mockData = { id: "notif-1", title: "Test" };
        mockSupabase.single.mockResolvedValue({ data: mockData, error: null });
        // Mock duplicate check to return false
        // select() returns this, so we mock .then() to return empty data
        mockSupabase.then.mockImplementationOnce((resolve) => resolve({ data: [], error: null }));

        const result = await notificationService.createNotification(
          "user-123",
          NOTIFICATION_TYPES.INFO,
          "Test Title",
          "Test Message"
        );

        expect(result.success).toBe(true);
        expect(result.notification).toEqual(mockData);
        expect(mockSupabase.from).toHaveBeenCalledWith("notification");
        expect(mockSupabase.insert).toHaveBeenCalled();
      });

      it("should handle duplicates when deduplication is enabled", async () => {
        const existingNotif = { id: "existing-1", title: "Test" };
        // Mock duplicate check to return existing notification
        // The first await is checkDuplicateNotification which calls select...limit(1)
        // limit(1) returns this, so we mock then()
        mockSupabase.then.mockImplementationOnce((resolve) => resolve({ data: [existingNotif], error: null }));

        const result = await notificationService.createNotification(
          "user-123",
          NOTIFICATION_TYPES.INFO,
          "Test Title",
          "Test Message",
          { deduplicate: true }
        );

        expect(result.success).toBe(true);
        expect(result.duplicate).toBe(true);
        expect(result.notification).toEqual(existingNotif);
        expect(mockSupabase.insert).not.toHaveBeenCalled();
      });
    });

    describe("getUserNotifications", () => {
      it("should return paginated notifications", async () => {
        const mockData = [{ id: 1 }, { id: 2 }];
        // range() returns this, so we mock then()
        // But wait, range() is usually terminal in Supabase js?
        // Actually range() returns the builder.
        // So we mock then()
        mockSupabase.then.mockImplementation((resolve) => resolve({ data: mockData, error: null, count: 10 }));

        const result = await notificationService.getUserNotifications("user-123", 0, 10);

        expect(result.success).toBe(true);
        expect(result.data.notifications).toEqual(mockData);
        expect(result.data.total).toBe(10);
      });
    });

    describe("markAsRead", () => {
      it("should mark notification as read", async () => {
        const mockData = { id: "notif-1", read: true };
        mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

        const result = await notificationService.markAsRead("notif-1", "user-123");

        expect(result.success).toBe(true);
        expect(result.notification).toEqual(mockData);
        expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ read: true }));
      });
    });
  });

  describe("NotificationController", () => {
    describe("getUnreadNotifications", () => {
      it("should return enriched notifications with links", async () => {
        const mockNotifs = [
          {
            id: "n1",
            type: "workflow_update",
            title: "Progress Update",
            metadata: { complaint_id: "c1" },
            created_at: new Date().toISOString()
          }
        ];
        // range() returns this, mock then()
        mockSupabase.then.mockImplementation((resolve) => resolve({ data: mockNotifs, error: null }));

        await notificationController.getUnreadNotifications(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          notifications: expect.arrayContaining([
            expect.objectContaining({
              link: "/complaint-details/c1"
            })
          ])
        }));
      });

      it("should handle errors gracefully", async () => {
        mockSupabase.then.mockImplementation((resolve) => resolve({ data: null, error: { message: "DB Error" } }));

        await notificationController.getUnreadNotifications(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false
        }));
      });
    });

    describe("markAllAsRead", () => {
      it("should mark all notifications as read", async () => {
        // update().eq().eq() returns this. mock then()
        mockSupabase.then.mockImplementation((resolve) => resolve({ data: [], error: null }));

        await notificationController.markAllAsRead(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: "All notifications marked as read"
        });
      });
    });

    describe("getNotificationStream", () => {
      it("should set up SSE headers and subscription", async () => {
        await notificationController.getNotificationStream(mockReq, mockRes);

        expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          "Content-Type": "text/event-stream",
          "Connection": "keep-alive"
        }));
        expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining("connected"));
        expect(mockSupabase.channel).toHaveBeenCalledWith("notifications");
      });
    });
  });
});
