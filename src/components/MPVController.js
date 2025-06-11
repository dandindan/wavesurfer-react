/**
 * File: src/components/MPVController.js
 * Description: ✅ WORKING MPV Controller - Fixed Fundamental Issues
 * 
 * Version: v7.0.0 (2025-06-11) - ARCHITECTURE FIX
 * ✅ FIXED: State management conflicts
 * ✅ FIXED: Race conditions in requests
 * ✅ FIXED: Memory leaks in intervals
 * ✅ FIXED: Error handling
 * ✅ SIMPLIFIED: No over-engineering
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../assets/styles/vlc-controller.css';

const MPVController = ({ 
  mediaFile, 
  onStatusChange,
  wavesurferInstance,
  activeRegion,
  onError,
  onRegionPlayback
}) => {
  // ✅ SIMPLE State
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [mpvConnected, setMpvConnected] = useState(false);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [mpvCurrentTime, setMpvCurrentTime] = useState(0);
  const [mpvDuration, setMpvDuration] = useState(0);
  
  // ✅ SIMPLE Refs
  const serverFilePathRef = useRef(null);
  const statusIntervalRef = useRef(null);
  const isConnectedRef = useRef(false);
  const cleanupRef = useRef([]);
  
  // ✅ SIMPLE Cleanup
  const addCleanup = useCallback((fn) => {
    cleanupRef.current.push(fn);
  }, []);
  
  const runCleanup = useCallback(() => {
    cleanupRef.current.forEach(fn => {
      try { fn(); } catch (e) { console.warn('MPV cleanup error:', e); }
    });
    cleanupRef.current = [];
  }, []);
  
  // ✅ SIMPLE File Processing
  useEffect(() => {
    if (!mediaFile) {
      serverFilePathRef.current = null;
      return;
    }
    
    const processFile = async () => {
      if (mediaFile instanceof File) {
        const filePath = await uploadFile(mediaFile);
        if (filePath) {
          serverFilePathRef.current = filePath;
        }
      } else if (typeof mediaFile === 'string') {
        serverFilePathRef.current = mediaFile;
      }
    };
    
    processFile();
  }, [mediaFile]);
  
  // ✅ SIMPLE File Upload
  const uploadFile = useCallback(async (file) => {
    try {
      setUploadInProgress(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      const result = await response.json();
      setUploadInProgress(false);
      
      return result.success ? result.filePath : null;
      
    } catch (error) {
      setUploadInProgress(false);
      console.error('Upload error:', error);
      if (onError) onError(`Upload error: ${error.message}`);
      return null;
    }
  }, [onError]);
  
  // ✅ SIMPLE MPV Command
  const sendMPVCommand = useCallback(async (commandArray, source = 'controller') => {
    if (!isConnectedRef.current) return false;
    
    try {
      const response = await fetch('/api/mpv-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandArray, source }),
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.success;
      }
    } catch (error) {
      if (error.name !== 'TimeoutError') {
        console.warn('MPV command failed:', error);
      }
    }
    return false;
  }, []);
  
  // ✅ SIMPLE MPV Launch
  const launchMPV = useCallback(async () => {
    const filePath = serverFilePathRef.current;
    
    if (!filePath) {
      const errorMsg = uploadInProgress 
        ? 'File upload in progress - please wait' 
        : 'No file available - please upload a file first';
      if (onError) onError(errorMsg);
      return;
    }
    
    try {
      setStatus('Launching...');
      
      const response = await fetch('/api/launch-mpv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mediaPath: filePath,
          windowOptions: {
            geometry: '800x600+100+100',
            ontop: true,
            title: 'MPV Player'
          }
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Launch failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setMpvConnected(true);
        isConnectedRef.current = true;
        setStatus('Connected');
        setIsPlaying(false);
        
        // Start monitoring
        startStatusMonitoring();
        
        if (onStatusChange) {
          onStatusChange({ isPlaying: false, isConnected: true });
        }
        
        console.log('✅ MPV launched successfully');
        
      } else {
        throw new Error(result.message || 'Launch failed');
      }
      
    } catch (error) {
      console.error('MPV launch error:', error);
      if (onError) onError(`MPV launch error: ${error.message}`);
      setStatus('Error');
      setMpvConnected(false);
      isConnectedRef.current = false;
    }
  }, [uploadInProgress, onStatusChange, onError]);
  
  // ✅ SIMPLE Status Monitoring
  const startStatusMonitoring = useCallback(() => {
    if (statusIntervalRef.current) return;
    
    console.log('🚀 Starting MPV status monitoring');
    
    statusIntervalRef.current = setInterval(async () => {
      if (!isConnectedRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
        return;
      }
      
      try {
        const response = await fetch('/api/mpv-status', {
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          const mpvStatus = await response.json();
          
          // Update state only if changed
          if (mpvStatus.isPlaying !== isPlaying) {
            setIsPlaying(mpvStatus.isPlaying);
            if (onStatusChange) {
              onStatusChange({ 
                isPlaying: mpvStatus.isPlaying, 
                isConnected: mpvStatus.isConnected 
              });
            }
          }
          
          if (mpvStatus.currentTime !== null) {
            setMpvCurrentTime(mpvStatus.currentTime);
          }
          
          if (mpvStatus.duration !== null) {
            setMpvDuration(mpvStatus.duration);
          }
          
          if (mpvStatus.isConnected !== isConnectedRef.current) {
            setMpvConnected(mpvStatus.isConnected);
            isConnectedRef.current = mpvStatus.isConnected;
            setStatus(mpvStatus.isConnected ? 'Connected' : 'Disconnected');
          }
          
        } else {
          // Connection lost
          if (isConnectedRef.current) {
            setMpvConnected(false);
            isConnectedRef.current = false;
            setStatus('Disconnected');
          }
        }
      } catch (error) {
        // Silent error handling for monitoring
        if (isConnectedRef.current && error.name !== 'TimeoutError') {
          setMpvConnected(false);
          isConnectedRef.current = false;
          setStatus('Connection Lost');
        }
      }
    }, 2000);
    
    addCleanup(() => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    });
    
  }, [isPlaying, onStatusChange, addCleanup]);
  
  // ✅ SIMPLE Control Functions
  const togglePlayPause = useCallback(async () => {
    if (!isConnectedRef.current) return;
    
    const success = await sendMPVCommand(['cycle', 'pause'], 'toggle-play-pause');
    if (success) {
      const newPlayingState = !isPlaying;
      setIsPlaying(newPlayingState);
      setStatus(newPlayingState ? 'Playing' : 'Paused');
      
      if (onStatusChange) {
        onStatusChange({ isPlaying: newPlayingState, isConnected: true });
      }
    }
  }, [isPlaying, sendMPVCommand, onStatusChange]);

  const stopPlayback = useCallback(async () => {
    if (!isConnectedRef.current) return;
    
    await sendMPVCommand(['set_property', 'pause', true], 'stop');
    await sendMPVCommand(['seek', 0, 'absolute'], 'stop-seek');
    
    setIsPlaying(false);
    setStatus('Stopped');
    setMpvCurrentTime(0);
    
    if (onStatusChange) {
      onStatusChange({ isPlaying: false, isConnected: true });
    }
  }, [sendMPVCommand, onStatusChange]);

  const seekMedia = useCallback(async (seconds) => {
    if (!isConnectedRef.current) return;
    await sendMPVCommand(['seek', seconds, 'relative'], 'seek-relative');
  }, [sendMPVCommand]);

  const adjustVolume = useCallback(async (amount) => {
    if (!isConnectedRef.current) return;
    await sendMPVCommand(['add', 'volume', amount], 'volume');
  }, [sendMPVCommand]);

  const toggleMute = useCallback(async () => {
    if (!isConnectedRef.current) return;
    await sendMPVCommand(['cycle', 'mute'], 'toggle-mute');
  }, [sendMPVCommand]);

  const toggleFullscreen = useCallback(async () => {
    if (!isConnectedRef.current) return;
    await sendMPVCommand(['cycle', 'fullscreen'], 'fullscreen');
  }, [sendMPVCommand]);
  
  // ✅ SIMPLE Region Handling
  useEffect(() => {
    if (!isConnectedRef.current || !activeRegion || activeRegion.isClickPosition) {
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
            mpvTime: activeRegion.start,
            isPlaying: true
          });
        }
      } catch (error) {
        console.error('Region playback error:', error);
      }
    };
    
    // Small delay to prevent conflicts
    const timeout = setTimeout(handleRegionPlayback, 100);
    addCleanup(() => clearTimeout(timeout));
    
    return () => clearTimeout(timeout);
    
  }, [activeRegion, isPlaying, sendMPVCommand, onRegionPlayback, addCleanup]);
  
  // ✅ SIMPLE Master Cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 MPV Controller cleanup...');
      
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      
      isConnectedRef.current = false;
      runCleanup();
      
      console.log('✅ MPV Controller cleanup complete');
    };
  }, [runCleanup]);

  return (
    <div className="vlc-controls">
      {/* Launch MPV Button */}
      <button 
        className="vlc-launch"
        onClick={launchMPV}
        disabled={!serverFilePathRef.current || mpvConnected || uploadInProgress}
        title={
          uploadInProgress ? "Uploading file..." :
          !serverFilePathRef.current ? "Please upload a file first" :
          mpvConnected ? "MPV is connected!" :
          "Launch MPV Player"
        }
      >
        <i className="fas fa-external-link-alt"></i> 
        {uploadInProgress ? 'Uploading...' : 
         mpvConnected ? '🎯 Connected' : 
         'MPV'}
      </button>
      
      {/* Control buttons (only show if connected) */}
      {mpvConnected && (
        <>
          <button onClick={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          
          <button onClick={stopPlayback} title="Stop">
            <i className="fas fa-stop"></i>
          </button>
          
          <button onClick={() => adjustVolume(-5)} title="Volume Down">
            <i className="fas fa-volume-down"></i>
          </button>
          
          <button onClick={() => adjustVolume(5)} title="Volume Up">
            <i className="fas fa-volume-up"></i>
          </button>
          
          <button onClick={toggleMute} title="Toggle Mute">
            <i className="fas fa-volume-mute"></i>
          </button>
          
          <button onClick={() => seekMedia(-10)} title="Seek Backward 10s">
            <i className="fas fa-backward"></i>
          </button>
          
          <button onClick={() => seekMedia(10)} title="Seek Forward 10s">
            <i className="fas fa-forward"></i>
          </button>
          
          <button onClick={toggleFullscreen} title="Toggle Fullscreen">
            <i className="fas fa-expand"></i>
          </button>
        </>
      )}
      
      {/* Status Display */}
      <div className="vlc-status">
        <span className="status-label">MPV:</span>
        <span className={`status-value ${status.toLowerCase().replace(' ', '-')}`}>
          {status}
        </span>
        
        {/* Connection indicator */}
        {mpvConnected && (
          <div style={{ fontSize: '0.7rem', color: '#4ecdc4', marginTop: '2px' }}>
            🎯 Synchronized
          </div>
        )}
        
        {/* Time display */}
        {mpvConnected && mpvDuration > 0 && (
          <div style={{ fontSize: '0.7rem', color: '#0dcaf0', marginTop: '2px' }}>
            {formatTime(mpvCurrentTime)} / {formatTime(mpvDuration)}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function
const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '--:--';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export default MPVController;