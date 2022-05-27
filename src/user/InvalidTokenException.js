module.exports = function InvalidTokenException() {
  this.message = 'account is either activate or the token is invalid';
  this.status = 400;
};
