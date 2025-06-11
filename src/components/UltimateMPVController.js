// src/components/UltimateMPVController.js
import React, { useEffect, useCallback, useRef } from 'react';
import { useAudioSyncStore } from '../store/audioSyncStore';

const UltimateMPVController = ({ 
  onStatusChange,
  onError 
}) => {
  const {
    audioFile,
    mpvConnected,
    setMpvConnected,
    setMpvState,
    activeRegion,
    isPlaying,
    currentTime,
    playbackRate,
    setStatus,
    setError
  } = useAudioSyncStore();
  
  const serverFilePathRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const commandQueueRef = useRef([]);
  const processingCommandRef = useRef(false);
  const abortControllerRef = useRef(null);
  
  // 🚀 Professional command queue system (prevents conflicts)
  const queueCommand = useCallback(async (commandArray, priority = 'normal') => {
    return new Promise((resolve, reject) => {
      const command = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        command: commandArray,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      // High priority commands go to front
      if (priority === 'high') {
        commandQueueRef.current.unshift(command);
      } else {
        commandQueueRef.current.push(command);
      }
      
      processCommandQueue();
    });
  }, []);
  
  // ⚡ Ultra-fast command processing
  const processCommandQueue = useCallback(async () => {
    if (processingCommandRef.current || commandQueueRef.current.length === 0) {
      return;
    }
    
    processingCommandRef.current = true;
    
    try {
      while (commandQueueRef.current.length > 0) {
        const command = commandQueueRef.current.shift();
        
        try {
          // Create abort controller for this request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch('/api/mpv-command', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Priority': command.priority,
              'X-Command-ID': command.id
            },
            body: JSON.stringify({ 
              command: command.command,
              source: 'ultimate-controller',
              priority: command.priority,
              timestamp: command.timestamp
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const result = await response.json();
            command.resolve(result);
          } else {
            const errorText = await response.text();
            command.reject(new Error(`MPV command failed: ${response.status} - ${errorText}`));
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            command.reject(new Error('Command timeout'));
          } else {
            command.reject(error);
          }
        }
        
        // Small delay between commands to prevent MPV flooding
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    } finally {
      processingCommandRef.current = false;
    }
  }, []);
  
  // 📁 Professional file upload with progress
  const uploadFile = useCallback(async (file) => {
    if (!file) return null;
    
    try {
      setStatus(`📁 Uploading ${file.name}...`);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setStatus(`✅ Upload complete: ${file.name}`);
        return result.filePath;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload error: ${error.message}`);
      return null;
    }
  }, [setStatus, setError]);
  
  // 📁 Process audio file for MPV
  useEffect(() => {
    const processFile = async () => {
      if (!audioFile) {
        serverFilePathRef.current = null;
        return;
      }
      
      if (audioFile instanceof File) {
        const filePath = await uploadFile(audioFile);
        serverFilePathRef.current = filePath;
      } else {
        serverFilePathRef.current = audioFile;
      }
    };
    
    processFile();
  }, [audioFile, uploadFile]);
  
  // 🚀 Ultimate MPV launch function
  const launchMPV = useCallback(async () => {
    const filePath = serverFilePathRef.current;
    
    if (!filePath) {
      const errorMsg = 'No file available - please upload a file first';
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return false;
    }
    
    try {
      setStatus('🚀 Launching Ultimate MPV...');
      
      // Abort any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/launch-mpv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaPath: filePath,
          windowOptions: {
            geometry: '900x600+100+100',
            ontop: true,
            title: '🎯 Ultimate MPV - Synced with WaveSurfer'
          }
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Launch failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setMpvConnected(true);
        setStatus('🎯 Ultimate MPV connected - Perfect sync active!');
        
        // Initialize MPV with optimal settings
        await Promise.all([
          queueCommand(['set_property', 'pause', true], 'high'),
          queueCommand(['set_property', 'volume', 85], 'high'),
          queueCommand(['set_property', 'mute', false], 'high'),
          queueCommand(['set_property', 'speed', 1.0], 'high'),
          queueCommand(['set_property', 'hr-seek', 'yes'], 'high')
        ]);
        
        // Start sync monitoring
        startSyncMonitoring();
        
        if (onStatusChange) {
          onStatusChange({ isConnected: true, isPlaying: false });
        }
        
        console.log('🎯 Ultimate MPV launched successfully!');
        return true;
      } else {
        throw new Error(result.message || 'Launch failed');
      }
    } catch (error) {
      if (error.name === 'AbortError') return false;
      
      console.error('MPV launch error:', error);
      const errorMsg = `MPV launch error: ${error.message}`;
      setError(errorMsg);
      if (onError) onError(errorMsg);
      setMpvConnected(false);
      return false;
    }
  }, [onError, onStatusChange, setMpvConnected, setStatus, setError, queueCommand]);
  
  // 🔄 Professional sync monitoring system
  const startSyncMonitoring = useCallback(() => {
    if (syncIntervalRef.current) return;
    
    console.log('🔄 Starting ultimate sync monitoring...');
    
    syncIntervalRef.current = setInterval(async () => {
      if (!mpvConnected) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
        return;
      }
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const response = await fetch('/api/mpv-properties', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const { properties } = await response.json();
          
          if (properties) {
            setMpvState({
              currentTime: properties.timePos,
              duration: properties.duration,
              isPlaying: properties.isPlaying
            });
          }
        }
      } catch (error) {
        // Silent monitoring - only log non-timeout errors
        if (error.name !== 'AbortError' && error.name !== 'TimeoutError') {
          console.warn('Sync monitoring error:', error);
        }
      }
    }, 800); // 800ms interval for smooth sync
  }, [mpvConnected, setMpvState]);
  
  // 🎯 Bidirectional sync - WaveSurfer to MPV
  useEffect(() => {
    if (!mpvConnected) return;
    
    const syncToMPV = async () => {
      try {
        // Sync time position with high precision
        await queueCommand(['seek', currentTime, 'absolute'], 'high');
        
        // Sync play state
        await queueCommand(['set_property', 'pause', !isPlaying], 'high');
        
        // Sync playback rate
        await queueCommand(['set_property', 'speed', playbackRate], 'normal');
        
      } catch (error) {
        console.warn('WaveSurfer to MPV sync failed:', error);
      }
    };
    
    // Debounce sync to prevent command flooding
    const debounceTimer = setTimeout(syncToMPV, 100);
    return () => clearTimeout(debounceTimer);
  }, [currentTime, isPlaying, playbackRate, mpvConnected, queueCommand]);
  
  // 🎵 Region playback sync
  useEffect(() => {
    if (!mpvConnected || !activeRegion) return;
    
    const playRegion = async () => {
      try {
        console.log(`🎵 Playing region: ${activeRegion.start}s - ${activeRegion.end}s`);
        
        // Seek to region start with frame accuracy
        await queueCommand(['seek', activeRegion.start, 'absolute', 'exact'], 'high');
        
        // Start playback if not already playing
        if (!isPlaying) {
          await queueCommand(['set_property', 'pause', false], 'high');
        }
        
        setStatus(`🎵 Playing region: ${activeRegion.start.toFixed(2)}s - ${activeRegion.end.toFixed(2)}s`);
      } catch (error) {
        console.warn('Region playback failed:', error);
      }
    };
    
    playRegion();
  }, [activeRegion, mpvConnected, isPlaying, queueCommand, setStatus]);
  
  // 🎮 Control methods for UI
  const controls = {
    play: () => queueCommand(['set_property', 'pause', false], 'high'),
    pause: () => queueCommand(['set_property', 'pause', true], 'high'),
    stop: () => Promise.all([
      queueCommand(['set_property', 'pause', true], 'high'),
      queueCommand(['seek', 0, 'absolute'], 'high')
    ]),
    seekTo: (time) => queueCommand(['seek', time, 'absolute', 'exact'], 'high'),
    seekRelative: (seconds) => queueCommand(['seek', seconds, 'relative'], 'high'),
    setVolume: (volume) => queueCommand(['set_property', 'volume', volume]),
    setSpeed: (speed) => queueCommand(['set_property', 'speed', speed]),
    toggleMute: () => queueCommand(['cycle', 'mute']),
    toggleFullscreen: () => queueCommand(['cycle', 'fullscreen']),
    screenshot: () => queueCommand(['screenshot'])
  };
  
  // 🧹 Cleanup system
  useEffect(() => {
    return () => {
      console.log('🧹 Ultimate MPV Controller cleanup...');
      
      // Clear sync monitoring
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Clear command queue
      commandQueueRef.current.forEach(cmd => {
        cmd.reject(new Error('Component unmounted'));
      });
      commandQueueRef.current = [];
      
      console.log('✅ Ultimate MPV Controller cleanup complete');
    };
  }, []);
  
  return (
    <div className="ultimate-mpv-controller">
      {/* 🚀 Launch button */}
      <button 
        className={`mpv-launch ${mpvConnected ? 'connected' : ''}`}
        onClick={launchMPV}
        disabled={!serverFilePathRef.current || mpvConnected}
        title={mpvConnected ? "Ultimate MPV Connected & Synced!" : "Launch Ultimate MPV Player"}
      >
        {mpvConnected ? '🎯 MPV SYNCED' : '🚀 LAUNCH MPV'}
      </button>
      
      {/* 🎮 Control buttons - only show when connected */}
      {mpvConnected && (
        <div className="mpv-controls">
          <button onClick={controls.play} title="Play" className="control-btn">
            <i className="fas fa-play"></i>
          </button>
          <button onClick={controls.pause} title="Pause" className="control-btn">
            <i className="fas fa-pause"></i>
          </button>
          <button onClick={controls.stop} title="Stop" className="control-btn">
            <i className="fas fa-stop"></i>
          </button>
          <button onClick={() => controls.seekRelative(-10)} title="Seek Back 10s" className="control-btn">
            <i className="fas fa-backward"></i>
          </button>
          <button onClick={() => controls.seekRelative(10)} title="Seek Forward 10s" className="control-btn">
            <i className="fas fa-forward"></i>
          </button>
          <button onClick={controls.toggleMute} title="Toggle Mute" className="control-btn">
            <i className="fas fa-volume-mute"></i>
          </button>
          <button onClick={controls.toggleFullscreen} title="Fullscreen" className="control-btn">
            <i className="fas fa-expand"></i>
          </button>
          <button onClick={controls.screenshot} title="Screenshot" className="control-btn">
            <i className="fas fa-camera"></i>
          </button>
        </div>
      )}
      
      {/* 📊 Status display */}
      <div className="mpv-status">
        <div className={`status-indicator ${mpvConnected ? 'connected' : 'disconnected'}`}>
          <span className="status-icon">
            {mpvConnected ? '🟢' : '🔴'}
          </span>
          <span className="status-text">
            {mpvConnected ? 'ULTIMATE SYNC ACTIVE' : 'Disconnected'}
          </span>
        </div>
        
        {mpvConnected && (
          <div className="sync-info">
            <span className="sync-accuracy">
              {Math.abs(currentTime - useAudioSyncStore.getState().mpvCurrentTime) < 0.05 ? 
                '✅ Perfect Sync' : 
                `⚠️ ${Math.abs(currentTime - useAudioSyncStore.getState().mpvCurrentTime * 1000).toFixed(0)}ms drift`
              }
            </span>
            <span className="command-queue">
              Queue: {commandQueueRef.current.length} commands
            </span>
          </div>
        )}
      </div>
      
      {/* 🎯 Pro tip display */}
      {mpvConnected && (
        <div className="pro-tips">
          <details>
            <summary>🎯 Pro Tips</summary>
            <div className="tips-content">
              <div>• Click regions for instant sync playback</div>
              <div>• Drag on waveform to create new regions</div>
              <div>• Use keyboard shortcuts for quick control</div>
              <div>• MPV window stays on top for easy monitoring</div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default UltimateMPVController;