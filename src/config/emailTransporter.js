const nodemail = require('nodemailer');
const config = require('config');

const mailConfig = config.get('mail');

const transporter = nodemail.createTransport({ ...mailConfig });

module.exports = { transporter };
