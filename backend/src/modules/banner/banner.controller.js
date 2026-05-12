const bannerService = require('./banner.service');
const { ApiResponse } = require('../../utils/api-response');

const list = async (req, res, next) => {
  try {
    const data = await bannerService.listActiveForUser(req.user.id);
    res.json(ApiResponse.success('Banners retrieved', data));
  } catch (err) { next(err); }
};

module.exports = { list };
