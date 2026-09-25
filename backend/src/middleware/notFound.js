// 404 handler for unknown API routes.
module.exports = function notFound(req, res) {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};
