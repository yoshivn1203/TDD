const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(() => {
  return sequelize.sync();
});
beforeEach(() => {
  return User.destroy({ truncate: true });
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
  it('returns Username cannot be null when username is null ', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    const { body } = response;
    expect(body.validationErrors.username).toBe('Username cannot be null');
  });
  it('returns Email cannot be null when mail is null ', async () => {
    const response = await postUser({
      username: 'user1',
      email: null,
      password: 'P4ssword'
    });
    const { body } = response;
    expect(body.validationErrors.email).toBe('Email cannot be null');
  });
  it('returns password cannot be null message when password is null ', async () => {
    const response = await postUser({
      username: 'user1',
      email: 'user1@mail.com',
      password: null
    });
    const { body } = response;
    expect(body.validationErrors.password).toBe('Password cannot be null');
  });

  it.each`
    field         | expectedMessage
    ${'username'} | ${'Username cannot be null'}
    ${'email'}    | ${'Email cannot be null'}
    ${'password'} | ${'Password cannot be null'}
  `(
    'returns $expectedMessage when $field is null',
    async ({ field, expectedMessage }) => {
      const user = {
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword'
      };
      user[field] = null;
      const response = await postUser(user);
      const { body } = response;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );
});
