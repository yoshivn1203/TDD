const express = require('express');
const Userrouter = require('./user//UserRouter');
const ErrorHandler = require('./error/ErrorHandler');

const app = express();

app.use(express.json());
app.use(Userrouter);

app.use(ErrorHandler);

module.exports = app;
