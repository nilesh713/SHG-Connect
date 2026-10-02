const { validationResult } = require('express-validator');

// Runs after express-validator chains and returns a single readable 422 response
module.exports = function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg }));
  return res.status(422).json({ success: false, message: errors[0].message, errors });
};
