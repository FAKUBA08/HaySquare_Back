const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification error:', err);

      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Session expired. Please log in again.' });
      }

      return res.status(403).json({ message: 'Forbidden: Invalid token.' });
    }

    req.user = user; 
    next();
  });
};

module.exports = { authenticateToken };
