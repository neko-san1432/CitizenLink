const SettingService = require("../services/settingService");

class SettingController {

  constructor() {
    this.settingService = new SettingService();
  }
  async getAllsettings(req, res) {
    try {
      const settings = await this.settingService.getAllsettings();
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch settings"
      });
    }
  }
  async getPublicsettings(req, res) {
    try {
      const settings = await this.settingService.getPublicsettings();
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error("Error fetching public settings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch public settings"
      });
    }
  }
  async getsettingsByCategory(req, res) {
    try {
      const { category } = req.params;
      const settings = await this.settingService.getsettingsByCategory(category);
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error("Error fetching settings by category:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch settings"
      });
    }
  }
  async getsettingByKey(req, res) {
    try {
      const { key } = req.params;
      const setting = await this.settingService.getsettingByKey(key);
      res.json({
        success: true,
        data: setting
      });
    } catch (error) {
      console.error("Error fetching setting:", error);
      const status = error.message === "setting not found" ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async createsetting(req, res) {
    try {
      const setting = await this.settingService.createsetting(req.body);
      res.status(201).json({
        success: true,
        data: setting,
        message: "setting created successfully"
      });
    } catch (error) {
      console.error("Error creating setting:", error);
      const status = error.message.includes("Validation failed") ||
                     error.message.includes("already exists") ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async updatesetting(req, res) {
    try {
      const { key } = req.params;
      const setting = await this.settingService.updatesetting(key, req.body);
      res.json({
        success: true,
        data: setting,
        message: "setting updated successfully"
      });
    } catch (error) {
      console.error("Error updating setting:", error);
      const status = error.message === "setting not found" ? 404 :
        error.message.includes("Validation failed") ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async deletesetting(req, res) {
    try {
      const { key } = req.params;
      await this.settingService.deletesetting(key);
      res.json({
        success: true,
        message: "setting deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting setting:", error);
      const status = error.message === "setting not found" ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async initializeDefaults(req, res) {
    try {
      const settings = await this.settingService.initializeDefaultsettings();
      res.json({
        success: true,
        data: settings,
        message: "Default settings initialized successfully"
      });
    } catch (error) {
      console.error("Error initializing default settings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to initialize default settings"
      });
    }
  }
}

module.exports = SettingController;
