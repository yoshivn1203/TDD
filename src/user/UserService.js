const bcrypt = require('bcrypt');
const crypto = require('crypto');
const EmailService = require('../email/EmailService');
const sequelize = require('../config/database');
const EmailException = require('../email/EmailException');

const User = require('./User');

const generateToken = length => {
  return crypto
    .randomBytes(length)
    .toString('hex')
    .substring(0, length);
};
const save = async body => {
  const { username, email, password } = body;
  const hashedPass = await bcrypt.hash(password, 10);
  const user = {
    username: username,
    email: email,
    password: hashedPass,
    activationToken: generateToken(16)
  };
  // const user = Object.assign({}, req.body, { password: hash });
  // const user = {
  //   username: req.body.username,
  //   email: req.body.email,
  //   password: hash
  // };
  const transaction = await sequelize.transaction();
  await User.create(user, { transaction: transaction });
  try {
    await EmailService.sendAccountActivation(user);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw new EmailException();
  }
};

const findByEmail = async email => {
  return await User.findOne({ where: { email: email } });
};

module.exports = { save, findByEmail };
