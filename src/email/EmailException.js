module.exports = function EmailException() {
  this.message = 'Failed to deliver email';
  this.status = 502;
};
