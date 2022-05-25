const EmailTransporter = require('../config/emailTransporter');

const sendAccountActivation = async user => {
  await EmailTransporter.transporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: user.email,
    subject: 'Account activation',
    html: `Token is ${user.activationToken}`
  });
};

module.exports = { sendAccountActivation };
