const express = require('express');
const Userrouter = require('./user//UserRouter');
const AuthenticationRouter = require('./auth/AuthenticatoinRouter');
const ErrorHandler = require('./error/ErrorHandler');
const tokenAuthentication = require('./middleware/tokenAuthentication');

const app = express();

app.use(express.json());
app.use(tokenAuthentication);

app.use(Userrouter);
app.use(AuthenticationRouter);

app.use(ErrorHandler);

module.exports = app;
