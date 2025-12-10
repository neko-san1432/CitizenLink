const express = require('express');
const config = require('../../config/app');

// Mock specific config values before requiring modules
jest.mock('../../config/app', () => ({
  captcha: {
    siteKey: 'mock-site-key',
    secretKey: 'mock-secret-key'
  },
  isDevelopment: false
}));

describe('Captcha Routes', () => {
  let router;
  let mockReq;
  let mockRes;
  let routes = {};

  // Mock Express Router
  const mockRouter = {
    get: jest.fn((path, handler) => {
      routes[`GET ${path}`] = handler;
    }),
    post: jest.fn((path, handler) => {
      routes[`POST ${path}`] = handler;
    })
  };

  jest.mock('express', () => ({
    Router: () => mockRouter
  }));

  // Re-require the routes file for each test
  beforeEach(() => {
    jest.clearAllMocks();
    routes = {};
    
    // We need to re-require to get a fresh router instance if we were testing module state,
    // but here we just need to ensure the module code runs and populates our mock router.
    // Jest module caching might prevent re-execution, so we rely on the implementation 
    // using the mocked express.Router()
    jest.isolateModules(() => {
        require('../../src/server/routes/captchaRoutes');
    });
    
    mockReq = {
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('GET /key', () => {
    it('should return site key when configured', () => {
      const handler = routes['GET /key'];
      expect(handler).toBeDefined();

      handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        key: 'mock-site-key'
      });
    });

    it('should return error when site key is missing', () => {
        jest.resetModules();
        jest.doMock('../../config/app', () => ({
            captcha: {}
        }));
        // Update the mockRouter in the express mock for this scope if needed, 
        // but easier to just test the logic if we could inject config. 
        // Since config is required at top level, we might need to rely on the initial mock 
        // or use jest.isolateModules again with a different mock.
        
        // Let's try isolating the module load with a different config mock
        let localRoutes = {};
        const localMockRouter = {
            get: jest.fn((path, handler) => { localRoutes[`GET ${path}`] = handler; }),
            post: jest.fn()
        };
        
        jest.isolateModules(() => {
             jest.doMock('express', () => ({ Router: () => localMockRouter }));
             jest.doMock('../../config/app', () => ({ captcha: {} }));
             require('../../src/server/routes/captchaRoutes');
        });

        const handler = localRoutes['GET /key'];
        handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: 'CAPTCHA not configured'
        }));
    });
  });

  describe('GET /oauth-key', () => {
    it('should return site key when configured', () => {
      const handler = routes['GET /oauth-key'];
      expect(handler).toBeDefined();

      handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        key: 'mock-site-key'
      });
    });
  });

  describe('POST /verify', () => {
    it('should return error if token is missing', async () => {
      const handler = routes['POST /verify'];
      mockReq.body = {};

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'CAPTCHA token is required'
      });
    });

    it('should return success in development mode', async () => {
       // Mock config locally for this test
       let localRoutes = {};
       const localMockRouter = {
           get: jest.fn(),
           post: jest.fn((path, handler) => { localRoutes[`POST ${path}`] = handler; })
       };
       
       jest.isolateModules(() => {
            jest.doMock('express', () => ({ Router: () => localMockRouter }));
            jest.doMock('../../config/app', () => ({ 
                isDevelopment: true,
                captcha: { siteKey: 'k' }
            }));
            require('../../src/server/routes/captchaRoutes');
       });

       const handler = localRoutes['POST /verify'];
       mockReq.body = { token: 'some-token' };
       
       await handler(mockReq, mockRes);

       expect(mockRes.json).toHaveBeenCalledWith({
         success: true,
         message: 'CAPTCHA verification successful (development mode)'
       });
    });

    it('should return success with mock verification in production (current implementation)', async () => {
         // This tests the current stub behavior in the code
        const handler = routes['POST /verify'];
        mockReq.body = { token: 'valid-token' };

        await handler(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
            success: true,
            message: 'CAPTCHA verification successful'
        });
    });
  });
});
