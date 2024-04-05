const db = require('../lib/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate user
const auth = async (req, res, next) => {
  try {
    // Get token
    const token = req.header('Authorization');

    if (!token) return res.status(400).json({ msg: 'Invalid Authentication' });

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded)
      return res.status(400).json({ msg: 'Invalid Authentication' });

    // Check if user exists
    const user = await db.user.findFirst({
      where: { id: decoded.id },
    });

    if (!user) return res.status(400).json({ msg: 'User does not exist' });

    req.user = user;
    next();
  } catch (err) {
    console.log('Error in auth middleware:', err.message);
    return res.status(500).json({ msg: err.message });
  }
};

// Check if user is an admin
const checkAdmin = async (req, res, next) => {
  try {
    // Get token
    const token = req.header('Authorization');

    if (!token) return res.status(400).json({ msg: 'Invalid Authentication' });

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded)
      return res.status(400).json({ msg: 'Invalid Authentication' });

    // Check if user exists
    const user = await db.user.findFirst({
      where: { id: decoded.id },
    });

    if (!user) return res.status(400).json({ msg: 'User does not exist' });

    if (user.role !== 'ADMIN')
      return res.status(400).json({ msg: 'Access Denied' });

    req.user = user;
    next();
  } catch (error) {
    console.error('Error in checkAdmin middleware:', error.message);
    return res.status(500).json({ msg: error.message });
  }
};

module.exports = { auth, checkAdmin };
