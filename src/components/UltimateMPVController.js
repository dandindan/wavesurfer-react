// src/components/UltimateMPVController.js - Updated with Single Row Layout & Combined Play/Pause
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
  
  // 🎮 Control methods for UI
  const controls = {
    playPause: async () => {
      try {
        await queueCommand(['cycle', 'pause'], 'high');
        console.log('🎮 MPV play/pause toggled');
      } catch (error) {
        console.error('Play/pause error:', error);
      }
    },
    stop: async () => {
      try {
        await Promise.all([
          queueCommand(['set_property', 'pause', true], 'high'),
          queueCommand(['seek', 0, 'absolute'], 'high')
        ]);
        console.log('🎮 MPV stopped');
      } catch (error) {
        console.error('Stop error:', error);
      }
    },
    seekRelative: async (seconds) => {
      try {
        await queueCommand(['seek', seconds, 'relative'], 'high');
        console.log(`🎮 MPV seek ${seconds}s`);
      } catch (error) {
        console.error('Seek error:', error);
      }
    },
    setVolume: async (volume) => {
      try {
        await queueCommand(['set_property', 'volume', volume]);
        console.log(`🎮 MPV volume: ${volume}`);
      } catch (error) {
        console.error('Volume error:', error);
      }
    },
    toggleMute: async () => {
      try {
        await queueCommand(['cycle', 'mute']);
        console.log('🎮 MPV mute toggled');
      } catch (error) {
        console.error('Mute error:', error);
      }
    },
    toggleFullscreen: async () => {
      try {
        await queueCommand(['cycle', 'fullscreen']);
        console.log('🎮 MPV fullscreen toggled');
      } catch (error) {
        console.error('Fullscreen error:', error);
      }
    }
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
      {/* 🎮 Single Row Controls Layout */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
      }}>
        
        {/* 🚀 Launch Button */}
        <button 
          className={`mpv-launch ${mpvConnected ? 'connected' : ''}`}
          onClick={launchMPV}
          disabled={!serverFilePathRef.current || mpvConnected}
          title={mpvConnected ? "Ultimate MPV Connected & Synced!" : "Launch Ultimate MPV Player"}
          style={{
            background: mpvConnected 
              ? 'linear-gradient(145deg, #4caf50, #66bb6a)' 
              : 'linear-gradient(145deg, #f44336, #e57373)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: !serverFilePathRef.current || mpvConnected ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: mpvConnected 
              ? '0 4px 15px rgba(76, 175, 80, 0.4)' 
              : '0 4px 15px rgba(244, 67, 54, 0.4)',
            opacity: !serverFilePathRef.current ? 0.5 : 1
          }}
        >
          {mpvConnected ? '🎯 MPV CONNECTED' : '🚀 LAUNCH MPV'}
        </button>

        {/* 🎮 Playback Controls - Only show when connected */}
        {mpvConnected && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: '1',
            justifyContent: 'center'
          }}>
            
            {/* Combined Play/Pause Button - Same style as WaveSurfer */}
            <button 
              onClick={controls.playPause}
              title="Play/Pause (Space)"
              style={{
                background: isPlaying 
                  ? 'linear-gradient(145deg, #4caf50, #66bb6a)' 
                  : 'linear-gradient(145deg, #4a9eff, #08c3f2)',
                color: 'white',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '100px',
                justifyContent: 'center',
                boxShadow: isPlaying 
                  ? '0 4px 15px rgba(76, 175, 80, 0.4)' 
                  : '0 4px 15px rgba(74, 158, 255, 0.4)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px) scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0) scale(1)';
              }}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            {/* Stop Button */}
            <button 
              onClick={controls.stop}
              title="Stop"
              style={{
                background: 'linear-gradient(145deg, #666, #555)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '1.1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                boxShadow: '0 4px 15px rgba(102, 102, 102, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.background = 'linear-gradient(145deg, #777, #666)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.background = 'linear-gradient(145deg, #666, #555)';
              }}
            >
              <i className="fas fa-stop"></i>
            </button>

            {/* Seek Backward */}
            <button 
              onClick={() => controls.seekRelative(-10)}
              title="Seek Back 10s"
              style={{
                background: 'linear-gradient(145deg, #4a9eff, #08c3f2)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '1.1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                boxShadow: '0 4px 15px rgba(74, 158, 255, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <i className="fas fa-backward"></i>
            </button>

            {/* Seek Forward */}
            <button 
              onClick={() => controls.seekRelative(10)}
              title="Seek Forward 10s"
              style={{
                background: 'linear-gradient(145deg, #4a9eff, #08c3f2)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '1.1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                boxShadow: '0 4px 15px rgba(74, 158, 255, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <i className="fas fa-forward"></i>
            </button>

            {/* Volume Down */}
            <button 
              onClick={() => controls.setVolume(Math.max(0, 70))}
              title="Volume Down"
              style={{
                background: 'linear-gradient(145deg, #ff9800, #ffb74d)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                boxShadow: '0 4px 15px rgba(255, 152, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <i className="fas fa-volume-down"></i>
            </button>

            {/* Volume Up */}
            <button 
              onClick={() => controls.setVolume(100)}
              title="Volume Up"
              style={{
                background: 'linear-gradient(145deg, #ff9800, #ffb74d)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                boxShadow: '0 4px 15px rgba(255, 152, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <i className="fas fa-volume-up"></i>
            </button>

            {/* Mute Toggle */}
            <button 
              onClick={controls.toggleMute}
              title="Toggle Mute"
              style={{
                background: 'linear-gradient(145deg, #f44336, #e57373)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                boxShadow: '0 4px 15px rgba(244, 67, 54, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <i className="fas fa-volume-mute"></i>
            </button>

            {/* Fullscreen */}
            <button 
              onClick={controls.toggleFullscreen}
              title="Toggle Fullscreen"
              style={{
                background: 'linear-gradient(145deg, #9c27b0, #ba68c8)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <i className="fas fa-expand"></i>
            </button>
          </div>
        )}

        {/* 📊 Status Display */}
        {mpvConnected && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontSize: '0.85rem',
            color: '#b0b0b0',
            minWidth: '120px'
          }}>
            <div style={{
              color: '#4caf50',
              fontWeight: '600',
              marginBottom: '2px'
            }}>
              🎯 SYNCED
            </div>
            <div style={{ color: '#4a9eff' }}>
              {isPlaying ? '▶️ Playing' : '⏸️ Paused'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UltimateMPVController;