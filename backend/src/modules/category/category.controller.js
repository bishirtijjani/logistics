const categoryService = require('./category.service');
const { ApiResponse } = require('../../utils/api-response');

const list = async (_req, res, next) => {
  try {
    const categories = await categoryService.listCategories({ activeOnly: true });
    res.json(ApiResponse.success('Categories retrieved', categories));
  } catch (error) {
    next(error);
  }
};

module.exports = { list };
