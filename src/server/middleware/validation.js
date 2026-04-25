const Joi = require("joi");

/**
 * Middleware factory for Joi validation
 * @param {Object} schema - Joi schema to validate against
 * @param {string} property - Request property to validate (body, query, params)
 */
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errorDetails = error.details
        .map((detail) => detail.message)
        .join(", ");
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${errorDetails}`,
      });
    }

    // Replace request data with validated (and stripped) data
    req[property] = value;
    next();
  };
};

// Common schemas
const idSchema = Joi.string()
  .guid({ version: ["uuidv4"] })
  .required();
const reasonSchema = Joi.string().trim().min(5).max(500).required();

const schemas = {
  // complaint Creation
  createcomplaint: Joi.object({
    title: Joi.string().trim().min(5).max(100).required(),
    description: Joi.string().trim().min(10).max(2000).required(),
    // type: Joi.string().trim().required(), // REMOVED: Obsolete
    category: Joi.string().trim().required(),
    subcategory: Joi.string().trim().required(),
    preferred_departments: Joi.alternatives()
      .try(Joi.array().items(Joi.string()), Joi.string())
      .optional(),
    location: Joi.string().allow("", null).optional(),
    latitude: Joi.number().min(-90).max(90).allow(null).optional(),
    longitude: Joi.number().min(-180).max(180).allow(null).optional(),
    urgency_level: Joi.string()
      .valid("low", "medium", "high", "urgent")
      .default("low"),
    is_anonymous: Joi.boolean().default(false),
  }),

  // Status Update
  updateStatus: Joi.object({
    status: Joi.string()
      .valid(
        "new",
        "pending",
        "submitted",
        "verified",
        "assigned",
        "under_review",
        "in_progress",
        "action_taken",
        "completed",
        "resolved",
        "closed",
        "cancelled",
        "rejected"
      )
      .optional(),
    priority: Joi.string().valid("low", "medium", "high", "urgent").optional(),
    category: Joi.string().trim().optional(),
    subcategory: Joi.string().trim().optional(),
    notes: Joi.string().trim().allow("", null).optional(),
  }).min(1),

  // Mark as False
  markAsFalse: Joi.object({
    reason: Joi.string().trim().min(2).max(500).required(),
    notes: Joi.string().trim().allow("", null).optional(),
  }),

  // Mark as Duplicate
  markAsDuplicate: Joi.object({
    master_complaint_id: idSchema,
  }),

  // Cancel complaint
  cancelcomplaint: Joi.object({
    reason: reasonSchema,
  }),

  // Add Evidence (Metadata only, files handled by multer)
  addEvidence: Joi.object({
    // Files are in req.files, this validates body if any
  }),

  // Confirm Resolution
  confirmResolution: Joi.object({
    confirmed: Joi.boolean().required(),
    feedback: Joi.string().trim().max(1000).allow("", null).optional(),
  }),

  // Transfer complaint
  transfercomplaint: Joi.object({
    to_dept: Joi.string().required(),
    reason: reasonSchema,
  }),

  // Assign Coordinator
  assignCoordinator: Joi.object({
    coordinator_id: idSchema,
  }),

  // Send Reminder
  sendReminder: Joi.object({
    // No body required
  }),

  // Params validation (e.g. for /:id)
  paramsId: Joi.object({
    id: idSchema,
  }),

  // SEC-19: Super Admin schemas
  roleSwap: Joi.object({
    user_id: idSchema,
    new_role: Joi.string().valid("citizen", "lgu", "super-admin").required(),
    reason: reasonSchema,
  }),

  banUser: Joi.object({
    user_id: idSchema,
    type: Joi.string().valid("temporary", "permanent").default("permanent"),
    duration: Joi.number().integer().min(1).max(365).optional(),
    reason: reasonSchema,
  }),

  unbanUser: Joi.object({
    user_id: idSchema,
  }),

  transferdepartment: Joi.object({
    user_id: idSchema,
    from_department: Joi.string().trim().required(),
    to_department: Joi.string().trim().required(),
    reason: reasonSchema,
  }),

  assignCitizen: Joi.object({
    user_id: idSchema,
    role: Joi.string().valid("citizen", "lgu", "super-admin").required(),
    department_id: Joi.string().trim().allow("", null).optional(),
    reason: reasonSchema,
  }),
};

module.exports = {
  validate,
  schemas,
};
