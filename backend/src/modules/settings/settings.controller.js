const settingsService = require('../../services/settings.service');
const { ApiResponse } = require('../../utils/api-response');

const getPublicSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getPublicSettings();
    res.json(ApiResponse.success('Platform settings', settings));
  } catch (error) {
    next(error);
  }
};

const getAllSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getAllSettings();
    res.json(ApiResponse.success('All platform settings', settings));
  } catch (error) {
    next(error);
  }
};

const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const setting = await settingsService.setSetting(key, value, req.user.id);
    res.json(ApiResponse.success('Setting updated', setting));
  } catch (error) {
    next(error);
  }
};

module.exports = { getPublicSettings, getAllSettings, updateSetting };
