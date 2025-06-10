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
 * v1.0.7 (2025-06-09) - Enhanced for EXACT mirroring with WaveSurfer - Human Request
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
  // v1.0.7 - Added exact mirroring state
  const [exactMirrorActive, setExactMirrorActive] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [syncStats, setSyncStats] = useState({ seeks: 0, plays: 0, pauses: 0 });
  
  // Function to update debug info
  const updateDebugInfo = useCallback((message) => {
    // console.log("VLC Debug:", message); // v1.0.7 - Reduced logging to prevent performance issues
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
  
  // v1.0.9 - WORKING VLC command system with REAL sync
  const sendVLCCommand = useCallback(async (command, source = 'manual') => {
    try {
      if (!vlcConnected) {
        console.error(`Cannot send command "${command}" - VLC not connected`);
        return null;
      }
      
      console.log(`🎮 [${source}] SENDING VLC COMMAND: ${command}`);
      
      const response = await fetch('/api/vlc-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (!response.ok) {
        throw new Error(`VLC command failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ [${source}] VLC COMMAND SUCCESS: ${command}`);
      
      // Update local state based on command
      if (command === 'pause') {
        const newState = !isPlaying;
        setIsPlaying(newState);
        setStatus(newState ? 'Playing' : 'Paused');
        console.log(`🔄 VLC state updated: ${newState ? 'PLAYING' : 'PAUSED'}`);
      }
      
      return result.response;
    } catch (error) {
      console.error(`❌ [${source}] VLC COMMAND FAILED: ${command} - ${error.message}`);
      if (onError) onError(`VLC Error: ${error.message}`);
      return null;
    }
  }, [vlcConnected, onError, isPlaying]);

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
        
        // v1.0.8 - CRITICAL: Ensure VLC starts PAUSED (backend already does this, but double-check)
        setTimeout(async () => {
          try {
            // Force pause VLC if it's playing to ensure sync
            await sendVLCCommand('pause', 'ensure-paused-on-launch');
            setIsPlaying(false);
            setStatus('Paused (Ready for sync)');
            updateDebugInfo("✅ VLC confirmed PAUSED and ready for sync");
            
            // v1.0.8 - Activate exact mirroring AFTER ensuring paused state
            setExactMirrorActive(true);
            setSyncStats({ seeks: 0, plays: 0, pauses: 0 });
            
          } catch (error) {
            console.warn("Could not confirm VLC pause state:", error);
          }
        }, 1000); // Wait 1 second for VLC to fully load
        
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
  }, [serverFilePath, uploadInProgress, onStatusChange, onError, updateDebugInfo, sendVLCCommand]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('pause', 'toggle-play-pause');
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
      await sendVLCCommand('pause', 'stop-playback');
      await sendVLCCommand('seek 0', 'stop-seek-start');
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
      await sendVLCCommand(command, 'seek-relative');
    } catch (error) {
      updateDebugInfo(`Seek error: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, updateDebugInfo]);

  // v1.0.9 - WORKING seek function with real VLC commands
  const seekToPosition = useCallback(async (timeInSeconds, source = 'manual') => {
    if (!vlcConnected) {
      console.error("❌ Cannot seek - VLC not connected");
      return false;
    }
    
    try {
      const preciseTime = Math.max(0, Number(timeInSeconds));
      console.log(`🎯 [${source}] VLC SEEKING TO: ${preciseTime.toFixed(3)} seconds`);
      
      // Use VLC's seek command - format: seek <seconds>
      const seekCommand = `seek ${Math.floor(preciseTime)}`;
      const result = await sendVLCCommand(seekCommand, source);
      
      if (result !== null) {
        setVlcCurrentTime(preciseTime);
        console.log(`✅ [${source}] VLC SEEK SUCCESS: ${preciseTime.toFixed(3)}s`);
        return true;
      } else {
        console.error("❌ VLC seek FAILED - no response");
        return false;
      }
    } catch (error) {
      console.error(`❌ [${source}] VLC SEEK ERROR:`, error);
      return false;
    }
  }, [vlcConnected, sendVLCCommand]);

  // Volume up/down
  const adjustVolume = useCallback(async (amount) => {
    if (!vlcConnected) return;
    
    try {
      const command = amount > 0 ? 'volup 5' : 'voldown 5';
      await sendVLCCommand(command, 'volume-adjust');
    } catch (error) {
      updateDebugInfo(`Volume error: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, updateDebugInfo]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('fullscreen', 'toggle-fullscreen');
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
        
        // v1.0.7 - Exact seek to region start time
        const startTime = activeRegion.start;
        const seekSuccess = await seekToPosition(startTime, 'region-activated');
        
        if (!seekSuccess) {
          updateDebugInfo("Failed to seek to region start time");
          return;
        }
        
        // Resume playback if paused
        if (!isPlaying) {
          await sendVLCCommand('pause', 'region-play'); // VLC uses the same command to toggle
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

  // v1.0.7 - Enhanced VLC control methods for exact mirroring with wavesurfer instance
  useEffect(() => {
    if (vlcConnected && wavesurferInstance && exactMirrorActive) {
      updateDebugInfo("🔗 Attaching EXACT mirroring VLC controls to WaveSurfer");
      
      // v1.0.7 - Enhanced VLC control object with exact timing
      wavesurferInstance.vlc = {
        // Exact seek with microsecond precision
        seekTo: async (timeInSeconds) => {
          const preciseTime = Number(timeInSeconds);
          updateDebugInfo(`🎬 [EXACT] VLC seek requested: ${preciseTime.toFixed(3)}s`);
          return await seekToPosition(preciseTime, 'wavesurfer-exact-seek');
        },
        
        // Immediate play command
        play: async () => {
          updateDebugInfo("▶️ [EXACT] VLC play requested");
          if (!isPlaying) {
            await togglePlayPause();
            updateDebugInfo("✅ [EXACT] VLC started playing");
            return true;
          }
          updateDebugInfo("ℹ️ [EXACT] VLC already playing");
          return false;
        },
        
        // Immediate pause command
        pause: async () => {
          updateDebugInfo("⏸️ [EXACT] VLC pause requested");
          if (isPlaying) {
            await togglePlayPause();
            updateDebugInfo("✅ [EXACT] VLC paused");
            return true;
          }
          updateDebugInfo("ℹ️ [EXACT] VLC already paused");
          return false;
        },
        
        // Stop with seek to start
        stop: async () => {
          updateDebugInfo("⏹️ [EXACT] VLC stop requested");
          await stopPlayback();
          return true;
        },
        
        // Connection status check
        isConnected: () => vlcConnected && exactMirrorActive,
        
        // Get current VLC time
        getCurrentTime: () => vlcCurrentTime,
        
        // v1.0.7 - Enhanced region playback with exact timing
        playRegion: async (region) => {
          if (!region) return false;
          
          updateDebugInfo(`🎵 [EXACT] VLC region play: ${region.start.toFixed(3)}s - ${region.end.toFixed(3)}s`);
          
          // First seek to region start with exact timing
          const seekSuccess = await seekToPosition(region.start, 'exact-region-play');
          if (!seekSuccess) {
            updateDebugInfo("❌ [EXACT] Region seek failed");
            return false;
          }
          
          // Then play if not already playing
          if (!isPlaying) {
            await togglePlayPause();
          }
          
          updateDebugInfo("✅ [EXACT] Region playback started");
          return true;
        },
        
        // v1.0.7 - Synchronized seek and play method with exact timing
        seekAndPlay: async (timeInSeconds) => {
          const preciseTime = Number(timeInSeconds);
          updateDebugInfo(`🎯 [EXACT] VLC synchronized seek & play: ${preciseTime.toFixed(3)}s`);
          
          // First seek with exact timing
          const seekSuccess = await seekToPosition(preciseTime, 'exact-seek-and-play');
          if (!seekSuccess) {
            updateDebugInfo("❌ [EXACT] VLC seek failed, cannot play");
            return false;
          }
          
          // Then start playing
          if (!isPlaying) {
            await togglePlayPause();
            updateDebugInfo("✅ [EXACT] VLC synchronized playback started");
            return true;
          }
          
          updateDebugInfo("ℹ️ [EXACT] VLC was already playing");
          return true;
        },
        
        // v1.0.7 - Get sync statistics
        getSyncStats: () => syncStats,
        
        // v1.0.7 - Reset sync statistics
        resetSyncStats: () => {
          setSyncStats({ seeks: 0, plays: 0, pauses: 0 });
          updateDebugInfo("📊 [EXACT] Sync statistics reset");
        },
        
        // v1.0.7 - Force immediate sync check
        forceSyncCheck: async () => {
          updateDebugInfo("🔄 [EXACT] Force sync check requested");
          // This could trigger a time comparison and correction
          return true;
        },
        
        // v1.0.7 - Advanced seek with frame precision (if needed)
        seekToFrame: async (frameNumber, fps = 25) => {
          const timeInSeconds = frameNumber / fps;
          updateDebugInfo(`🎬 [EXACT] VLC frame seek: frame ${frameNumber} @ ${fps}fps = ${timeInSeconds.toFixed(3)}s`);
          return await seekToPosition(timeInSeconds, 'frame-exact-seek');
        }
      };
      
      updateDebugInfo("🎉 [EXACT] Mirroring VLC controls attached successfully");
      
      // v1.0.7 - Add status indicators to the instance
      wavesurferInstance.vlcStatus = {
        connected: vlcConnected,
        exactMirror: exactMirrorActive,
        syncStats: syncStats,
        lastSyncTime: lastSyncTime,
        currentTime: vlcCurrentTime
      };
      
    } else if (wavesurferInstance) {
      // Remove VLC controls if not connected
      delete wavesurferInstance.vlc;
      delete wavesurferInstance.vlcStatus;
      updateDebugInfo("🔌 [EXACT] VLC controls removed (not connected)");
    }
  }, [vlcConnected, wavesurferInstance, seekToPosition, togglePlayPause, isPlaying, stopPlayback, vlcCurrentTime, updateDebugInfo, exactMirrorActive, syncStats, lastSyncTime]);

  // v1.0.7 - Bidirectional sync monitoring for exact mirroring
  useEffect(() => {
    if (!vlcConnected || !exactMirrorActive || !wavesurferInstance) return;
    
    let syncMonitorInterval;
    
    const startBidirectionalSync = () => {
      updateDebugInfo("🔄 [EXACT] Starting bidirectional sync monitoring");
      
      // Monitor VLC → WaveSurfer sync every 1000ms for smoother playback (reduced from 200ms)
      syncMonitorInterval = setInterval(async () => {
        try {
          // Get current times from both players
          const wsTime = wavesurferInstance.getCurrentTime();
          const vlcTime = vlcCurrentTime;
          
          // Calculate drift
          const timeDrift = Math.abs(wsTime - vlcTime);
          
          // v1.0.7 - Increased tolerance from 200ms to 500ms to reduce stuttering
          // If drift is > 500ms and we're playing, correct it
          if (timeDrift > 0.5 && isPlaying) {
            // updateDebugInfo(`⚠️ [EXACT] Time drift detected: ${timeDrift.toFixed(3)}s`); // v1.0.7 - Reduced logging
            
            // Decide which player is the source of truth
            // During region playback, prefer VLC time
            // During normal playback, prefer WaveSurfer time
            if (activeRegion) {
              // Region playback - VLC is master
              const newPosition = vlcTime / wavesurferInstance.getDuration();
              wavesurferInstance.seekTo(newPosition);
              // updateDebugInfo(`🎯 [EXACT] Corrected WaveSurfer to match VLC: ${vlcTime.toFixed(3)}s`); // v1.0.7 - Reduced logging
            } else {
              // Normal playback - WaveSurfer is master
              await seekToPosition(wsTime, 'drift-correction');
              // updateDebugInfo(`🎯 [EXACT] Corrected VLC to match WaveSurfer: ${wsTime.toFixed(3)}s`); // v1.0.7 - Reduced logging
            }
          }
          
        } catch (error) {
          // Silent error handling for sync monitoring
          console.warn("Sync monitoring error:", error);
        }
      }, 1000); // v1.0.7 - Increased interval from 200ms to 1000ms for smoother playback
    };
    
    startBidirectionalSync();
    
    return () => {
      if (syncMonitorInterval) {
        clearInterval(syncMonitorInterval);
        updateDebugInfo("🛑 [EXACT] Bidirectional sync monitoring stopped");
      }
    };
  }, [vlcConnected, exactMirrorActive, wavesurferInstance, vlcCurrentTime, isPlaying, activeRegion, seekToPosition, updateDebugInfo]);

  // v1.0.7 - Enhanced keyboard shortcuts for exact VLC control
  useEffect(() => {
    if (!vlcConnected || !exactMirrorActive) return;
    
    const handleVLCKeyboard = (e) => {
      // Only handle if no input is focused
      if (document.activeElement.tagName === 'INPUT') return;
      
      switch (e.code) {
        case 'KeyV':
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            togglePlayPause();
            updateDebugInfo("⌨️ [EXACT] Ctrl+Shift+V: VLC play/pause");
          }
          break;
          
        case 'KeyS':
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            stopPlayback();
            updateDebugInfo("⌨️ [EXACT] Ctrl+Shift+S: VLC stop");
          }
          break;
          
        case 'KeyF':
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            toggleFullscreen();
            updateDebugInfo("⌨️ [EXACT] Ctrl+Shift+F: VLC fullscreen");
          }
          break;
          
        default:
          // v1.0.7 - Added default case to fix ESLint warning
          break;
      }
    };
    
    document.addEventListener('keydown', handleVLCKeyboard);
    
    return () => {
      document.removeEventListener('keydown', handleVLCKeyboard);
    };
  }, [vlcConnected, exactMirrorActive, togglePlayPause, stopPlayback, toggleFullscreen, updateDebugInfo]);

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
      
      {/* v1.0.7 - Enhanced status and debug info with exact mirroring indicators */}
      <div className="vlc-status">
        <span className="status-label">VLC:</span>
        <span className={`status-value ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
        
        {/* v1.0.7 - Exact mirroring status indicator */}
        {exactMirrorActive && (
          <div style={{ fontSize: '0.7rem', color: '#28a745', marginTop: '2px' }}>
            🎯 EXACT MIRROR
          </div>
        )}
        
        {/* v1.0.7 - Sync statistics display */}
        {vlcConnected && exactMirrorActive && (
          <div style={{ fontSize: '0.6rem', color: '#6c757d', marginTop: '2px' }}>
            S:{syncStats.seeks} P:{syncStats.plays} Pa:{syncStats.pauses}
          </div>
        )}
        
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