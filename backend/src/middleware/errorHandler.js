// Centralized error-handling middleware (must be registered last).
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const response = {
    status: 'error',
    message: err.message || 'Internal server error',
  };
  if (env.nodeEnv === 'development' && err.stack) {
    response.stack = err.stack;
  }
  if (err.details) {
    response.details = err.details;
  }
  res.status(status).json(response);
};
