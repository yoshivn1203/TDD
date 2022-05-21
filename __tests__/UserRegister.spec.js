const request = require('supertest');
const { response } = require('../src/app');
const app = require('../src/app');

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
});
