const express = require('express');
const Userrouter = require('./user//UserRouter');
const AuthenticationRouter = require('./auth/AuthenticatoinRouter');
const ErrorHandler = require('./error/ErrorHandler');

const app = express();

app.use(express.json());
app.use(Userrouter);
app.use(AuthenticationRouter);

app.use(ErrorHandler);

module.exports = app;
