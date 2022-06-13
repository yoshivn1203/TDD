module.exports = function NotFoundException() {
  (this.status = 404), (this.message = 'not found');
};
