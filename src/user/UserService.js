const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Op } = require('sequelize');
const EmailService = require('../email/EmailService');
const sequelize = require('../config/database');
const EmailException = require('../email/EmailException');
const InvalidTokenException = require('../user/InvalidTokenException');
const UserNotFoundException = require('./UserNotFoundException');

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
    await EmailService.sendAccountActivation(email, user.activationToken);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw new EmailException();
  }
};

const findByEmail = async email => {
  return await User.findOne({ where: { email: email } });
};

const activate = async token => {
  const user = await User.findOne({ where: { activationToken: token } });
  if (!user) {
    throw new InvalidTokenException();
  }
  user.inactive = false;
  user.activationToken = null;
  await user.save();
};

const getUsers = async (page, size, authenticatedUser) => {
  const id = authenticatedUser ? authenticatedUser.id : 0;
  const usersWithCount = await User.findAndCountAll({
    where: {
      inactive: false,
      id: {
        [Op.not]: id
      }
    },
    attributes: ['id', 'username', 'email'],
    limit: size,
    offset: page * size
  });
  return {
    content: usersWithCount.rows,
    page: page,
    size: size,
    totalPages: Math.ceil(usersWithCount.count / size)
  };
};

const getUSer = async id => {
  const user = await User.findOne({
    where: { id: id, inactive: false },
    attributes: ['id', 'username', 'email']
  });
  if (!user) {
    throw new UserNotFoundException();
  }
  return user;
};

const updateUser = async (id, updatedBody) => {
  const user = await User.findOne({ where: { id: id } });
  user.username = updatedBody.username;
  await user.save();
};

module.exports = { save, findByEmail, activate, getUsers, getUSer, updateUser };
