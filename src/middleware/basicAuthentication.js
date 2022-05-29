const bcrypt = require('bcrypt');

const UserService = require('../user/UserService');

module.exports = async (req, res, next) => {
  const { authorization } = req.headers;
  if (authorization) {
    //authorization: Basic dXNlcjFAbWFpbC5jb206UDRzc3dvcmQ=
    const encoded = authorization.substring(6);
    const decoded = Buffer.from(encoded, 'base64').toString('ascii');
    // decoded : user1@mail.com:P4ssword
    const [email, password] = decoded.split(':'); // array destructuring
    const user = await UserService.findByEmail(email);

    if (user && !user.inactive) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        req.authenticatedUser = user;
      }
    }
  }
  next();
};
