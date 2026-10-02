// Turns any thrown error into a consistent, human-readable JSON response.
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong. Please try again.';
  let errors = err.errors && Array.isArray(err.errors) ? err.errors : undefined;

  if (err.name === 'ValidationError') {
    status = 422;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = errors[0]?.message || 'Please check the form.';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID or value provided.';
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    const labels = { email: 'email', phone: 'mobile number', slug: 'category' };
    message = field === 'productId'
      ? 'You have already reviewed this product.'
      : `An account with this ${labels[field] || field} already exists.`;
    errors = [{ field, message }];
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid request data.';
  }

  if (status >= 500) {
    console.error('[error]', err);
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong. Please try again.';
  }

  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) });
};
