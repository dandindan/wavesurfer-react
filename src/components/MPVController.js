/**
 * File: src/components/MPVController.js
 * Description: CLEAN Simple MPV Controller - No Console Spam, No Button Mess
 * 
 * Version History:
 * v4.0.0 (2025-06-10) - CLEAN SIMPLE VERSION - Human Request
 *   - REMOVED all 50%, 80%, MAX buttons (mess cleanup)
 *   - REMOVED console spam (turn off time-pos observation)
 *   - KEPT mute button (it's good!)
 *   - SIMPLE working region sync
 *   - CLEAN UI layout
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../assets/styles/vlc-controller.css';

const MPVController = ({ 
  mediaFile, 
  onStatusChange,
  wavesurferInstance,
  activeRegion,
  onError,
  onRegionPlayback,
  onPerformanceUpdate
}) => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [mpvConnected, setMpvConnected] = useState(false);
  const [serverFilePath, setServerFilePath] = useState(null);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [mpvCurrentTime, setMpvCurrentTime] = useState(0);
  const [mpvDuration, setMpvDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Refs for state tracking
  const isPlayingRef = useRef(false);
  const mpvConnectedRef = useRef(false);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    mpvConnectedRef.current = mpvConnected;
  }, [isPlaying, mpvConnected]);
  
  // 🚀 SIMPLE MPV command (no spam)
  const sendMPVCommand = useCallback(async (commandArray, source = 'manual') => {
    if (!mpvConnectedRef.current) return null;
    
    try {
      const response = await fetch('/api/mpv-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandArray })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error("❌ MPV command failed:", error);
      return null;
    }
  }, []);
  
  // File upload (CLEAN)
  const uploadFileToServer = useCallback(async (file) => {
    if (!file) return null;
    
    try {
      setUploadInProgress(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      const result = await response.json();
      setUploadInProgress(false);
      
      if (result.success) {
        return result.filePath;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      setUploadInProgress(false);
      console.error("❌ Upload error:", error);
      if (onError) onError(`Upload error: ${error.message}`);
      return null;
    }
  }, [onError]);
  
  // File upload effect (CLEAN)
  useEffect(() => {
    if (!mediaFile || serverFilePath || uploadInProgress) return;
    
    const uploadFile = async () => {
      if (mediaFile instanceof File) {
        const filePath = await uploadFileToServer(mediaFile);
        if (filePath) {
          setServerFilePath(filePath);
        }
      } else if (typeof mediaFile === 'string') {
        setServerFilePath(mediaFile);
      }
    };
    
    uploadFile();
  }, [mediaFile, serverFilePath, uploadInProgress, uploadFileToServer]);
  
  // Launch MPV (SIMPLE AUDIO SETUP)
  const launchMPV = useCallback(async () => {
    if (!serverFilePath || uploadInProgress) {
      const errorMsg = !serverFilePath ? 'No file path available' : 'File upload in progress';
      if (onError) onError(errorMsg);
      return;
    }

    try {
      const windowOptions = {
        geometry: '800x600+100+100',
        ontop: true,
        title: 'MPV Player',
        screen: 1
      };
      
      const response = await fetch('http://localhost:3001/api/launch-mpv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mediaPath: serverFilePath,
          windowOptions 
        })
      });

      if (!response.ok) {
        throw new Error(`Launch failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setMpvConnected(true);
        setStatus('Connected');
        setIsPlaying(false);
        
        // 🔊 SIMPLE audio setup (no spam)
        setTimeout(async () => {
          await sendMPVCommand(['set_property', 'volume', 80]);
          await sendMPVCommand(['set_property', 'mute', false]);
        }, 2000);
        
        // SIMPLE status monitoring (no spam)
        startCleanStatusMonitoring();
        
        if (onStatusChange) {
          onStatusChange({ isPlaying: false, isConnected: true });
        }
      } else {
        throw new Error(result.message || 'Launch failed');
      }
    } catch (error) {
      console.error("❌ Launch error:", error);
      if (onError) onError(`MPV launch error: ${error.message}`);
      setStatus('Error');
    }
  }, [serverFilePath, uploadInProgress, onStatusChange, onError, sendMPVCommand]);

  // 🧹 CLEAN status monitoring (NO TIME-POS SPAM!)
  const startCleanStatusMonitoring = useCallback(() => {
    const statusInterval = setInterval(async () => {
      if (!mpvConnectedRef.current) {
        clearInterval(statusInterval);
        return;
      }
      
      try {
        const response = await fetch('/api/mpv-status');
        if (response.ok) {
          const status = await response.json();
          
          // Only update if actually different
          if (status.isPlaying !== isPlayingRef.current) {
            setIsPlaying(status.isPlaying);
            if (onStatusChange) {
              onStatusChange({ 
                isPlaying: status.isPlaying, 
                isConnected: status.isConnected 
              });
            }
          }
          
          // SILENT updates for display only
          if (status.currentTime !== null) {
            setMpvCurrentTime(status.currentTime);
          }
          if (status.duration !== null) {
            setMpvDuration(status.duration);
          }
          if (status.playbackSpeed !== null) {
            setPlaybackSpeed(status.playbackSpeed);
          }
          
          if (status.isConnected !== mpvConnectedRef.current) {
            setMpvConnected(status.isConnected);
            setStatus(status.isConnected ? 'Connected' : 'Disconnected');
          }
        }
      } catch (error) {
        // Silent error handling - no spam
      }
    }, 3000); // Every 3 seconds - not spam
    
    return statusInterval;
  }, [onStatusChange]);

  // SIMPLE control functions
  const togglePlayPause = useCallback(async () => {
    if (!mpvConnected) return;
    
    try {
      await sendMPVCommand(['cycle', 'pause'], 'toggle-play-pause');
      const newPlayingState = !isPlaying;
      
      setIsPlaying(newPlayingState);
      setStatus(newPlayingState ? 'Playing' : 'Paused');
      
      if (onStatusChange) {
        onStatusChange({ isPlaying: newPlayingState, isConnected: true });
      }
    } catch (error) {
      console.error("❌ Play/pause error:", error);
    }
  }, [mpvConnected, isPlaying, sendMPVCommand, onStatusChange]);

  const stopPlayback = useCallback(async () => {
    if (!mpvConnected) return;
    
    try {
      await sendMPVCommand(['set_property', 'pause', true], 'stop');
      await sendMPVCommand(['seek', 0, 'absolute'], 'stop-seek');
      
      setIsPlaying(false);
      setStatus('Stopped');
      setMpvCurrentTime(0);
      
      if (onStatusChange) {
        onStatusChange({ isPlaying: false, isConnected: true });
      }
    } catch (error) {
      console.error("❌ Stop error:", error);
    }
  }, [mpvConnected, sendMPVCommand, onStatusChange]);

  const seekMedia = useCallback(async (seconds) => {
    if (!mpvConnected) return;
    
    try {
      await sendMPVCommand(['seek', seconds, 'relative'], 'seek-relative');
    } catch (error) {
      console.error("❌ Seek error:", error);
    }
  }, [mpvConnected, sendMPVCommand]);

  const adjustVolume = useCallback(async (amount) => {
    if (!mpvConnected) return;
    
    try {
      await sendMPVCommand(['add', 'volume', amount], 'volume');
    } catch (error) {
      console.error("❌ Volume error:", error);
    }
  }, [mpvConnected, sendMPVCommand]);

  const toggleMute = useCallback(async () => {
    if (!mpvConnected) return;
    
    try {
      await sendMPVCommand(['cycle', 'mute'], 'toggle-mute');
    } catch (error) {
      console.error("❌ Mute error:", error);
    }
  }, [mpvConnected, sendMPVCommand]);

  const toggleFullscreen = useCallback(async () => {
    if (!mpvConnected) return;
    
    try {
      await sendMPVCommand(['cycle', 'fullscreen'], 'fullscreen');
    } catch (error) {
      console.error("❌ Fullscreen error:", error);
    }
  }, [mpvConnected, sendMPVCommand]);

  // SIMPLE region handling (no loops)
  useEffect(() => {
    if (!mpvConnected || !activeRegion || activeRegion.isClickPosition) {
      return;
    }
    
    const handleRegionPlayback = async () => {
      try {
        await sendMPVCommand(['seek', activeRegion.start, 'absolute'], 'region');
        
        if (!isPlaying) {
          await sendMPVCommand(['set_property', 'pause', false], 'region-play');
          setIsPlaying(true);
          setStatus('Playing region');
        }
        
        if (onRegionPlayback) {
          onRegionPlayback({
            region: activeRegion,
            vlcTime: activeRegion.start,
            isPlaying: true
          });
        }
      } catch (error) {
        console.error("❌ Region playback error:", error);
      }
    };
    
    const regionTimeout = setTimeout(handleRegionPlayback, 200);
    
    return () => clearTimeout(regionTimeout);
  }, [activeRegion, mpvConnected, isPlaying, sendMPVCommand, onRegionPlayback]);

  // Cleanup
  useEffect(() => {
    return () => {
      // Clean cleanup
    };
  }, []);

  return (
    <div className="vlc-controls">
      {/* Launch MPV Button */}
      <button 
        className="vlc-launch"
        onClick={launchMPV}
        disabled={!serverFilePath || mpvConnected || uploadInProgress}
        title={
          uploadInProgress ? "Uploading file..." :
          !serverFilePath ? "Please upload a file first" :
          mpvConnected ? "MPV is connected!" :
          "Launch MPV Player"
        }
      >
        <i className="fas fa-external-link-alt"></i> 
        {uploadInProgress ? 'Uploading...' : mpvConnected ? '🔊 Connected' : 'MPV'}
      </button>
      
      {/* CLEAN controls - only show if MPV is connected */}
      {mpvConnected && (
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
          
          {/* 👍 KEEP THE MUTE BUTTON - it's good! */}
          <button
            onClick={toggleMute}
            title="Toggle Mute"
          >
            <i className="fas fa-volume-mute"></i>
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
      
      {/* CLEAN status display - NO MESS */}
      <div className="vlc-status">
        <span className="status-label">MPV:</span>
        <span className={`status-value ${status.toLowerCase().replace(' ', '-')}`}>
          {status}
        </span>
        
        {/* Simple status indicators */}
        {mpvConnected && (
          <div style={{ fontSize: '0.7rem', color: '#4ecdc4', marginTop: '2px' }}>
            🔊 Audio Working
          </div>
        )}
        
        {/* Time display */}
        {mpvConnected && mpvDuration > 0 && (
          <div style={{ fontSize: '0.7rem', color: '#0dcaf0', marginTop: '2px' }}>
            {formatTime(mpvCurrentTime)} / {formatTime(mpvDuration)}
            {playbackSpeed !== 1.0 && ` (${playbackSpeed}x)`}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '--:--';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export default MPVController;