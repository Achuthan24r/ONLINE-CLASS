const { v4: uuidv4 } = require('uuid');

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

function errorHandler(err, req, res, _next) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected error occurred.';

  // Structured server log without exposing internal stack traces to client
  console.error(`[Error] [${requestId}] ${req.method} ${req.originalUrl} - ${statusCode} ${errorCode}: ${message}`);
  if (statusCode === 500 && process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: statusCode === 500 && process.env.NODE_ENV === 'production' 
        ? 'Internal server error occurred.' 
        : message,
      requestId,
      ...(err.details && process.env.NODE_ENV !== 'production' ? { details: err.details } : {})
    },
  });
}

module.exports = {
  AppError,
  errorHandler,
};
