const express = require('express');
const emojis = require('../data/emojis.json');

const router = express.Router();

// GET /api/emojis -> the same catalogue the model picks from (handy for rendering)
router.get('/', (req, res) => res.json({ emojis }));

module.exports = router;
