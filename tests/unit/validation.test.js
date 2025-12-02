const Joi = require('joi');
const { validate, schemas } = require('../../src/server/middleware/validation');

describe('Validation Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('validate() function', () => {
    const testSchema = Joi.object({
      name: Joi.string().required(),
      age: Joi.number().min(18)
    });

    it('should call next() if validation passes', () => {
      mockReq.body = { name: 'John', age: 25 };
      const middleware = validate(testSchema);
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 400 if validation fails', () => {
      mockReq.body = { name: 'John', age: 10 }; // Age < 18
      const middleware = validate(testSchema);
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('age')
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should strip unknown fields', () => {
      mockReq.body = { name: 'John', age: 25, extra: 'field' };
      const middleware = validate(testSchema);
      middleware(mockReq, mockRes, mockNext);
      expect(mockReq.body).not.toHaveProperty('extra');
      expect(mockReq.body).toHaveProperty('name', 'John');
    });
  });

  describe('Schemas', () => {
    describe('createComplaint', () => {
      it('should validate valid complaint', () => {
        const data = {
          title: 'Valid Complaint',
          description: 'This is a valid description of the issue.',
          type: 'Infrastructure',
          preferred_departments: ['Engineering']
        };
        const { error } = schemas.createComplaint.validate(data);
        expect(error).toBeUndefined();
      });

      it('should fail if title is missing', () => {
        const data = {
          description: 'Description only',
          type: 'Infrastructure'
        };
        const { error } = schemas.createComplaint.validate(data);
        expect(error).toBeDefined();
      });
    });

    describe('updateStatus', () => {
      it('should validate valid status', () => {
        const { error } = schemas.updateStatus.validate({ status: 'in_progress' });
        expect(error).toBeUndefined();
      });

      it('should fail for invalid status', () => {
        const { error } = schemas.updateStatus.validate({ status: 'invalid_status' });
        expect(error).toBeDefined();
      });
    });

    describe('markAsFalse', () => {
      it('should fail if reason is missing', () => {
        const { error } = schemas.markAsFalse.validate({});
        expect(error).toBeDefined();
      });

      it('should fail if reason is too short', () => {
        const { error } = schemas.markAsFalse.validate({ reason: 'Bad' });
        expect(error).toBeDefined();
      });
    });
  });
});
