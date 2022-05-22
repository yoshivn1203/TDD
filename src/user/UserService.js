const bcrypt = require('bcrypt');
const User = require('./User');

exports.save = async body => {
  const hashedPass = await bcrypt.hash(body.password, 10);
  const user = { ...body, password: hashedPass };
  // const user = Object.assign({}, req.body, { password: hash });
  // const user = {
  //   username: req.body.username,
  //   email: req.body.email,
  //   password: hash
  // };
  await User.create(user);
};

// module.exports = { save };
