class Department {

  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.code = data.code;
    this.description = data.description;
    this.is_active = data.is_active !== void 0 ? data.is_active : true;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }
  static validate(data) {
    const errors = [];
    if (!data.name || data.name.trim().length < 2) {
      errors.push("Department name must be at least 2 characters");
    }
    if (!data.code || data.code.trim().length < 2) {
      errors.push("Department code must be at least 2 characters");
    }
    if (data.code && !/^[A-Z0-9_]+$/.test(data.code.trim())) {
      errors.push("Department code must contain only uppercase letters, numbers, and underscores");
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      description: this.description,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Department;
