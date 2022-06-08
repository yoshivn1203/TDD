const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
});

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

const getUsers = (options = {}) => {
  const agent = request(app).get('/api/1.0/users');
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent;
};

const addUsers = async (activeUserCount, inactiveUserCount = 0) => {
  const hash = await bcrypt.hash('P4ssword', 10);
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      password: hash,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUserCount
    });
  }
};

describe('Listing User', () => {
  it('return 200 ok when there are no user in database', async () => {
    const response = await getUsers();
    expect(response.status).toBe(200);
  });

  it('return page object as response body', async () => {
    const response = await getUsers();
    expect(response.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0
    });
  });
  it('return 10 users in page content when there are 11 users in database', async () => {
    await addUsers(11);
    const response = await getUsers();
    expect(response.body.content.length).toBe(10);
  });
  it('return 6 users in page content when there are 6 active users and 5 inactive users in database', async () => {
    await addUsers(6, 5);
    const response = await getUsers();
    expect(response.body.content.length).toBe(6);
  });
  it('return only id, username and email in content array for each user', async () => {
    await addUsers(11);
    const response = await getUsers();
    const user = response.body.content[0];
    expect(Object.keys(user)).toEqual(['id', 'username', 'email']);
  });
  it('return 2 as totalPages when there are 15 active and 7 inactive users', async () => {
    await addUsers(15, 7);
    const response = await getUsers();
    expect(response.body.totalPages).toBe(2);
  });
  it('return second page users and page indicator when page is set as 1 in request', async () => {
    await addUsers(11);
    // const response = request(app).get('/api/1.0/users?page=1');
    const response = await request(app)
      .get('/api/1.0/users')
      .query({ page: 1 });

    expect(response.body.content[0].username).toBe('user11');
    expect(response.body.page).toBe(1);
  });
  it('return first page when page is set below zero as request paremeter', async () => {
    await addUsers(11);
    // const response = request(app).get('/api/1.0/users?page=1');
    const response = await request(app)
      .get('/api/1.0/users')
      .query({ page: -1 });

    expect(response.body.page).toBe(0);
  });
  it('return 5 users and corresponding size indicator when size is set at 5 in request parameter', async () => {
    await addUsers(11);
    // const response = request(app).get('/api/1.0/users?page=1');
    const response = await request(app)
      .get('/api/1.0/users')
      .query({ size: 5 });

    expect(response.body.content.length).toBe(5);
    expect(response.body.size).toBe(5);
  });
  it('return 10 users and corresponding size indicator when size is set at 1000 in request parameter', async () => {
    await addUsers(11);
    // const response = request(app).get('/api/1.0/users?page=1');
    const response = await request(app)
      .get('/api/1.0/users')
      .query({ size: 1000 });

    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });
  it('return 10 users and corresponding size indicator when size is set at 0 in request parameter', async () => {
    await addUsers(11);
    // const response = request(app).get('/api/1.0/users?page=1');
    const response = await request(app)
      .get('/api/1.0/users')
      .query({ size: 0 });

    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });
  it('return page as zero and size as 10 when non numeric query in request parameter', async () => {
    await addUsers(11);
    // const response = request(app).get('/api/1.0/users?page=1');
    const response = await request(app)
      .get('/api/1.0/users')
      .query({ size: 'size', page: 'page' });

    expect(response.body.size).toBe(10);
    expect(response.body.page).toBe(0);
  });
  it('return user page without logged in user when request has valid authorization', async () => {
    await addUsers(11);
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    const response = await getUsers({ token: token });
    expect(response.body.totalPages).toBe(1);
  });
});

describe('Get User', () => {
  const getUser = (id = 5) => {
    return request(app).get(`/api/1.0/users/${id}`);
  };

  it('return 404 when user not found', async () => {
    const response = await getUser();
    expect(response.status).toBe(404);
  });
  it('return message when user not found', async () => {
    const response = await getUser();
    expect(response.body.message).toBe('User not found');
  });
  it('return proper error body when user not found', async () => {
    const nowInMillis = new Date().getTime();
    const response = await getUser();
    const error = response.body;
    expect(error.path).toBe('/api/1.0/users/5');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });
  it('return 200 when an active user exist', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: false
    });
    const response = await getUser(user.id);
    expect(response.status).toBe(200);
  });
  it('return id, username and email when an active user exist', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: false
    });
    const response = await getUser(user.id);
    expect(Object.keys(response.body)).toEqual(['id', 'username', 'email']);
  });
  it('return 404 when an user is inactive', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: true
    });
    const response = await getUser(user.id);
    expect(response.status).toEqual(404);
  });
});
