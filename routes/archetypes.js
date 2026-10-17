const express = require('express');
const { publicList } = require('../services/archetypes');

const router = express.Router();

// GET /api/archetypes -> the archetypes with their simple-language descriptions (shown while registering)
router.get('/', (req, res) => res.json({ archetypes: publicList() }));

module.exports = router;
