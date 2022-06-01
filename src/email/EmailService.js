const nodemailer = require('nodemailer');

const EmailTransporter = require('../config/emailTransporter');

const sendAccountActivation = async (email, token) => {
  const info = await EmailTransporter.transporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Account activation',
    html: `
    <div>
    <b>Please click the link below to activate your account</b>
    </div>
    <div>
    <a href="http://localhost:8080/#/login?token=${token}">Activate</a>
    </div>
    `
  });
  if (process.env.NODE_ENV === 'development') {
    console.log('url: ' + nodemailer.getTestMessageUrl(info));
  }
};

module.exports = { sendAccountActivation };
