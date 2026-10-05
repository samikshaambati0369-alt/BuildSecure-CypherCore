export function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

export function errorHandler(err, req, res, next) {
  // Keep stack traces and database/provider details out of API responses.
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(err.status || 500).json({
    success: false,
    message: err.publicMessage || 'Internal server error'
  });
}
