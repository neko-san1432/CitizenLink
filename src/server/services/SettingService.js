const SettingRepository = require('../repositories/SettingRepository');
const Setting = require('../models/Setting');

class SettingService {
  constructor() {
    this.settingRepo = new SettingRepository();
  }

  async getAllSettings() {
    return this.settingRepo.findAll();
  }

  async getPublicSettings() {
    return this.settingRepo.findPublic();
  }

  async getSettingsByCategory(category) {
    return this.settingRepo.findByCategory(category);
  }

  async getSettingByKey(key) {
    const setting = await this.settingRepo.findByKey(key);
    if (!setting) {
      throw new Error('Setting not found');
    }
    return setting;
  }

  async getSettingValue(key, defaultValue = null) {
    try {
      const setting = await this.settingRepo.findByKey(key);
      return setting ? setting.getParsedValue() : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async createSetting(settingData) {
    const validation = Setting.validate(settingData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const existingSetting = await this.settingRepo.findByKey(settingData.key);
    if (existingSetting) {
      throw new Error('Setting key already exists');
    }

    const sanitizedData = {
      key: settingData.key.trim().toLowerCase(),
      value: settingData.value,
      type: settingData.type || 'text',
      category: settingData.category || 'general',
      description: settingData.description?.trim() || null,
      is_public: settingData.is_public !== undefined ? settingData.is_public : false
    };

    return this.settingRepo.create(sanitizedData);
  }

  async updateSetting(key, settingData) {
    const existingSetting = await this.getSettingByKey(key);

    const validation = Setting.validate({
      ...existingSetting,
      ...settingData
    });

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedData = {
      value: settingData.value,
      type: settingData.type || existingSetting.type,
      category: settingData.category || existingSetting.category,
      description: settingData.description !== undefined ? settingData.description?.trim() : existingSetting.description,
      is_public: settingData.is_public !== undefined ? settingData.is_public : existingSetting.is_public
    };

    return this.settingRepo.update(key, sanitizedData);
  }

  async upsertSetting(settingData) {
    const validation = Setting.validate(settingData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedData = {
      key: settingData.key.trim().toLowerCase(),
      value: settingData.value,
      type: settingData.type || 'text',
      category: settingData.category || 'general',
      description: settingData.description?.trim() || null,
      is_public: settingData.is_public !== undefined ? settingData.is_public : false
    };

    return this.settingRepo.upsert(sanitizedData);
  }

  async deleteSetting(key) {
    await this.getSettingByKey(key);
    return this.settingRepo.delete(key);
  }

  async initializeDefaultSettings() {
    const defaultSettings = [
      {
        key: 'terms_and_conditions',
        value: `<h2>Terms and Conditions</h2>
        <p>By using CitizenLink, you agree to the following terms:</p>
        <ul>
          <li>Provide accurate information when filing complaints</li>
          <li>Use the platform responsibly and lawfully</li>
          <li>Respect other users and government officials</li>
          <li>Do not submit false or malicious reports</li>
        </ul>
        <p>These terms may be updated periodically. Continued use constitutes acceptance of changes.</p>`,
        type: 'html',
        category: 'legal',
        description: 'Platform terms and conditions',
        is_public: true
      },
      {
        key: 'privacy_policy',
        value: `<h2>Privacy Policy</h2>
        <p>We are committed to protecting your privacy:</p>
        <ul>
          <li>Personal information is collected only for complaint processing</li>
          <li>Data is shared only with relevant government departments</li>
          <li>We use secure encryption for data protection</li>
          <li>You may request data deletion subject to legal requirements</li>
        </ul>
        <p>Contact us for privacy-related concerns or data requests.</p>`,
        type: 'html',
        category: 'legal',
        description: 'Platform privacy policy',
        is_public: true
      },
      {
        key: 'complaint_disclaimer',
        value: 'Filing a complaint does not guarantee immediate resolution. Response times may vary based on complexity and department workload. Emergency situations should be reported directly to appropriate authorities.',
        type: 'text',
        category: 'complaints',
        description: 'Disclaimer shown during complaint submission',
        is_public: true
      }
    ];

    const results = [];
    for (const setting of defaultSettings) {
      try {
        const result = await this.upsertSetting(setting);
        results.push(result);
      } catch (error) {
        console.warn(`Failed to initialize setting ${setting.key}:`, error.message);
      }
    }
    return results;
  }
}

module.exports = SettingService;

