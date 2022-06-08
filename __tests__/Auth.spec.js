const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const Token = require('../src/auth/Token');
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

const postAuthentication = async credentials => {
  return await request(app)
    .post('/api/1.0/auth')
    .send(credentials);
};

const postLogout = (options = {}) => {
  const agent = request(app).post('/api/1.0/logout');
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send();
};

describe('Authentication', () => {
  it('return 200 when credentials are correct', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.status).toBe(200);
  });

  it('return only user id, username and token when login success', async () => {
    const user = await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.body.id).toBe(user.id);
    expect(response.body.username).toBe(user.username);
    expect(Object.keys(response.body)).toEqual(['id', 'username', 'token']);
  });

  it('return 401 when user does not exist', async () => {
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.status).toBe(401);
  });
  it('return proper error body when authentication failed', async () => {
    const nowInMillis = new Date().getTime();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    const error = response.body;
    expect(error.path).toBe('/api/1.0/auth');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe('Incorrect credential');

    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it('return 401 when password is wrong', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'WrongP4ssword'
    });
    expect(response.status).toBe(401);
  });
  it('return 403 when logging in with an inactive account', async () => {
    await addUser({ ...activeUser, inactive: true });
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.status).toBe(403);
  });

  it('return proper error body when authentication failed', async () => {
    await addUser({ ...activeUser, inactive: true });
    const nowInMillis = new Date().getTime();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    const error = response.body;
    expect(error.path).toBe('/api/1.0/auth');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe('Account is inactive');

    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it('return 401 when email is not valid', async () => {
    const response = await postAuthentication({
      password: 'P4ssword'
    });
    expect(response.status).toBe(401);
  });
  it('return 401 when password is not valid', async () => {
    const response = await postAuthentication({
      email: 'user1@mail.com'
    });
    expect(response.status).toBe(401);
  });
  it('return token in response body when credentials are correct', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.body.token).not.toBeUndefined();
  });
});

describe('Logout', () => {
  it('return 200 when unauthorized request send for logout', async () => {
    const response = await postLogout();
    expect(response.status).toBe(200);
  });

  it('remove the token from the database', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    const { token } = response.body;
    await postLogout({ token: token });
    const storedToken = await Token.findOne({ where: { token: token } });
    expect(storedToken).toBeNull();
  });
});

describe('Token Expiration', () => {
  const putUser = async (id = 5, body = null, options = {}) => {
    const agent = request(app).put(`/api/1.0/users/${id}`);

    if (options.token) {
      agent.set('Authorization', `Bearer ${options.token}`);
    }
    return agent.send(body);
  };

  it('return 403 when token is older than 1 week', async () => {
    const savedUser = await addUser();

    const token = 'test-token';
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1);
    await Token.create({
      token: token,
      userId: savedUser.id,
      lastUsedAt: oneWeekAgo
    });
    const validUpdate = { username: 'user1-update' };
    const response = await putUser(savedUser.id, validUpdate, { token: token });
    expect(response.status).toBe(403);
  });

  it('refresh lastUsedAt when unexpired token is used', async () => {
    const savedUser = await addUser();

    const token = 'test-token';
    const fourDayAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    await Token.create({
      token: token,
      userId: savedUser.id,
      lastUsedAt: fourDayAgo
    });
    const validUpdate = { username: 'user1-update' };
    const rightBeforeSendingRequest = new Date();
    await putUser(savedUser.id, validUpdate, { token: token });
    const tokenInDB = await Token.findOne({ where: { token: token } });

    expect(tokenInDB.lastUsedAt.getTime()).toBeGreaterThan(
      rightBeforeSendingRequest.getTime()
    );
  });
  it('refresh lastUsedAt when unexpired token is used for authenticated endpoint', async () => {
    const savedUser = await addUser();

    const token = 'test-token';
    const fourDayAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    await Token.create({
      token: token,
      userId: savedUser.id,
      lastUsedAt: fourDayAgo
    });
    const rightBeforeSendingRequest = new Date();
    await request(app)
      .get('/api/1.0/users/5')
      .set('Authorization', `Bearer ${token}`);
    const tokenInDB = await Token.findOne({ where: { token: token } });

    expect(tokenInDB.lastUsedAt.getTime()).toBeGreaterThan(
      rightBeforeSendingRequest.getTime()
    );
  });
});
