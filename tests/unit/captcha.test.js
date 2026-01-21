describe("Captcha Routes", () => {
  let mockReq;
  let mockRes;
  let mockRouter;
  let routes;

  beforeEach(() => {
    jest.resetModules();

    // Setup mocks
    mockReq = {
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Capture handlers
    routes = {};
    mockRouter = {
      get: jest.fn((path, handler) => { routes[`GET ${path}`] = handler; }),
      post: jest.fn((path, handler) => { routes[`POST ${path}`] = handler; })
    };

    jest.doMock("express", () => ({
      Router: () => mockRouter
    }));

    // Default config mock
    jest.doMock("../../config/app", () => ({
      captcha: {
        siteKey: "mock-site-key",
        secretKey: "mock-secret-key"
      },
      isDevelopment: false
    }));
  });

  function loadRoutes() {
    return require("../../src/server/routes/captchaRoutes");
  }

  describe("GET /key", () => {
    it("should return site key when configured", () => {
      loadRoutes();
      const handler = routes["GET /key"];
      expect(handler).toBeDefined();

      handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        key: "mock-site-key"
      });
    });

    it("should return error when site key is missing", () => {
      jest.doMock("../../config/app", () => ({
        captcha: {}
      }));

      loadRoutes();
      const handler = routes["GET /key"];

      handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: "CAPTCHA not configured"
      }));
    });
  });

  describe("GET /oauth-key", () => {
    it("should return site key when configured", () => {
      loadRoutes();
      const handler = routes["GET /oauth-key"];

      handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        key: "mock-site-key"
      });
    });
  });

  describe("POST /verify", () => {
    it("should return error if token is missing", async () => {
      loadRoutes();
      const handler = routes["POST /verify"];
      mockReq.body = {};

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "CAPTCHA token is required"
      });
    });

    it("should return success in development mode", async () => {
      jest.doMock("../../config/app", () => ({
        isDevelopment: true,
        captcha: { siteKey: "k" }
      }));

      loadRoutes();
      const handler = routes["POST /verify"];
      mockReq.body = { token: "some-token" };

      await handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "CAPTCHA verification successful (development mode)"
      });
    });

    it("should return success with mock verification in production (current implementation)", async () => {
      // Logic: isDevelopment defaults to false in beforeEach

      loadRoutes();
      const handler = routes["POST /verify"];
      mockReq.body = { token: "valid-token" };

      await handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "CAPTCHA verification successful"
      });
    });
  });
});
