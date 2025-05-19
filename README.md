# WaveSurfer with Regions and VLC Player Integration

## Overview

This project integrates WaveSurfer.js audio visualization with VLC media player control. It provides:

1. Audio waveform visualization with WaveSurfer.js
2. Region selection and manipulation
3. VLC media player control via a web interface
4. Synchronization between WaveSurfer regions and VLC playback

The application allows users to visualize audio files, create regions by dragging on the waveform, and control VLC media player directly from the web interface.

## Features

- **Audio Visualization**: Display waveform and spectrogram
- **Region Management**: Create, edit, and remove regions on the waveform
- **VLC Integration**: Launch and control VLC from the web interface
- **Synchronization**: Click on a region to seek VLC to that position
- **Responsive Design**: Works on desktop and mobile devices

## Setup Instructions

### Prerequisites

- Node.js and npm installed
- VLC media player installed on your system
- React development environment

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd wavesurfer-vlc-integration
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Install required packages:
   ```bash
   npm install @wavesurfer/react wavesurfer.js express body-parser
   ```

### Setup Backend for VLC Control

Create a server directory and add the backend files:

1. **Create Express server**:

   ```bash
   mkdir -p server
   cp src/backend-vlc-controller.js server/vlcController.js
   ```

2. **Create server.js file**:

   ```javascript
   const express = require('express');
   const bodyParser = require('body-parser');
   const vlcController = require('./vlcController');

   const app = express();
   const PORT = process.env.PORT || 3001;

   app.use(bodyParser.json());
   app.use('/api', vlcController);

   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

3. **Update package.json** to include server:
   ```json
   "scripts": {
     "start": "react-scripts start",
     "build": "react-scripts build",
     "server": "node server/server.js",
     "dev": "concurrently \"npm run server\" \"npm run start\""
   }
   ```

### Running the Application

1. Start the development environment:

   ```bash
   npm run dev
   ```

2. Access the application at http://localhost:3000

## Usage

1. **Upload an audio file** using the upload panel
2. **Visualize the audio** in the waveform and spectrogram
3. **Create regions** by dragging on the waveform
4. **Launch VLC** using the VLC button in the controls
5. **Control playback** using both WaveSurfer and VLC controls
6. **Click on regions** to seek VLC to that position

## Components Structure

- **App.js**: Main application component
- **WaveSurferComponent.js**: Audio visualization and region management
- **VLCController.js**: VLC media player control interface
- **UploadPanel.js**: File upload interface
- **StatusBar.js**: Application status display

## VLC Integration

The application communicates with VLC using its RC (Remote Control) interface. When you launch VLC from the web interface, it starts with the following parameters:

```
--extraintf rc --rc-host localhost:9999 --no-video-title-show
```

The backend server then communicates with VLC through this RC interface to control playback, seek to specific positions, adjust volume, etc.

## Customization

- Update the color scheme in CSS files
- Adjust the WaveSurfer visualization parameters in WaveSurferComponent.js
- Modify the VLC controller commands in VLCController.js
- Change the layout in App.js

## Credits

- WaveSurfer.js: https://wavesurfer-js.org/
- VLC Media Player: https://www.videolan.org/
- React: https://reactjs.org/

## License

MIT License
