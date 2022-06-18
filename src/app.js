const express = require('express');
const Userrouter = require('./user//UserRouter');
const AuthenticationRouter = require('./auth/AuthenticatoinRouter');
const ErrorHandler = require('./error/ErrorHandler');
const tokenAuthentication = require('./middleware/tokenAuthentication');
const FileService = require('./file/FileService');
const config = require('config');
const path = require('path');

const { uploadDir, profileDir } = config;
const profileFolder = path.join('.', uploadDir, profileDir);

FileService.createFolders();

const app = express();

app.use(express.json({ limit: '3mb' }));

app.use(
  '/images',
  express.static(profileFolder, { maxAge: 365 * 24 * 60 * 60 * 1000 })
);

app.use(tokenAuthentication);

app.use(Userrouter);
app.use(AuthenticationRouter);

app.use(ErrorHandler);

module.exports = app;
