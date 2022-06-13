const request = require('supertest');
const app = require('../src/app');

const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
});

const activeUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
  inactive: false
};

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return await User.create(user);
};

const postPasswordReset = (email = 'user1@mail.com', options = {}) => {
  const agent = request(app).post('/api/1.0/password-reset');
  return agent.send({ email: email });
};

describe('Password Reset Request', () => {
  it('return 404 when password reset is sent for unknown email', async () => {
    const response = await postPasswordReset();
    expect(response.status).toBe(404);
  });

  it('return proper error body for unauthorized request', async () => {
    const nowInMillis = new Date().getTime();
    const response = await postPasswordReset();
    const error = response.body;
    expect(error.path).toBe('/api/1.0/password-reset');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe('not found');
  });
  it('return 400 with validation error response when email is invalid', async () => {
    const response = await postPasswordReset(null);

    expect(response.body.validationErrors.email).toBe('Email is not valid');
    expect(response.status).toBe(400);
  });

  it('return 200 OK when password reset is sent for known email', async () => {
    const user = await addUser();
    const response = await postPasswordReset(user.email);

    expect(response.status).toBe(200);
  });
  it('return success response body when password reset is sent for known email', async () => {
    const user = await addUser();
    const response = await postPasswordReset(user.email);

    expect(response.body.message).toBe(
      'Check your e-mail for resetting your password'
    );
  });
  it('return PasswordResetToken when password reset is sent for known email', async () => {
    const user = await addUser();
    await postPasswordReset(user.email);
    const userInDb = await User.findOne({ where: { email: user.email } });

    expect(userInDb.passwordResetToken).toBeTruthy();
  });
});
