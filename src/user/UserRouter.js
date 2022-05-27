const express = require('express');

const router = express.Router();
const { check, validationResult } = require('express-validator');
const UserService = require('./UserService');
const ValidationException = require('../error/ValidationException');

router.post(
  '/api/1.0/users',
  check('username')
    .notEmpty()
    .withMessage('Username cannot be null')
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage('Username must have min 4 and max 32 characters'),
  check('email')
    .notEmpty()
    .withMessage('Email cannot be null')
    .bail()
    .isEmail()
    .withMessage('Email is not valid')
    .bail()
    .custom(async email => {
      const user = await UserService.findByEmail(email);
      if (user) {
        throw new Error('Email in use');
      }
    }),
  check('password')
    .notEmpty()
    .withMessage('Password cannot be null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .bail()
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*$/)
    .withMessage(
      'Password must have at least 1 lowercase 1 uppercase and 1 number'
    ),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // const validationErrors = {};
      // errors
      //   .array()
      //   .forEach(error => (validationErrors[error.param] = error.msg));
      // return res.status(400).send({ validationErrors: validationErrors });
      return next(new ValidationException(errors));
    }
    try {
      await UserService.save(req.body);
      return res.send({ message: 'User created' });
    } catch (err) {
      // return res.status(502).send({ message: err.message });
      next(err);
    }
  }
);
router.post('/api/1.0/users/token/:token', async (req, res, next) => {
  const { token } = req.params;
  try {
    await UserService.activate(token);
    return res.send({ message: 'account activativated successfuly' });
  } catch (err) {
    // return res.status(400).send({ message: err.message });
    next(err);
  }
});
module.exports = router;
