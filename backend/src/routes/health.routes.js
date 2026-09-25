const express = require('express');
const { getHealth } = require('../controllers/healthController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/health — public
router.get('/', getHealth);

// GET /api/health/auth-verify — requires valid Auth0 JWT; returns verified claims
router.get('/auth-verify', requireAuth, (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auth0 token is valid',
    user: req.user,
  });
});

module.exports = router;
