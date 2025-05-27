/**
 * File: src/components/VLCController.js
 * Description: VLC Media Player controller component
 * 
 * Version History:
 * v1.0.0 (2025-05-19) - Initial implementation based on Dash-VLC controller
 * v1.0.1 (2025-05-19) - Optimized for integration in main controls row
 * v1.0.2 (2025-05-19) - Updated to work with backend API for real VLC control
 * v1.0.3 (2025-05-19) - Fixed file upload and path handling
 * v1.0.4 (2025-05-27) - Improved VLC-WaveSurfer synchronization - Maoz Lahav
 * v1.0.5 (2025-05-27) - Fixed file upload error handling and debugging - Maoz Lahav
 * v1.0.6 (2025-05-27) - Complete rewrite with better error handling and debugging - Maoz Lahav
 */

import React, { useState, useEffect, useCallback } from 'react';
import '../assets/styles/vlc-controller.css';

const VLCController = ({ 
  mediaFile, 
  onStatusChange,
  wavesurferInstance,
  activeRegion,
  onError,
  onRegionPlayback, 
}) => {
  // State for the VLC controller
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [vlcConnected, setVlcConnected] = useState(false);
  const [serverFilePath, setServerFilePath] = useState(null);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [vlcCurrentTime, setVlcCurrentTime] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');
  
  // Function to update debug info
  const updateDebugInfo = useCallback((message) => {
    console.log("VLC Debug:", message);
    setDebugInfo(message);
  }, []);
  
  // Function to upload file to server
  const uploadFileToServer = useCallback(async (file) => {
    if (!file) {
      updateDebugInfo("No file provided for upload");
      return null;
    }
    
    try {
      setUploadInProgress(true);
      updateDebugInfo(`Starting upload: ${file.name} (${file.size} bytes, ${file.type})`);
      
      const formData = new FormData();
      formData.append('file', file);
      
      updateDebugInfo("Sending file to server...");
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      updateDebugInfo(`Upload response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        updateDebugInfo(`Upload failed: ${response.status} - ${errorText}`);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      updateDebugInfo(`Upload result: ${JSON.stringify(result)}`);
      
      setUploadInProgress(false);
      
      if (result.success) {
        updateDebugInfo(`File uploaded successfully to: ${result.filePath}`);
        return result.filePath;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      setUploadInProgress(false);
      updateDebugInfo(`Upload error: ${error.message}`);
      if (onError) onError(`Error uploading file: ${error.message}`);
      return null;
    }
  }, [onError, updateDebugInfo]);
  
  // Effect to upload file to server when mediaFile changes
  useEffect(() => {
    updateDebugInfo(`MediaFile changed: ${mediaFile ? (mediaFile.name || 'URL') : 'null'}`);
    
    const uploadFile = async () => {
      if (mediaFile && mediaFile instanceof File) {
        updateDebugInfo(`Processing File object: ${mediaFile.name}`);
        
        // Create a file identifier to check if we've already uploaded this exact file
        const fileName = mediaFile.name;
        const fileSize = mediaFile.size;
        const fileLastModified = mediaFile.lastModified;
        const fileIdentifier = `${fileName}-${fileSize}-${fileLastModified}`;
        
        // Check cache
        const lastUploadedFile = localStorage.getItem('lastUploadedFile');
        const lastFilePath = localStorage.getItem('lastFilePath');
        
        if (lastUploadedFile === fileIdentifier && lastFilePath) {
          updateDebugInfo(`Using cached file path: ${lastFilePath}`);
          setServerFilePath(lastFilePath);
        } else {
          updateDebugInfo("Uploading new file...");
          const filePath = await uploadFileToServer(mediaFile);
          if (filePath) {
            setServerFilePath(filePath);
            localStorage.setItem('lastUploadedFile', fileIdentifier);
            localStorage.setItem('lastFilePath', filePath);
            updateDebugInfo(`File path saved: ${filePath}`);
          } else {
            updateDebugInfo("Failed to upload file");
            setServerFilePath(null);
          }
        }
      } else if (mediaFile && typeof mediaFile === 'string') {
        updateDebugInfo(`Processing URL string: ${mediaFile}`);
        setServerFilePath(mediaFile);
      } else {
        updateDebugInfo("No media file provided");
        setServerFilePath(null);
      }
    };
    
    uploadFile();
  }, [mediaFile, uploadFileToServer, updateDebugInfo]);
  
  // Function to send commands to VLC via backend API
  const sendVLCCommand = useCallback(async (command) => {
    try {
      if (!vlcConnected) {
        updateDebugInfo(`Cannot send command "${command}" - VLC not connected`);
        return null;
      }
      
      updateDebugInfo(`Sending VLC command: ${command}`);
      
      const response = await fetch('/api/vlc-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send command: ${response.statusText}`);
      }
      
      const result = await response.json();
      updateDebugInfo(`Command result: ${JSON.stringify(result)}`);
      
      if (result.playerState) {
        setIsPlaying(result.playerState.isPlaying);
      }
      
      return result.response;
    } catch (error) {
      updateDebugInfo(`Command error: ${error.message}`);
      if (onError) onError(`Error: ${error.message}`);
      return null;
    }
  }, [vlcConnected, onError, updateDebugInfo]);

  // Function to launch VLC
  const launchVLC = useCallback(async () => {
    updateDebugInfo("Launch VLC button clicked");
    updateDebugInfo(`Server file path: ${serverFilePath}`);
    updateDebugInfo(`Upload in progress: ${uploadInProgress}`);
    
    if (!serverFilePath) {
      const errorMsg = 'No file path available. Please ensure the file is uploaded first.';
      updateDebugInfo(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    if (uploadInProgress) {
      const errorMsg = 'File upload is still in progress. Please wait.';
      updateDebugInfo(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    try {
      updateDebugInfo(`Attempting to launch VLC with: ${serverFilePath}`);
      
      const requestBody = { mediaPath: serverFilePath };
      updateDebugInfo(`Request body: ${JSON.stringify(requestBody)}`);
      
      const response = await fetch('/api/launch-vlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      updateDebugInfo(`Launch response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        updateDebugInfo(`Launch failed: ${response.status} - ${errorText}`);
        throw new Error(`Failed to launch VLC: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      updateDebugInfo(`Launch result: ${JSON.stringify(result)}`);
      
      if (result.success) {
        setVlcConnected(true);
        setStatus('Ready');
        setIsPlaying(false);
        updateDebugInfo("VLC launched successfully");
        
        // Notify parent component
        if (onStatusChange) {
          onStatusChange({ isPlaying: false });
        }
      } else {
        throw new Error(result.message || 'Unknown error launching VLC');
      }
    } catch (error) {
      updateDebugInfo(`Launch error: ${error.message}`);
      if (onError) onError(`Error launching VLC: ${error.message}`);
      setStatus('Error');
    }
  }, [serverFilePath, uploadInProgress, onStatusChange, onError, updateDebugInfo]);

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
      updateDebugInfo(`Play/pause error: ${error.message}`);
    }
  }, [vlcConnected, isPlaying, sendVLCCommand, onStatusChange, updateDebugInfo]);

  // Stop playback
  const stopPlayback = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('pause');
      await sendVLCCommand('seek 0');
      setIsPlaying(false);
      setStatus('Stopped');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: false });
      }
    } catch (error) {
      updateDebugInfo(`Stop error: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, onStatusChange, updateDebugInfo]);

  // Seek backward/forward
  const seekMedia = useCallback(async (seconds) => {
    if (!vlcConnected) return;
    
    try {
      const command = `seek ${seconds > 0 ? '+' : ''}${seconds}`;
      await sendVLCCommand(command);
    } catch (error) {
      updateDebugInfo(`Seek error: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, updateDebugInfo]);

  // Seek to absolute position (in seconds)
  const seekToPosition = useCallback(async (timeInSeconds) => {
    if (!vlcConnected) {
      updateDebugInfo("❌ Cannot seek - VLC not connected");
      return false;
    }
    
    try {
      updateDebugInfo(`🎯 VLC seeking to: ${timeInSeconds.toFixed(2)} seconds`);
      
      // Use VLC's seek command - format: seek <seconds>
      const seekCommand = `seek ${Math.floor(timeInSeconds)}`;
      const result = await sendVLCCommand(seekCommand);
      
      if (result !== null) {
        setVlcCurrentTime(timeInSeconds);
        updateDebugInfo(`✅ VLC seek SUCCESS to: ${timeInSeconds.toFixed(2)}s`);
        return true;
      } else {
        updateDebugInfo("❌ VLC seek FAILED - no response from server");
        return false;
      }
    } catch (error) {
      updateDebugInfo(`❌ VLC seek ERROR: ${error.message}`);
      return false;
    }
  }, [vlcConnected, sendVLCCommand, updateDebugInfo]);

  // Volume up/down
  const adjustVolume = useCallback(async (amount) => {
    if (!vlcConnected) return;
    
    try {
      const command = amount > 0 ? 'volup 5' : 'voldown 5';
      await sendVLCCommand(command);
    } catch (error) {
      updateDebugInfo(`Volume error: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, updateDebugInfo]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('fullscreen');
    } catch (error) {
      updateDebugInfo(`Fullscreen error: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, updateDebugInfo]);

  // Test server connection
  const testServerConnection = useCallback(async () => {
    try {
      updateDebugInfo("Testing server connection...");
      const response = await fetch('/ping');
      if (response.ok) {
        const result = await response.json();
        updateDebugInfo(`Server test: ${result.message}`);
      } else {
        updateDebugInfo(`Server test failed: ${response.status}`);
      }
    } catch (error) {
      updateDebugInfo(`Server connection error: ${error.message}`);
    }
  }, [updateDebugInfo]);

  // Run server test on component mount
  useEffect(() => {
    testServerConnection();
  }, [testServerConnection]);

  // Poll for VLC status (every 2 seconds when connected)
  useEffect(() => {
    if (!vlcConnected) return;
    
    const getVlcStatus = async () => {
      try {
        const response = await fetch('/api/vlc-status');
        if (response.ok) {
          const status = await response.json();
          
          // Update local state if different from VLC state
          if (status.isPlaying !== isPlaying) {
            setIsPlaying(status.isPlaying);
            
            // Notify parent component
            if (onStatusChange) {
              onStatusChange({ isPlaying: status.isPlaying });
            }
            
            // Update status text
            setStatus(status.isPlaying ? 'Playing' : 'Paused');
          }
        }
      } catch (error) {
        // Don't spam console with status errors
        // updateDebugInfo(`Status poll error: ${error.message}`);
      }
    };
    
    // Poll for status every 2 seconds
    const statusInterval = setInterval(getVlcStatus, 2000);
    
    return () => {
      clearInterval(statusInterval);
    };
  }, [vlcConnected, isPlaying, onStatusChange]);

  // Effect to handle active region changes
  useEffect(() => {
    if (!vlcConnected || !activeRegion) return;
    
    // Skip click positions that aren't actual regions
    if (activeRegion.isClickPosition) {
      updateDebugInfo(`Ignoring click position: ${activeRegion.start}s`);
      return;
    }
    
    const handleRegionPlayback = async () => {
      try {
        updateDebugInfo(`Playing region: ${activeRegion.id} (${activeRegion.start}s - ${activeRegion.end}s)`);
        
        // Seek to the region start time
        const startTime = activeRegion.start;
        const seekSuccess = await seekToPosition(startTime);
        
        if (!seekSuccess) {
          updateDebugInfo("Failed to seek to region start time");
          return;
        }
        
        // Resume playback if paused
        if (!isPlaying) {
          await sendVLCCommand('pause'); // VLC uses the same command to toggle
          setIsPlaying(true);
          setStatus('Playing region');
          
          // Notify parent component
          if (onStatusChange) {
            onStatusChange({ isPlaying: true });
          }
        }
        
        // Notify parent component about region playback
        if (onRegionPlayback) {
          onRegionPlayback({
            region: activeRegion,
            vlcTime: startTime,
            isPlaying: true
          });
        }
      } catch (error) {
        updateDebugInfo(`Region playback error: ${error.message}`);
      }
    };
    
    handleRegionPlayback();
  }, [activeRegion, vlcConnected, sendVLCCommand, isPlaying, onStatusChange, seekToPosition, onRegionPlayback, updateDebugInfo]);

  // Create VLC control methods for wavesurfer instance
  useEffect(() => {
    if (vlcConnected && wavesurferInstance) {
      updateDebugInfo("🔗 Attaching synchronized VLC controls to WaveSurfer");
      
      // Attach methods to the wavesurfer instance for direct control
      wavesurferInstance.vlc = {
        seekTo: async (timeInSeconds) => {
          updateDebugInfo(`🎬 VLC seek requested: ${timeInSeconds.toFixed(2)}s`);
          return await seekToPosition(timeInSeconds);
        },
        play: async () => {
          updateDebugInfo("▶️ VLC play requested");
          if (!isPlaying) {
            await togglePlayPause();
            updateDebugInfo("✅ VLC started playing");
            return true;
          }
          updateDebugInfo("ℹ️ VLC already playing");
          return false;
        },
        pause: async () => {
          updateDebugInfo("⏸️ VLC pause requested");
          if (isPlaying) {
            await togglePlayPause();
            updateDebugInfo("✅ VLC paused");
            return true;
          }
          updateDebugInfo("ℹ️ VLC already paused");
          return false;
        },
        stop: async () => {
          updateDebugInfo("⏹️ VLC stop requested");
          await stopPlayback();
          return true;
        },
        isConnected: () => vlcConnected,
        getCurrentTime: () => vlcCurrentTime,
        playRegion: async (region) => {
          if (!region) return false;
          
          updateDebugInfo(`🎵 VLC region play: ${region.start}s - ${region.end}s`);
          
          // First seek to region start
          await seekToPosition(region.start);
          
          // Then play if not already playing
          if (!isPlaying) {
            await togglePlayPause();
          }
          
          return true;
        },
        // Synchronized seek and play method
        seekAndPlay: async (timeInSeconds) => {
          updateDebugInfo(`🎯 VLC synchronized seek & play: ${timeInSeconds.toFixed(2)}s`);
          
          // First seek
          const seekSuccess = await seekToPosition(timeInSeconds);
          if (!seekSuccess) {
            updateDebugInfo("❌ VLC seek failed, cannot play");
            return false;
          }
          
          // Then start playing
          if (!isPlaying) {
            await togglePlayPause();
            updateDebugInfo("✅ VLC synchronized playback started");
            return true;
          }
          
          updateDebugInfo("ℹ️ VLC was already playing");
          return true;
        }
      };
      
      updateDebugInfo("🎉 Synchronized VLC controls attached successfully");
    } else if (wavesurferInstance) {
      // Remove VLC controls if not connected
      delete wavesurferInstance.vlc;
      updateDebugInfo("🔌 VLC controls removed (not connected)");
    }
  }, [vlcConnected, wavesurferInstance, seekToPosition, togglePlayPause, isPlaying, stopPlayback, vlcCurrentTime, updateDebugInfo]);

  // Render VLC controller buttons
  return (
    <div className="vlc-controls">
      {/* Launch VLC Button */}
      <button 
        className="vlc-launch"
        onClick={launchVLC}
        disabled={!serverFilePath || vlcConnected || uploadInProgress}
        title={
          uploadInProgress ? "Uploading file..." :
          !serverFilePath ? "Please upload a file first" :
          vlcConnected ? "VLC is already running" :
          "Launch VLC Player"
        }
      >
        <i className="fas fa-external-link-alt"></i> 
        {uploadInProgress ? 'Uploading...' : vlcConnected ? 'Connected' : 'VLC'}
      </button>
      
      {/* Server Test Button (for debugging) */}
      {!vlcConnected && (
        <button
          onClick={testServerConnection}
          title="Test server connection"
          style={{ marginLeft: '5px', fontSize: '0.8rem', padding: '4px 8px' }}
        >
          <i className="fas fa-network-wired"></i> Test
        </button>
      )}
      
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
      
      {/* Status and debug info */}
      <div className="vlc-status">
        <span className="status-label">VLC:</span>
        <span className={`status-value ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
        {debugInfo && (
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px', maxWidth: '200px', wordBreak: 'break-word' }}>
            {debugInfo}
          </div>
        )}
      </div>
    </div>
  );
};

export default VLCController;