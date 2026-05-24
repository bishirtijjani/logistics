const contactService = require('./contact.service');
const { ApiResponse } = require('../../utils/api-response');

const submitContactMessage = async (req, res, next) => {
  try {
    await contactService.submitContactMessage(req.body);
    res.status(201).json(
      ApiResponse.success(
        "Thanks — we got your message and a human will get back to you within one business day.",
        null,
      ),
    );
  } catch (err) {
    next(err);
  }
};

module.exports = { submitContactMessage };
