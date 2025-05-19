// server/server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const vlcController = require('./vlcController');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Enable CORS for development
app.use(cors());

// Use VLC controller routes
app.use('/api', vlcController);

// Simple test route
app.get('/ping', (req, res) => {
  res.json({ message: 'VLC Control Server is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`VLC Control Server running on port ${PORT}`);
  console.log(`Test the server: http://localhost:${PORT}/ping`);
});