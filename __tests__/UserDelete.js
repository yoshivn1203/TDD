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

const auth = async (options = {}) => {
  let token;
  if (options.auth) {
    const response = await request(app)
      .post('/api/1.0/auth')
      .send(options.auth);
    token = response.body.token;
  }
  return token;
};

// const putUser = (id = 5, body = null, options = {}) => {
//   const agent = request(app).put(`/api/1.0/users/${id}`);
//   if (options.auth) {
//     const { email, password } = options.auth;
//     agent.auth(email, password);
//     // Set Header authorzation
//   }
//   return agent.send(body);
// };

const deleteUser = async (id = 5, options = {}) => {
  const agent = request(app).delete(`/api/1.0/users/${id}`);

  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send();
};

describe('User delete', () => {
  it('return fobidden when request sent without basic authorization', async () => {
    const response = await deleteUser();
    expect(response.status).toBe(403);
  });

  it('return proper error body for unauthorized request', async () => {
    const nowInMillis = new Date().getTime();
    const response = await deleteUser();
    const error = response.body;
    expect(error.path).toBe('/api/1.0/users/5');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe('Unauthorized User Delete');
  });

  it('return forbidden when request send with correct credentials but for different user', async () => {
    await addUser();
    const UserToBeDeleted = await deleteUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com'
    });
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    const response = await deleteUser(UserToBeDeleted.id, { token: token });
    expect(response.status).toBe(403);
  });

  it('return 200 ok when delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    const response = await deleteUser(savedUser.id, { token: token });
    expect(response.status).toBe(200);
  });
  it('delete username in database when request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    await deleteUser(savedUser.id, { token: token });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser).toBeNull();
  });

  it('return 403 when token is not valid', async () => {
    const response = await deleteUser(5, { token: '123' });
    expect(response.status).toBe(403);
  });

  it('delete token from database when delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    await deleteUser(savedUser.id, { token: token });
    const inDBToken = await Token.findOne({ where: { token: token } });
    expect(inDBToken).toBeNull();
  });
  it('delete all tokens from database when delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token1 = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    const token2 = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    await deleteUser(savedUser.id, { token: token1 });
    const inDBToken = await Token.findOne({ where: { token: token2 } });
    expect(inDBToken).toBeNull();
  });
});
