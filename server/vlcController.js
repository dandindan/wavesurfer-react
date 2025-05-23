// server/vlcController.js
const express = require('express');
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const router = express.Router();

// Set up file upload storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'server/uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Global variables to store state
let vlcProcess = null;
let isPlaying = false;
let currentMediaPath = null;

// VLC RC interface details
const VLC_HOST = 'localhost';
const VLC_PORT = 9999;

// Function to send command to VLC
const sendVLCCommand = async (command) => {
  return new Promise((resolve, reject) => {
    try {
      const client = new net.Socket();
      
      client.on('error', (err) => {
        reject(`Connection error: ${err.message}`);
      });
      
      client.connect(VLC_PORT, VLC_HOST, () => {
        client.write(`${command}\n`);
      });
      
      client.on('data', (data) => {
        const response = data.toString().trim();
        client.destroy();
        resolve(response);
      });
      
      // Set timeout to avoid hanging
      setTimeout(() => {
        client.destroy();
        reject('Connection timeout');
      }, 3000);
      
    } catch (error) {
      reject(`Error sending command: ${error.message}`);
    }
  });
};

// API endpoint for file upload
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file provided' 
      });
    }
    
    const filePath = path.resolve(req.file.path);
    
    res.json({
      success: true,
      filePath,
      fileName: req.file.originalname,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error(`Error uploading file: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error uploading file: ${error.message}`
    });
  }
});

// API endpoint for launching VLC
router.post('/launch-vlc', async (req, res) => {
  try {
    const { mediaPath } = req.body;
    
    // Validate media path
    if (!mediaPath || !fs.existsSync(mediaPath)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid media path or file not found' 
      });
    }
    
    // Kill any existing VLC process
    if (vlcProcess !== null) {
      try {
        vlcProcess.kill();
        // Wait for process to terminate
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error terminating VLC process: ${error.message}`);
      }
    }
    
    // Determine VLC path based on OS
    let vlcPath;
    if (process.platform === 'win32') {  // Windows
      const windowsPaths = [
        'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
        'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
      ];
      
      for (const pathToCheck of windowsPaths) {
        if (fs.existsSync(pathToCheck)) {
          vlcPath = pathToCheck;
          break;
        }
      }
      
      if (!vlcPath) vlcPath = 'vlc';  // Try using PATH
    } else if (process.platform === 'darwin') {  // macOS
      if (fs.existsSync('/Applications/VLC.app/Contents/MacOS/VLC')) {
        vlcPath = '/Applications/VLC.app/Contents/MacOS/VLC';
      } else {
        vlcPath = 'vlc';  // Try using PATH
      }
    } else {  // Linux
      vlcPath = 'vlc';  // Try using PATH
    }
    
    console.log(`Launching VLC with path: ${vlcPath} for file: ${mediaPath}`);
    
    // Launch VLC with RC interface
    vlcProcess = spawn(vlcPath, [
      '--extraintf', 'rc',
      '--rc-host', `${VLC_HOST}:${VLC_PORT}`,
      '--no-video-title-show',  // No title overlay
      mediaPath
    ]);
    
    // Handle process events
    vlcProcess.on('error', (error) => {
      console.error(`VLC process error: ${error.message}`);
      vlcProcess = null;
    });
    
    vlcProcess.on('exit', (code) => {
      console.log(`VLC process exited with code ${code}`);
      vlcProcess = null;
    });
    
    // Log stdout and stderr
    vlcProcess.stdout.on('data', (data) => {
      console.log(`VLC stdout: ${data}`);
    });
    
    vlcProcess.stderr.on('data', (data) => {
      console.log(`VLC stderr: ${data}`);
    });
    
    // Wait for VLC to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Immediately pause
    await sendVLCCommand('pause');
    isPlaying = false;
    currentMediaPath = mediaPath;
    
    res.json({ 
      success: true, 
      message: 'VLC launched successfully' 
    });
    
  } catch (error) {
    console.error(`Error launching VLC: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Error launching VLC: ${error.message}` 
    });
  }
});

// API endpoint for sending commands to VLC
router.post('/vlc-command', async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ 
        success: false, 
        message: 'No command provided' 
      });
    }
    
    if (!vlcProcess) {
      return res.status(400).json({ 
        success: false, 
        message: 'VLC is not running' 
      });
    }
    
    const response = await sendVLCCommand(command);
    
    // Update state based on command
    if (command === 'pause') {
      isPlaying = !isPlaying;
    } else if (command === 'stop' || command.startsWith('seek 0')) {
      isPlaying = false;
    } else if (command === 'play') {
      isPlaying = true;
    }
    
    res.json({ 
      success: true, 
      response,
      playerState: {
        isPlaying,
        currentMediaPath
      }
    });
    
  } catch (error) {
    console.error(`Error sending command to VLC: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Error sending command: ${error.message}` 
    });
  }
});

// API endpoint for checking VLC status
router.get('/vlc-status', (req, res) => {
  res.json({
    isRunning: vlcProcess !== null,
    isPlaying,
    currentMediaPath
  });
});

module.exports = router;