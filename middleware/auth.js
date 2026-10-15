const jwt = require('jsonwebtoken');
const Player = require('../models/Player');

// Requires a valid "Authorization: Bearer <token>" header. Sets req.player.
module.exports = async function auth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const player = await Player.findById(payload.sub);
    if (!player) return res.status(401).json({ error: 'Account no longer exists' });
    req.player = player;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
