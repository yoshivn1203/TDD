const request = require('supertest');
const app = require('../src/app');

const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');
const { SMTPServer } = require('smtp-server');
const config = require('config');
const Token = require('../src/auth/Token');

let lastMail, server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;
      stream.on('data', data => {
        mailBody += data.toString();
      });
      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const err = new Error('Invalid mailbox');
          err.responseCode = 533;
          return callback(err);
        }
        lastMail = mailBody;
        callback();
      });
    }
  });
  await server.listen(config.mail.port, 'localhost');

  await sequelize.sync();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  simulateSmtpFailure = false;
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
  const agent = request(app).post('/api/1.0/user/password');
  return agent.send({ email: email });
};

const putPasswordUpdate = (body = {}, options = {}) => {
  const agent = request(app).put('/api/1.0/user/password');

  return agent.send(body);
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
    expect(error.path).toBe('/api/1.0/user/password');
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
  it('send password reset email with passwordResetToken', async () => {
    const user = await addUser();
    await postPasswordReset(user.email);
    const userInDb = await User.findOne({ where: { email: user.email } });
    const { passwordResetToken } = userInDb;

    expect(lastMail).toContain('user1@mail.com');
    expect(lastMail).toContain(passwordResetToken);
  });
  it('return 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const user = await addUser();
    const response = await postPasswordReset(user.email);

    expect(response.status).toBe(502);
  });

  it('return failure message in response body after email failure', async () => {
    simulateSmtpFailure = true;
    const user = await addUser();
    const response = await postPasswordReset(user.email);

    expect(response.body.message).toBe('Failed to deliver email');
  });
});

describe('Password Update', () => {
  it('return 403 when password update request does not have the valid password reset Token', async () => {
    const response = await putPasswordUpdate({
      password: 'P4ssword',
      passwordResetToken: 'abcd'
    });
    expect(response.status).toBe(403);
  });
  it('return eror body with message when trying to update with invalid password reset Token', async () => {
    const nowInMillis = new Date().getTime();
    const response = await putPasswordUpdate({
      password: 'P4ssword',
      passwordResetToken: 'abcd'
    });
    expect(response.status).toBe(403);

    const error = response.body;
    expect(error.path).toBe('/api/1.0/user/password');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe(
      'You are not authorized to update your password, Please follow the password reset step again'
    );
  });
  it('return 403 when password update request with invalid password pattern and invalid password reset Token', async () => {
    const response = await putPasswordUpdate({
      password: 'not-valid',
      passwordResetToken: 'abcd'
    });
    expect(response.status).toBe(403);
  });
  it('return 400 when password update request with invalid password pattern and valid password reset Token', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    const response = await putPasswordUpdate({
      password: 'not-valid',
      passwordResetToken: 'test-token'
    });
    expect(response.status).toBe(400);
  });

  it.each`
    field         | value             | expectedMessage
    ${'password'} | ${null}           | ${'Password cannot be null'}
    ${'password'} | ${'P4ssw'}        | ${'Password must be at least 6 characters'}
    ${'password'} | ${'alllowercase'} | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'ALLUPPERCASE'} | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'1231241'}      | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'UPPER123124'}  | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'lower123124'}  | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'lowerUpper'}   | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
  `(
    'returns $expectedMessage when $field is $value',
    async ({ expectedMessage, value }) => {
      const user = await addUser();
      user.passwordResetToken = 'test-token';
      await user.save();
      const response = await putPasswordUpdate({
        password: value,
        passwordResetToken: 'test-token'
      });

      expect(response.body.validationErrors.password).toBe(expectedMessage);
    }
  );

  it('return 200 when valid password update request with valid password reset Token', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    const response = await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });
    expect(response.status).toBe(200);
  });

  it('update the password in database when the request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });
    const userInDB = await User.findOne({ where: { email: 'user1@mail.com' } });
    expect(userInDB.password).not.toEqual(user.password);
  });
  it('clear the reset token in database in the request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });
    const userInDB = await User.findOne({ where: { email: 'user1@mail.com' } });
    expect(userInDB.passwordResetToken).toBeFalsy();
  });
  it('activate and clear activation token if the account is inactive after valid password reset', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    user.activationToken = 'activation-token';
    user.inactive = true;
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });
    const userInDB = await User.findOne({ where: { email: 'user1@mail.com' } });
    expect(userInDB.activationToken).toBeFalsy();
    expect(userInDB.inactive).toBe(false);
  });
  it('clear all tokens of user after valid password reset', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await Token.create({
      token: 'token1',
      userId: user.id,
      lastUsedAt: Date.now()
    });
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });
    const tokens = await Token.findAll({ where: { userId: user.id } });
    expect(tokens.length).toBe(0);
  });
});
