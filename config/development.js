module.exports = {
  database: {
    database: 'hoaxify',
    username: 'my-db-user',
    password: 'db-p4ss',
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  },
  mail: {
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'alexie.zemlak12@ethereal.email',
      pass: 'cPDR96XU8AHJ1YAVXT'
    }
  },
  uploadDir: 'uploads-dev',
  profileDir: 'profile'
};
