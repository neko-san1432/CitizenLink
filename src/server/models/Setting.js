class Setting {
  constructor(data = {}) {
    this.id = data.id;
    this.key = data.key;
    this.value = data.value;
    this.type = data.type || 'text';
    this.category = data.category || 'general';
    this.description = data.description;
    this.is_public = data.is_public !== undefined ? data.is_public : false;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static validate(data) {
    const errors = [];

    if (!data.key || data.key.trim().length < 2) {
      errors.push('Setting key must be at least 2 characters');
    }

    if (data.key && !/^[a-z0-9_]+$/.test(data.key.trim())) {
      errors.push('Setting key must contain only lowercase letters, numbers, and underscores');
    }

    if (!data.value && data.value !== '') {
      errors.push('Setting value is required');
    }

    const validTypes = ['text', 'textarea', 'html', 'boolean', 'number', 'json'];
    if (data.type && !validTypes.includes(data.type)) {
      errors.push('Invalid setting type');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getParsedValue() {
    switch (this.type) {
    case 'boolean':
      return this.value === 'true' || this.value === true;
    case 'number':
      return parseFloat(this.value);
    case 'json':
      try {
        return JSON.parse(this.value);
      } catch {
        return this.value;
      }
    default:
      return this.value;
    }
  }

  toJSON() {
    return {
      id: this.id,
      key: this.key,
      value: this.value,
      parsed_value: this.getParsedValue(),
      type: this.type,
      category: this.category,
      description: this.description,
      is_public: this.is_public,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Setting;
