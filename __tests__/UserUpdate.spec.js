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

// const putUser = (id = 5, body = null, options = {}) => {
//   const agent = request(app).put(`/api/1.0/users/${id}`);
//   if (options.auth) {
//     const { email, password } = options.auth;
//     agent.auth(email, password);
//     // Set Header authorzation
//   }
//   return agent.send(body);
// };

const putUser = async (id = 5, body = null, options = {}) => {
  let agent = request(app);
  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth').send(options.auth);
    token = response.body.token;
  }

  agent = request(app).put(`/api/1.0/users/${id}`);
  if (token) {
    agent.set('Authorization', `Bearer ${token}`);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send(body);
};

describe('User update', () => {
  it('return fobidden when request sent without basic authorization', async () => {
    const response = await putUser();
    expect(response.status).toBe(403);
  });

  it('return proper error body for unauthorized request', async () => {
    const nowInMillis = new Date().getTime();
    const response = await putUser();
    const error = response.body;
    expect(error.path).toBe('/api/1.0/users/5');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe('Unauthorized User Update');
  });
  it('return forbidden when request send with incorrect email', async () => {
    await addUser();
    const response = await putUser(5, null, {
      auth: { email: 'wronguser@mail.com', password: 'P4ssword' }
    });
    expect(response.status).toBe(403);
  });
  it('return forbidden when request send with incorrect password', async () => {
    await addUser();
    const response = await putUser(5, null, {
      auth: { email: 'user1@mail.com', password: 'WrongP4ssword' }
    });
    expect(response.status).toBe(403);
  });
  it('return forbidden when request send with correct credentials but for different user', async () => {
    await addUser();
    const UserToBeUpdated = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com'
    });
    const response = await putUser(UserToBeUpdated.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    expect(response.status).toBe(403);
  });
  it('return forbidden when request send by inactive user with correct credentials for its own user', async () => {
    const inactiveUSer = await addUser({
      ...activeUser,
      inactive: true
    });
    const response = await putUser(inactiveUSer.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    expect(response.status).toBe(403);
  });
  it('return 200 ok when valid update request sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated' };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    expect(response.status).toBe(200);
  });
  it('updates username in database when valid update request sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated' };
    await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.username).toBe(validUpdate.username);
  });

  it('return 403 when token is not valid', async () => {
    const response = await putUser(5, null, { token: '123' });
    expect(response.status).toBe(403);
  });
});
