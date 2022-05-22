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

describe('User Registration', () => {
  it('return 200 Ok when sign up request is valid', done => {
    request(app)
      .post('/api/1.0/users')
      .send({
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword'
      })
      .then(response => {
        expect(response.status).toBe(200);
        done();
      });
  });

  it('return success messageg when signup request is valid', done => {
    request(app)
      .post('/api/1.0/users')
      .send({
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword'
      })
      .then(response => {
        expect(response.body.message).toBe('User created');
        done();
      });
  });

  it('save user to database', done => {
    request(app)
      .post('/api/1.0/users')
      .send({
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword'
      })
      .then(() => {
        User.findAll().then(userList => {
          expect(userList.length).toBe(1);
          done();
        });
      });
  });

  it('save username and email to database', done => {
    request(app)
      .post('/api/1.0/users')
      .send({
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword'
      })
      .then(() => {
        User.findAll().then(userList => {
          const savedUser = userList[0];

          expect(savedUser.username).toBe('user1');
          expect(savedUser.email).toBe('user1@mail.com');
          done();
        });
      });
  });
});
