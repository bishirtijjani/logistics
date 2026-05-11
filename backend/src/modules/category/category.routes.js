/**
 * Public category routes — /api/categories
 * No auth required: every client (customer, merchant signup, public listings)
 * needs to read the active categories list.
 */

const { Router } = require('express');
const categoryController = require('./category.controller');

const router = Router();

router.get('/', categoryController.list);

module.exports = router;
