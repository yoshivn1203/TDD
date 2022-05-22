const express = require('express');
const Userrouter = require('./user//UserRouter');

const app = express();

app.use(express.json());
app.use(Userrouter);

module.exports = app;
