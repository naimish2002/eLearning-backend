const db = require('../lib/db');
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_EMAIL = process.env.RESEND_EMAIL;

const authController = {
  /**
   * Register a new user
   * @route POST /api/auth/register
   * @param req
   * @param res
   */
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Validate the request
      const validationErrors = validateRegisterRequest(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({ message: validationErrors.join(', ') });
      }

      // Check if the user already exists
      const userExists = await db.user.findFirst({ where: { email } });
      if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create the user
      const user = await db.user.create({
        data: { name, email, password: hashedPassword },
      });

      // Send a welcome email
      const resend = new Resend(RESEND_API_KEY || '');

      const { error } = resend.emails.send({
        from: 'onboarding@resend.dev',
        to: RESEND_EMAIL || '',
        subject: 'Registration Successful!',
        text: 'Welcome to elearning! You have successfully registered.',
        html: '<p>Welcome to elearning! You have successfully registered.</p>',
      });

      if (error) {
        console.error('Error sending welcome email:', error);
      }

      return res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Login a user
   * @route POST /api/auth/login
   * @param req
   * @param res
   */
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      //Validate the request
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Please provide all required fields' });
      }

      //Check if the user exists
      const user = await db.user.findFirst({
        where: { email },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      //Check if the password is correct
      const passwordValid = await bcrypt.compare(password, user.password);

      if (!passwordValid) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      //Create a new access token
      const accessToken = createAccessToken({ id: user.id });

      //Create a new refresh token
      const refreshToken = createRefreshToken({ id: user.id });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        path: '/api/auth/refresh_token',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({
        message: 'Login successful',
        accessToken,
        user: {
          ...user,
          password: undefined || '',
        },
      });
    } catch (error) {
      console.error('Error logging in user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Logout a user
   * @route POST /api/auth/logout
   * @param req
   * @param res
   */
  logout: async (req, res) => {
    try {
      res.clearCookie('refreshToken', {
        path: '/api/auth/refresh_token',
      });
      return res.json({ message: 'Logged out' });
    } catch (error) {
      console.error('Error logging out user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Generate a new access token
   * @route POST /api/auth/refresh_token
   * @param req
   * @param res
   */
  generateAccessToken: async (req, res) => {
    try {
      const refreshToken = req.body.token;

      if (!refreshToken) {
        return res.status(400).json({ message: 'Invalid token' });
      }

      //Check if the token is valid
      jwt.verify(refreshToken, JWT_SECRET || '', (err, result) => {
        if (err) {
          return res.status(400).json({ message: 'Invalid token' });
        }

        //Check if the user exists
        const user = db.user.findFirst({
          where: { id: result.id },
        });

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        //Create a new access token
        const accessToken = createAccessToken({ id: result.id });

        return res.status(200).json({ accessToken });
      });
    } catch (error) {
      console.error('Error generating access token:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
};

// Validate register request
const validateRegisterRequest = (body) => {
  const { name, email, password } = body;
  const validationErrors = [];

  switch (true) {
    case !name || !email || !password:
      validationErrors.push('Please provide all required fields');
      break;
    case password.length < 6 || password.length > 20:
      validationErrors.push('Password must be between 6 and 20 characters');
      break;
    case !/[a-z]/.test(password):
      validationErrors.push('Password must contain a lowercase letter');
      break;
    case !/[A-Z]/.test(password):
      validationErrors.push('Password must contain an uppercase letter');
      break;
    case !/[0-9]/.test(password):
      validationErrors.push('Password must contain a number');
      break;
    case !/[!@#$%^&*]/.test(password):
      validationErrors.push('Password must contain a special character');
      break;
    case !/^[a-zA-Z0-9!@#$%^&*]+$/.test(password):
      validationErrors.push(
        'Password must contain only alphanumeric characters and special characters'
      );
      break;
    case password.includes(' '):
      validationErrors.push('Password must not contain spaces');
      break;
    default:
      break;
  }

  return validationErrors;
};

//Create jwt to authenticate user
const createAccessToken = (user) => {
  return jwt.sign({ id: user.id }, JWT_SECRET || '', { expiresIn: '7d' });
};

//Create jwt to authenticate user
const createRefreshToken = (user) => {
  return jwt.sign({ id: user.id }, JWT_SECRET || '', { expiresIn: '7d' });
};

module.exports = authController;
