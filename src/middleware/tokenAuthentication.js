const TokenService = require('../auth/TokenService');

module.exports = async (req, res, next) => {
  const { authorization } = req.headers;
  if (authorization) {
    //authorization: Bearer dXNlcjFAbWFpbC5jb206UDRzc3dvcmQ=
    const token = authorization.substring(7);
    try {
      const user = await TokenService.verify(token);
      req.authenticatedUser = user;
      // eslint-disable-next-line no-empty
    } catch (err) {}
  }

  next();
};
