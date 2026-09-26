const { AppError } = require('./errorHandler');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return next(new AppError(`Validation error: ${issues}`, 400, 'VALIDATION_ERROR', result.error.format()));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = {
  validate,
};
