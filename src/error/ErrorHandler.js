module.exports = (err, req, res, next) => {
  let { status, message, errors } = err;
  let validationErrors;
  if (errors) {
    validationErrors = {};
    errors
      .array()
      .forEach(error => (validationErrors[error.param] = error.msg));
  }

  res.status(status).send({
    path: req.originalUrl,
    timestamp: new Date().getTime(),
    message: message,
    validationErrors: validationErrors
  });
};
