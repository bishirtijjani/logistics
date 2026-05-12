const { Router } = require('express');
const controller = require('./address.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { createAddressSchema, updateAddressSchema } = require('./address.validator');

const router = Router();
router.use(authenticate);

router.get('/', controller.list);
router.post('/', validate(createAddressSchema), controller.create);
router.patch('/:id', validate(updateAddressSchema), controller.update);
router.post('/:id/default', controller.setDefault);
router.delete('/:id', controller.remove);

module.exports = router;
