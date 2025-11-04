const SettingService = require('../services/SettingService');

class SettingController {

  constructor() {
    this.settingService = new SettingService();
  }
  async getAllSettings(req, res) {
    try {
      const settings = await this.settingService.getAllSettings();
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch settings'
      });
    }
  }
  async getPublicSettings(req, res) {
    try {
      const settings = await this.settingService.getPublicSettings();
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error fetching public settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch public settings'
      });
    }
  }
  async getSettingsByCategory(req, res) {
    try {
      const { category } = req.params;
      const settings = await this.settingService.getSettingsByCategory(category);
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error fetching settings by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch settings'
      });
    }
  }
  async getSettingByKey(req, res) {
    try {
      const { key } = req.params;
      const setting = await this.settingService.getSettingByKey(key);
      res.json({
        success: true,
        data: setting
      });
    } catch (error) {
      console.error('Error fetching setting:', error);
      const status = error.message === 'Setting not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async createSetting(req, res) {
    try {
      const setting = await this.settingService.createSetting(req.body);
      res.status(201).json({
        success: true,
        data: setting,
        message: 'Setting created successfully'
      });
    } catch (error) {
      console.error('Error creating setting:', error);
      const status = error.message.includes('Validation failed') ||
                     error.message.includes('already exists') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async updateSetting(req, res) {
    try {
      const { key } = req.params;
      const setting = await this.settingService.updateSetting(key, req.body);
      res.json({
        success: true,
        data: setting,
        message: 'Setting updated successfully'
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      const status = error.message === 'Setting not found' ? 404 :
        error.message.includes('Validation failed') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async deleteSetting(req, res) {
    try {
      const { key } = req.params;
      await this.settingService.deleteSetting(key);
      res.json({
        success: true,
        message: 'Setting deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting setting:', error);
      const status = error.message === 'Setting not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async initializeDefaults(req, res) {
    try {
      const settings = await this.settingService.initializeDefaultSettings();
      res.json({
        success: true,
        data: settings,
        message: 'Default settings initialized successfully'
      });
    } catch (error) {
      console.error('Error initializing default settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize default settings'
      });
    }
  }
}

module.exports = SettingController;
