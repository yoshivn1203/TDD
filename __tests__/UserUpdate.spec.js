const request = require('supertest');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const config = require('config');

const { uploadDir, profileDir } = config;
const profileDirectory = path.join('.', uploadDir, profileDir);

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
});

afterAll(async () => {
  const files = fs.readdirSync(profileDirectory);
  for (const file of files) {
    fs.unlinkSync(path.join(profileDirectory, file));
  }
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

const readFileasBase64 = (file = 'test-png.png') => {
  const filePath = path.join('.', '__tests__', 'resources', file);
  return fs.readFileSync(filePath, { encoding: 'base64' });
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
  it('save the user image when update contains image as base64', async () => {
    const fileInBase64 = readFileasBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.image).toBeTruthy();
  });

  it('return success body having only id, username, email and image', async () => {
    const fileInBase64 = readFileasBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    expect(Object.keys(response.body)).toEqual([
      'id',
      'username',
      'email',
      'image'
    ]);
  });

  it('save the user image to upload folder and storefilename in user when update image', async () => {
    const fileInBase64 = readFileasBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    const proImagePath = path.join(profileDirectory, inDBUser.image);
    expect(fs.existsSync(proImagePath)).toBe(true);
  });
  it('remove the old images after user upload new one', async () => {
    const fileInBase64 = readFileasBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });

    await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    const firstImage = response.body.image;

    const proImagePath = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(proImagePath)).toBe(false);
  });

  it.each`
    field         | value             | expectedMessage
    ${'username'} | ${null}           | ${'Username cannot be null'}
    ${'username'} | ${'use'}          | ${'Username must have min 4 and max 32 characters'}
    ${'username'} | ${'a'.repeat(33)} | ${'Username must have min 4 and max 32 characters'}
  `(
    'returns $expectedMessage when $field is $value',
    async ({ expectedMessage, value }) => {
      const savedUser = await addUser();
      const invalidUpdate = { username: value };
      const response = await putUser(savedUser.id, invalidUpdate, {
        auth: {
          email: savedUser.email,
          password: 'P4ssword'
        }
      });
      expect(response.status).toBe(400);
      expect(response.body.validationErrors.username).toBe(expectedMessage);
    }
  );

  it('return 200 when image size is 2 mb', async () => {
    const testPng = readFileasBase64();
    const pngByte = Buffer.from(testPng, 'base64').length;
    const twoMB = 1024 * 1024 * 2;
    const filling = 'a'.repeat(twoMB - pngByte);
    const fillingBase64 = Buffer.from(filling).toString('base64');
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user1-updated',
      image: testPng + fillingBase64
    };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    expect(response.status).toBe(200);
  });
  it('return 400 when image size exceeds 2 mb', async () => {
    const fileWithSizeExceed2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
    const base64 = Buffer.from(fileWithSizeExceed2MB).toString('base64');
    const savedUser = await addUser();
    const invalidUpdate = { username: 'user1-updated', image: base64 };
    const response = await putUser(savedUser.id, invalidUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    expect(response.status).toBe(400);
  });
  it('keep the old image after use only updates username', async () => {
    const fileInBase64 = readFileasBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });

    await putUser(
      savedUser.id,
      { username: 'user1-updated2' },
      {
        auth: {
          email: savedUser.email,
          password: 'P4ssword'
        }
      }
    );
    const firstImage = response.body.image;

    const proImagePath = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(proImagePath)).toBe(true);

    const userInDb = await User.findOne({ where: { id: savedUser.id } });
    expect(userInDb.image).toBe(firstImage);
  });

  it('return error message when image size exceeds 2 mb', async () => {
    const fileWithSizeExceed2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
    const base64 = Buffer.from(fileWithSizeExceed2MB).toString('base64');
    const savedUser = await addUser();
    const invalidUpdate = { username: 'user1-updated', image: base64 };
    const response = await putUser(savedUser.id, invalidUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword'
      }
    });
    expect(response.body.validationErrors.image).toBe(
      'Your profile image can not be larger than 2 Mb'
    );
  });

  it.each`
    file              | status
    ${'test-gif.gif'} | ${400}
    ${'test-pdf.pdf'} | ${400}
    ${'test-txt.txt'} | ${400}
    ${'test-png.png'} | ${200}
    ${'test-jpg.jpg'} | ${200}
  `(
    'return $status when uploading $file as image',
    async ({ file, status }) => {
      const fileInBase64 = readFileasBase64(file);
      const savedUser = await addUser();
      const updateBody = { username: 'user1-updated', image: fileInBase64 };
      const response = await putUser(savedUser.id, updateBody, {
        auth: {
          email: savedUser.email,
          password: 'P4ssword'
        }
      });
      expect(response.status).toBe(status);
    }
  );

  it.each`
    file              | message
    ${'test-gif.gif'} | ${'Unsupported image file'}
    ${'test-pdf.pdf'} | ${'Unsupported image file'}
    ${'test-txt.txt'} | ${'Unsupported image file'}
  `(
    'return $message when uploading $file as image',
    async ({ file, message }) => {
      const fileInBase64 = readFileasBase64(file);
      const savedUser = await addUser();
      const updateBody = { username: 'user1-updated', image: fileInBase64 };
      const response = await putUser(savedUser.id, updateBody, {
        auth: {
          email: savedUser.email,
          password: 'P4ssword'
        }
      });
      expect(response.body.validationErrors.image).toBe(message);
    }
  );
});
