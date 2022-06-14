const request = require('supertest');
const { SMTPServer } = require('smtp-server');

const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const config = require('config');

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

const validUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword'
};

const postUser = (user = validUser) => {
  return request(app)
    .post('/api/1.0/users')
    .send(user);
};

describe('User Registration', () => {
  it('return 200 Ok when sign up request is valid', async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });

  it('return success message when signup request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe('User created');
  });

  it('save user to database', async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it('save username and email to database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];

    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
  });

  it('hashes the password in database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];

    expect(savedUser.password).not.toBe('P4ssword');
  });

  it('return 400 when username is null', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.status).toBe(400);
  });

  it('returns validationErrors field in response body when validation error occurs ', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    const { body } = response;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it('returns errors when both username and email is null ', async () => {
    const response = await postUser({
      username: null,
      email: null,
      password: 'P4ssword'
    });
    const { body } = response;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  // it('returns Username cannot be null when username is null ', async () => {
  //   const response = await postUser({
  //     username: null,
  //     email: 'user1@mail.com',
  //     password: 'P4ssword'
  //   });
  //   const { body } = response;
  //   expect(body.validationErrors.username).toBe('Username cannot be null');
  // });
  // it('returns Email cannot be null when mail is null ', async () => {
  //   const response = await postUser({
  //     username: 'user1',
  //     email: null,
  //     password: 'P4ssword'
  //   });
  //   const { body } = response;
  //   expect(body.validationErrors.email).toBe('Email cannot be null');
  // });
  // it('returns password cannot be null message when password is null ', async () => {
  //   const response = await postUser({
  //     username: 'user1',
  //     email: 'user1@mail.com',
  //     password: null
  //   });
  //   const { body } = response;
  //   expect(body.validationErrors.password).toBe('Password cannot be null');
  // });

  // it('returns size validation error when username is less than 4 characters', async () => {
  //   const response = await postUser({
  //     username: 'use',
  //     email: 'user1@mail.com',
  //     password: 'P4ssword'
  //   });
  //   const { body } = response;
  //   expect(body.validationErrors.username).toBe(
  //     'Username must have min 4 and max 32 characters'
  //   );
  // });

  it.each`
    field         | value              | expectedMessage
    ${'username'} | ${null}            | ${'Username cannot be null'}
    ${'username'} | ${'use'}           | ${'Username must have min 4 and max 32 characters'}
    ${'username'} | ${'a'.repeat(33)}  | ${'Username must have min 4 and max 32 characters'}
    ${'email'}    | ${null}            | ${'Email cannot be null'}
    ${'email'}    | ${'mail.com'}      | ${'Email is not valid'}
    ${'email'}    | ${'user.mail.com'} | ${'Email is not valid'}
    ${'email'}    | ${'user@mail'}     | ${'Email is not valid'}
    ${'password'} | ${null}            | ${'Password cannot be null'}
    ${'password'} | ${'P4ssw'}         | ${'Password must be at least 6 characters'}
    ${'password'} | ${'alllowercase'}  | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'ALLUPPERCASE'}  | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'1231241'}       | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'UPPER123124'}   | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'lower123124'}   | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
    ${'password'} | ${'lowerUpper'}    | ${'Password must have at least 1 lowercase 1 uppercase and 1 number'}
  `(
    'returns $expectedMessage when $field is $value',
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword'
      };
      user[field] = value;
      const response = await postUser(user);
      const { body } = response;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it('return Email in use when the same mail is already in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser();
    expect(response.body.validationErrors.email).toBe('Email in use');
  });
  it('return errors for both username is null and email is in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser({
      username: null,
      email: validUser.email,
      password: validUser.password
    });
    const { body } = response;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });
  it('creats user in inactive mode', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });
  it('creats user in inactive mode even if the request body contains inactive as false', async () => {
    const newUser = { ...validUser, inactive: false };
    await postUser(newUser);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });
  it('creates an activationToken for user', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });
  it('send an Account activation email with activationToken', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail).toContain('user1@mail.com');
    expect(lastMail).toContain(savedUser.activationToken);
  });
  it('returns 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.status).toBe(502);
  });
  it('returns Email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.body.message).toBe('Failed to deliver email');
  });
  it('does not save user to database when sending email fails', async () => {
    simulateSmtpFailure = true;
    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });
});

describe('Account activation', () => {
  it('activates the account when correct token is sent', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    users = await User.findAll();
    expect(users[0].inactive).toBe(false);
  });
  it('remove the token from user table after succesful activation', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    users = await User.findAll();
    expect(users[0].activationToken).toBeFalsy();
  });
  it('does not activate the account when the token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    const users = await User.findAll();
    expect(users[0].inactive).toBe(true);
  });
  it('return bad request when the token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    const response = await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    expect(response.status).toBe(400);
  });
  it('send message when account is either activate or the token is invalid', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    const response = await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    expect(response.body.message).toBe(
      'account is either activate or the token is invalid'
    );
  });
  it('send message when activation is successful', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    const response = await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    expect(response.body.message).toBe('account activativated successfuly');
  });

  it('return Validation Failure message in error response body when validation failed', async () => {
    const response = await postUser({
      username: 'use',
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    const { body } = response;
    expect(body.message).toBe('Validation Failure');
  });
});

describe('Error Model', () => {
  it('returns path, timestamp, message and validationErrors in response when validation failure', async () => {
    const response = await postUser({ ...validUser, username: null });
    const { body } = response;
    expect(Object.keys(body)).toEqual([
      'path',
      'timestamp',
      'message',
      'validationErrors'
    ]);
  });

  it('returns path, timestamp, message when request fail other than validation failure', async () => {
    const token = 'this-token-does-not-exist';
    const response = await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    const { body } = response;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message']);
  });

  it('returns path in error body', async () => {
    const token = 'this-token-does-not-exist';
    const response = await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    const { body } = response;
    expect(body.path).toBe(`/api/1.0/users/token/${token}`);
  });
  it('returns timestamp in milliseconds within 5 seconds value in error body', async () => {
    const nowInMillis = new Date().getTime();
    const fiveSecondLater = nowInMillis + 5 * 1000;
    const token = 'this-token-does-not-exist';
    const response = await request(app)
      .post(`/api/1.0/users/token/${token}`)
      .send();
    const { body } = response;
    expect(body.timestamp).toBeGreaterThan(nowInMillis);
    expect(body.timestamp).toBeLessThan(fiveSecondLater);
  });
});
