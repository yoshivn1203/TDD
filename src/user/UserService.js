const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const EmailService = require('../email/EmailService');
const sequelize = require('../config/database');
const EmailException = require('../email/EmailException');
const InvalidTokenException = require('../user/InvalidTokenException');
const NotFoundException = require('../error/NotFoundException');
const generator = require('../shared/generator');

const User = require('./User');
const Token = require('../auth/Token');

const save = async body => {
  const { username, email, password } = body;
  const hashedPass = await bcrypt.hash(password, 10);
  const user = {
    username: username,
    email: email,
    password: hashedPass,
    activationToken: generator.randomString(16)
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
    throw new NotFoundException();
  }
  return user;
};

const updateUser = async (id, updatedBody) => {
  const user = await User.findOne({ where: { id: id } });
  user.username = updatedBody.username;
  await user.save();
};
const deleteUser = async id => {
  await User.destroy({ where: { id: id } });
};

const passwordResetRequest = async email => {
  const user = await findByEmail(email);
  if (!user) {
    throw new NotFoundException();
  }
  user.passwordResetToken = generator.randomString(16);
  await user.save();
};
module.exports = {
  save,
  findByEmail,
  activate,
  getUsers,
  getUSer,
  updateUser,
  deleteUser,
  passwordResetRequest
};
