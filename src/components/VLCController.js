/**
 * File: src/components/VLCController.js
 * Description: VLC Media Player controller component
 * 
 * Version History:
 * v1.0.0 (2025-05-19) - Initial implementation based on Dash-VLC controller
 * v1.0.1 (2025-05-19) - Optimized for integration in main controls row
 * v1.0.2 (2025-05-19) - Updated to work with backend API for real VLC control
 * v1.0.3 (2025-05-19) - Fixed file upload and path handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import '../assets/styles/vlc-controller.css';

const VLCController = ({ 
  mediaFile, 
  onStatusChange,
  wavesurferInstance,
  activeRegion,
  onError
}) => {
  // State for the VLC controller
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [vlcConnected, setVlcConnected] = useState(false);
  const [serverFilePath, setServerFilePath] = useState(null);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  
  // Function to upload file to server
  const uploadFileToServer = useCallback(async (file) => {
    if (!file) return null;
    
    try {
      setUploadInProgress(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      console.log("Uploading file to server:", file.name);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      setUploadInProgress(false);
      
      if (result.success) {
        console.log(`File uploaded to server: ${result.filePath}`);
        return result.filePath;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      setUploadInProgress(false);
      console.error(`Error uploading file: ${error.message}`);
      if (onError) onError(`Error uploading file: ${error.message}`);
      return null;
    }
  }, [onError]);
  
  // Effect to upload file to server when mediaFile changes
  useEffect(() => {
    const uploadFile = async () => {
      if (mediaFile && mediaFile instanceof File) {
        // Only upload if we don't already have a server path for this file
        // This prevents re-uploading the same file multiple times
        const fileName = mediaFile.name;
        const fileSize = mediaFile.size;
        const fileLastModified = mediaFile.lastModified;
        
        // Create a file identifier to check if we've already uploaded this exact file
        const fileIdentifier = `${fileName}-${fileSize}-${fileLastModified}`;
        const lastUploadedFile = localStorage.getItem('lastUploadedFile');
        const lastFilePath = localStorage.getItem('lastFilePath');
        
        if (lastUploadedFile === fileIdentifier && lastFilePath) {
          console.log("Using cached file path for", fileName);
          setServerFilePath(lastFilePath);
        } else {
          const filePath = await uploadFileToServer(mediaFile);
          if (filePath) {
            setServerFilePath(filePath);
            localStorage.setItem('lastUploadedFile', fileIdentifier);
            localStorage.setItem('lastFilePath', filePath);
          }
        }
      } else if (mediaFile && typeof mediaFile === 'string') {
        // If mediaFile is already a server path, use it directly
        setServerFilePath(mediaFile);
      } else {
        setServerFilePath(null);
      }
    };
    
    uploadFile();
  }, [mediaFile, uploadFileToServer]);
  
  // Function to send commands to VLC via backend API
  const sendVLCCommand = useCallback(async (command) => {
    try {
      if (!vlcConnected) {
        console.warn("Trying to send command while VLC is not connected");
        return null;
      }
      
      console.log(`Sending VLC command: ${command}`);
      
      const response = await fetch('/api/vlc-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send command: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.playerState) {
        setIsPlaying(result.playerState.isPlaying);
      }
      
      return result.response;
    } catch (error) {
      console.error(`Error sending command: ${error.message}`);
      if (onError) onError(`Error: ${error.message}`);
      return null;
    }
  }, [vlcConnected, onError]);

  // Function to launch VLC
  const launchVLC = useCallback(async () => {
    if (!serverFilePath) {
      if (onError) onError('Please upload a media file first');
      return;
    }

    try {
      console.log(`Launching VLC with media path: ${serverFilePath}`);
      
      // Make API call to backend to launch VLC
      const response = await fetch('/api/launch-vlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaPath: serverFilePath })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to launch VLC: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setVlcConnected(true);
        setStatus('Ready');
        setIsPlaying(false);
        
        // Notify parent component
        if (onStatusChange) {
          onStatusChange({ isPlaying: false });
        }
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error(`Error launching VLC: ${error.message}`);
      if (onError) onError(`Error launching VLC: ${error.message}`);
      setStatus('Error');
    }
  }, [serverFilePath, onStatusChange, onError]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('pause');
      const newPlayingState = !isPlaying;
      setStatus(newPlayingState ? 'Playing' : 'Paused');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: newPlayingState });
      }
    } catch (error) {
      console.error(`Error toggling play/pause: ${error.message}`);
    }
  }, [vlcConnected, isPlaying, sendVLCCommand, onStatusChange]);

  // Stop playback
  const stopPlayback = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      // First pause then seek to beginning
      await sendVLCCommand('pause');
      await sendVLCCommand('seek 0');
      setIsPlaying(false);
      setStatus('Stopped');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: false });
      }
    } catch (error) {
      console.error(`Error stopping playback: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, onStatusChange]);

  // Seek backward/forward
  const seekMedia = useCallback(async (seconds) => {
    if (!vlcConnected) return;
    
    try {
      const command = `seek ${seconds > 0 ? '+' : ''}${seconds}`;
      await sendVLCCommand(command);
    } catch (error) {
      console.error(`Error seeking media: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Volume up/down
  const adjustVolume = useCallback(async (amount) => {
    if (!vlcConnected) return;
    
    try {
      const command = amount > 0 ? 'volup 5' : 'voldown 5';
      await sendVLCCommand(command);
    } catch (error) {
      console.error(`Error adjusting volume: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('fullscreen');
    } catch (error) {
      console.error(`Error toggling fullscreen: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Effect to handle active region changes
  useEffect(() => {
    if (!vlcConnected || !activeRegion || !wavesurferInstance) return;
    
    const handleRegionPlayback = async () => {
      try {
        // Seek to the region start time
        const startTime = activeRegion.start;
        await sendVLCCommand(`seek ${Math.floor(startTime)}`);
        
        // Resume playback if paused
        if (!isPlaying) {
          await sendVLCCommand('pause'); // VLC uses the same command to toggle play/pause
          setIsPlaying(true);
          setStatus('Playing region');
          
          // Notify parent component
          if (onStatusChange) {
            onStatusChange({ isPlaying: true });
          }
        }
      } catch (error) {
        console.error(`Error handling region playback: ${error.message}`);
      }
    };
    
    handleRegionPlayback();
  }, [activeRegion, vlcConnected, sendVLCCommand, wavesurferInstance, isPlaying, onStatusChange]);

  // Render VLC controller buttons
  return (
    <div className="vlc-controls">
      {/* Launch VLC Button */}
      <button 
        className="vlc-launch"
        onClick={launchVLC}
        disabled={!serverFilePath || vlcConnected || uploadInProgress}
        title="Launch VLC Player"
      >
        <i className="fas fa-external-link-alt"></i> VLC {uploadInProgress ? '(Uploading...)' : ''}
      </button>
      
      {/* Only show playback controls if VLC is connected */}
      {vlcConnected && (
        <>
          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          
          <button
            onClick={stopPlayback}
            title="Stop"
          >
            <i className="fas fa-stop"></i>
          </button>
          
          <button
            onClick={() => adjustVolume(-5)}
            title="Volume Down"
          >
            <i className="fas fa-volume-down"></i>
          </button>
          
          <button
            onClick={() => adjustVolume(5)}
            title="Volume Up"
          >
            <i className="fas fa-volume-up"></i>
          </button>
          
          <button
            onClick={() => seekMedia(-10)}
            title="Seek Backward 10s"
          >
            <i className="fas fa-backward"></i>
          </button>
          
          <button
            onClick={() => seekMedia(10)}
            title="Seek Forward 10s"
          >
            <i className="fas fa-forward"></i>
          </button>
          
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            <i className="fas fa-expand"></i>
          </button>
        </>
      )}
      
      {/* Status indicator */}
      <div className="vlc-status">
        <span className="status-label">VLC:</span>
        <span className={`status-value ${status.toLowerCase()}`}>{status}</span>
      </div>
    </div>
  );
};

export default VLCController;