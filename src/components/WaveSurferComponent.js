/**
 * File: src/components/WaveSurferComponent.js
 * Description: WaveSurfer component with enhanced MPV real-time synchronization
 * 
 * Version History:
 * v1.0.17 (2025-06-10) - Enhanced MPV integration replacing VLC - Human Request
 * v1.0.18 (2025-06-10) - CRITICAL FIX: Eliminated infinite loops causing MPV stuttering - Human Request
 * v1.0.19 (2025-06-10) - CLEAN UI + RESTORE PERFECT MIRROR SYNC - Human Request
 *   - REMOVED visual clutter and overlapping elements
 *   - REMOVED console spam (no time-pos flooding)  
 *   - RESTORED perfect bidirectional mirroring
 *   - KEPT mute button (user requested)
 *   - MAINTAINED version control history
 *   - FIXED duplicate function declaration
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import '../assets/styles/main.css';

const WaveSurferComponent = ({ 
  audioFile, 
  isPlaying, 
  loopRegions = true,
  dragSelection = true, 
  zoomLevel = 100,
  playbackSpeed = 1.0,
  isMuted = false,
  onPlayPause, 
  onReady,
  onRegionActivated
}) => {
  // Refs
  const containerRef = useRef(null);
  const minimapRef = useRef(null);
  const activeRegionRef = useRef(null);
  const lastZoomLevelRef = useRef(zoomLevel);
  const lastPlaybackSpeedRef = useRef(playbackSpeed);
  const currentAudioFileRef = useRef(null);
  const pluginsReadyRef = useRef(false);
  
  // State (minimal)
  const [loading, setLoading] = useState(true);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [mpvConnected, setMpvConnected] = useState(false);
  
  // Initialize WaveSurfer
  const { wavesurfer, currentTime, isReady } = useWavesurfer({
    container: containerRef,
    height: 180,
    waveColor: '#b8b8b8',
    progressColor: '#08c3f2',
    cursorColor: '#ff5722',
    cursorWidth: 2,
    minPxPerSec: 100,
    url: audioUrl,
    normalize: true,
    autoScroll: true,
    autoCenter: true,
  });

  // Region colors
  const DEFAULT_REGION_COLOR = 'rgba(70, 130, 180, 0.3)';
  const ACTIVE_REGION_COLOR = 'rgba(34, 197, 94, 0.6)';
  
  // 🎯 SIMPLE region color update
  const updateRegionColors = useCallback(() => {
    if (!wavesurfer?.regions) return;
    
    try {
      const allRegions = wavesurfer.regions.getRegions();
      allRegions.forEach(region => {
        region.setOptions({
          color: region === activeRegionRef.current ? ACTIVE_REGION_COLOR : DEFAULT_REGION_COLOR
        });
      });
    } catch (error) {
      console.error("Region color error:", error);
    }
  }, [wavesurfer]);
  
  // 🚀 SIMPLE MPV command (no spam, no over-engineering)
  const sendMPVCommand = useCallback(async (commandArray, source = 'user') => {
    if (!mpvConnected) return false;
    
    try {
      const response = await fetch('/api/mpv-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandArray })
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.success;
      }
      return false;
    } catch (error) {
      console.error("MPV command error:", error);
      return false;
    }
  }, [mpvConnected]);
  
  // 🎯 PERFECT MIRROR: MPV → WaveSurfer real-time sync
  const startMPVToWaveSurferMirror = useCallback(() => {
    if (!mpvConnected || !wavesurfer) return;
    
    const syncInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/mpv-status');
        if (response.ok) {
          const mpvStatus = await response.json();
          
          // 🎯 MIRROR: MPV time → WaveSurfer position  
          if (mpvStatus.currentTime !== null) {
            const duration = wavesurfer.getDuration();
            if (duration > 0) {
              const wsCurrentTime = wavesurfer.getCurrentTime();
              const timeDiff = Math.abs(mpvStatus.currentTime - wsCurrentTime);
              
              // Only sync if difference > 0.5s to avoid micro-adjustments
              if (timeDiff > 0.5) {
                const progress = mpvStatus.currentTime / duration;
                wavesurfer.seekTo(progress);
              }
            }
          }
          
          // 🎯 MIRROR: MPV play state → WaveSurfer
          if (mpvStatus.isPlaying !== undefined) {
            const wsIsPlaying = wavesurfer.isPlaying();
            if (mpvStatus.isPlaying && !wsIsPlaying) {
              wavesurfer.play();
            } else if (!mpvStatus.isPlaying && wsIsPlaying) {
              wavesurfer.pause();
            }
          }
        }
      } catch (error) {
        // Silent error - don't spam console
      }
    }, 1000); // Check every 1 second for smooth mirroring
    
    return () => clearInterval(syncInterval);
  }, [mpvConnected, wavesurfer]);
  
  // Handle audio file changes (CLEAN)
  useEffect(() => {
    if (currentAudioFileRef.current === audioFile) return;
    
    // Clean up previous URL
    if (currentAudioFileRef.current?.startsWith?.('blob:')) {
      URL.revokeObjectURL(currentAudioFileRef.current);
    }
    
    // Reset states
    setLoading(true);
    setIsAudioLoaded(false);
    activeRegionRef.current = null;
    pluginsReadyRef.current = false;
    setMpvConnected(false);
    
    // Set new audio
    if (audioFile) {
      if (audioFile instanceof File) {
        const newUrl = URL.createObjectURL(audioFile);
        setAudioUrl(newUrl);
        currentAudioFileRef.current = newUrl;
      } else {
        setAudioUrl(audioFile);
        currentAudioFileRef.current = audioFile;
      }
    } else {
      setAudioUrl(null);
      currentAudioFileRef.current = null;
    }
  }, [audioFile]);
  
  // 🎯 PERFECT MIRROR region handlers
  const handleRegionIn = useCallback((region) => {
    if (activeRegionRef.current !== region) {
      activeRegionRef.current = region;
      updateRegionColors();
    }
    
    // 🎯 PERFECT MIRROR: Region entry → instant MPV seek
    if (wavesurfer?.mpvMirror?.isConnected()) {
      wavesurfer.mpvMirror.seekTo(region.start);
    }
  }, [updateRegionColors, wavesurfer]);
  
  const handleRegionOut = useCallback((region) => {
    if (activeRegionRef.current === region && loopRegions) {
      region.play();
      // 🎯 PERFECT MIRROR: Region loop → instant MPV loop
      if (wavesurfer?.mpvMirror?.isConnected()) {
        wavesurfer.mpvMirror.seekTo(region.start);
      }
    } else if (activeRegionRef.current === region) {
      activeRegionRef.current = null;
      updateRegionColors();
    }
  }, [loopRegions, wavesurfer, updateRegionColors]);
  
  const handleRegionClick = useCallback((region, e) => {
    e.stopPropagation();
    
    activeRegionRef.current = region;
    updateRegionColors();
    
    // 🎯 PERFECT MIRROR: Region click → instant MPV seek and play
    if (wavesurfer?.mpvMirror?.isConnected()) {
      wavesurfer.mpvMirror.seekTo(region.start);
      if (!wavesurfer?.isPlaying()) {
        wavesurfer.mpvMirror.play();
      }
    }
    
    region.play(true);
    
    if (onPlayPause) onPlayPause(true);
    if (onRegionActivated) onRegionActivated(region);
  }, [onPlayPause, onRegionActivated, updateRegionColors, wavesurfer]);
  
  const handleRegionUpdated = useCallback((region) => {
    activeRegionRef.current = region;
    updateRegionColors();
    
    // 🎯 PERFECT MIRROR: Region update → instant MPV sync
    if (wavesurfer?.mpvMirror?.isConnected()) {
      wavesurfer.mpvMirror.seekTo(region.start);
    }
    
    if (onRegionActivated) onRegionActivated(region);
  }, [onRegionActivated, updateRegionColors, wavesurfer]);
  
  const handleWaveformClick = useCallback((event) => {
    if (activeRegionRef.current) {
      activeRegionRef.current = null;
      updateRegionColors();
    }
    
    // 🎯 PERFECT MIRROR: Waveform click → instant MPV seek
    if (wavesurfer && event?.relativeX && wavesurfer.mpvMirror?.isConnected()) {
      const duration = wavesurfer.getDuration();
      if (duration > 0) {
        const clickTime = event.relativeX * duration;
        wavesurfer.mpvMirror.seekTo(clickTime);
      }
    }
  }, [updateRegionColors, wavesurfer]);
  
  // 🚀 PERFECT MPV mirror sync setup
  useEffect(() => {
    if (wavesurfer && isReady && isAudioLoaded) {
      console.log("🎯 Setting up PERFECT MPV mirror sync...");
      
      // Check for MPV connection and set up mirroring
      const checkMPVAndSetupMirror = async () => {
        try {
          const response = await fetch('/api/mpv-status');
          if (response.ok) {
            const status = await response.json();
            if (status.isConnected) {
              setMpvConnected(true);
              
              // 🎯 PERFECT MIRROR: Attach MPV control methods to WaveSurfer
              wavesurfer.mpvMirror = {
                seekTo: (time) => sendMPVCommand(['seek', time, 'absolute']),
                play: () => sendMPVCommand(['set_property', 'pause', false]),
                pause: () => sendMPVCommand(['set_property', 'pause', true]),
                setSpeed: (speed) => sendMPVCommand(['set_property', 'speed', speed]),
                isConnected: () => mpvConnected
              };
              
              // 🎯 PERFECT MIRROR: Start real-time MPV → WaveSurfer sync
              startMPVToWaveSurferMirror();
              
              console.log("✅ PERFECT MPV mirror sync established!");
            }
          }
        } catch (error) {
          console.warn("MPV connection check failed:", error);
        }
      };
      
      checkMPVAndSetupMirror();
      
      // Keep checking for MPV connection
      const connectionInterval = setInterval(checkMPVAndSetupMirror, 2000);
      
      return () => clearInterval(connectionInterval);
    }
  }, [wavesurfer, isReady, isAudioLoaded, mpvConnected, sendMPVCommand, startMPVToWaveSurferMirror]);
  
  // 🚀 SIMPLE plugin setup (no over-engineering)
  useEffect(() => {
    if (!wavesurfer || !isReady || pluginsReadyRef.current) return;
    
    pluginsReadyRef.current = true;
    
    const setupPlugins = async () => {
      try {
        // Clear minimap
        if (minimapRef.current) {
          minimapRef.current.innerHTML = '';
        }
        
        // Import plugins
        const [
          { default: Timeline },
          { default: Spectrogram },
          { default: Regions },
          { default: Minimap },
          { default: Hover }
        ] = await Promise.all([
          import('wavesurfer.js/dist/plugins/timeline.js'),
          import('wavesurfer.js/dist/plugins/spectrogram.js'),
          import('wavesurfer.js/dist/plugins/regions.js'),
          import('wavesurfer.js/dist/plugins/minimap.js'),
          import('wavesurfer.js/dist/plugins/hover.js')
        ]);
        
        // Create and register plugins
        const regionsPlugin = Regions.create();
        wavesurfer.registerPlugin(regionsPlugin);
        
        const timelinePlugin = Timeline.create({
          height: 30,
          timeInterval: 1,
          primaryColor: '#ffffff',
          secondaryColor: '#aaaaaa',
          primaryFontColor: '#ffffff',
          secondaryFontColor: '#dddddd',
        });
        wavesurfer.registerPlugin(timelinePlugin);
        
        const spectrogramPlugin = Spectrogram.create({
          labels: true,
          height: 350,
          splitChannels: false,
          colorMap: 'roseus',
          frequencyMax: 8000,
          frequencyMin: 0,
          fftSamples: 512,
          noverlap: 0,
        });
        wavesurfer.registerPlugin(spectrogramPlugin);
        
        const hoverPlugin = Hover.create({
          lineColor: '#ff5722',
          lineWidth: 2,
          labelBackground: '#111111',
          labelColor: '#ffffff',
        });
        wavesurfer.registerPlugin(hoverPlugin);
        
        const minimapPlugin = Minimap.create({
          container: minimapRef.current,
          height: 40,
          waveColor: '#b8b8b8',
          progressColor: '#08c3f2',
        });
        wavesurfer.registerPlugin(minimapPlugin);
        
        // Enable drag selection
        regionsPlugin.enableDragSelection({
          color: DEFAULT_REGION_COLOR,
        });
        
        // SIMPLE event listeners
        regionsPlugin.on('region-in', handleRegionIn);
        regionsPlugin.on('region-out', handleRegionOut);
        regionsPlugin.on('region-clicked', handleRegionClick);
        regionsPlugin.on('region-updated', handleRegionUpdated);
        
        wavesurfer.on('interaction', handleWaveformClick);
        
        // 🎯 PERFECT MIRROR seeking events
        wavesurfer.on('seeking', (currentTime) => {
          if (wavesurfer.mpvMirror?.isConnected()) {
            wavesurfer.mpvMirror.seekTo(currentTime);
          }
        });
        
        wavesurfer.on('play', () => {
          if (wavesurfer.mpvMirror?.isConnected()) {
            wavesurfer.mpvMirror.play();
          }
        });
        
        wavesurfer.on('pause', () => {
          if (wavesurfer.mpvMirror?.isConnected()) {
            wavesurfer.mpvMirror.pause();
          }
        });
        
        // 🎯 PERFECT MIRROR plugin click events
        timelinePlugin.on?.('click', (time) => {
          if (wavesurfer.mpvMirror?.isConnected()) {
            wavesurfer.mpvMirror.seekTo(time);
          }
        });
        
        spectrogramPlugin.on?.('click', (frequency, time) => {
          if (wavesurfer.mpvMirror?.isConnected()) {
            wavesurfer.mpvMirror.seekTo(time);
          }
        });
        
        minimapPlugin.on?.('click', (time) => {
          if (wavesurfer.mpvMirror?.isConnected()) {
            wavesurfer.mpvMirror.seekTo(time);
          }
        });
        
        // Helper methods
        wavesurfer.regions = regionsPlugin;
        wavesurfer.getActiveRegion = () => activeRegionRef.current;
        wavesurfer.clearAllRegions = () => {
          try {
            regionsPlugin.clearRegions();
            activeRegionRef.current = null;
            return true;
          } catch (error) {
            console.error("Clear regions error:", error);
            return false;
          }
        };
        
        wavesurfer.createRegion = (options = {}) => {
          try {
            const regionOptions = {
              color: DEFAULT_REGION_COLOR,
              drag: true,
              resize: true,
              ...options
            };
            
            const region = regionsPlugin.addRegion(regionOptions);
            
            // 🎯 PERFECT MIRROR region creation sync
            if (regionOptions.start !== undefined && wavesurfer.mpvMirror?.isConnected()) {
              wavesurfer.mpvMirror.seekTo(regionOptions.start);
            }
            
            return region;
          } catch (error) {
            console.error("Create region error:", error);
            return null;
          }
        };
        
        setLoading(false);
        setIsAudioLoaded(true);
        
        if (onReady) onReady(wavesurfer);
        
      } catch (error) {
        console.error("Plugin setup error:", error);
        pluginsReadyRef.current = false;
      }
    };
    
    setTimeout(setupPlugins, 100);
    
  }, [wavesurfer, isReady, onReady, handleRegionIn, handleRegionOut, handleRegionClick, handleRegionUpdated, handleWaveformClick]);
  
  // 🎯 PERFECT MIRROR playback status sync
  useEffect(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    try {
      const wsIsPlaying = wavesurfer.isPlaying();
      
      if (isPlaying && !wsIsPlaying) {
        wavesurfer.play();
        // 🎯 PERFECT MIRROR: WaveSurfer play → MPV play
        if (wavesurfer.mpvMirror?.isConnected()) {
          wavesurfer.mpvMirror.play();
        }
      } else if (!isPlaying && wsIsPlaying) {
        wavesurfer.pause();
        // 🎯 PERFECT MIRROR: WaveSurfer pause → MPV pause  
        if (wavesurfer.mpvMirror?.isConnected()) {
          wavesurfer.mpvMirror.pause();
        }
      }
    } catch (error) {
      console.error("Playback sync error:", error);
    }
  }, [isPlaying, wavesurfer, isReady, isAudioLoaded]);
  
  // SIMPLE zoom
  useEffect(() => {
    if (!isAudioLoaded || !isReady || !wavesurfer) return;
    
    if (lastZoomLevelRef.current !== zoomLevel) {
      lastZoomLevelRef.current = zoomLevel;
      try {
        wavesurfer.zoom(zoomLevel);
      } catch (error) {
        console.error("Zoom error:", error);
      }
    }
  }, [zoomLevel, isAudioLoaded, isReady, wavesurfer]);
  
  // 🎯 PERFECT MIRROR speed change
  useEffect(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    if (lastPlaybackSpeedRef.current !== playbackSpeed) {
      lastPlaybackSpeedRef.current = playbackSpeed;
      
      try {
        wavesurfer.setPlaybackRate(playbackSpeed);
        
        // 🎯 PERFECT MIRROR: Speed change → instant MPV speed sync
        if (wavesurfer.mpvMirror?.isConnected()) {
          wavesurfer.mpvMirror.setSpeed(playbackSpeed);
        }
      } catch (error) {
        console.error("Speed sync error:", error);
      }
    }
  }, [playbackSpeed, wavesurfer, isReady, isAudioLoaded]);
  
  // Manual mute control (WaveSurfer only)
  useEffect(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    try {
      if (isMuted) {
        wavesurfer.setVolume(0);
      } else {
        wavesurfer.setVolume(1);
      }
    } catch (error) {
      console.error("Volume error:", error);
    }
  }, [isMuted, wavesurfer, isReady, isAudioLoaded]);
  
  // 🎯 PERFECT MIRROR Play/Pause handler
  const handlePlayPause = useCallback(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    try {
      const currentlyPlaying = wavesurfer.isPlaying();
      
      if (activeRegionRef.current) {
        // 🎯 PERFECT MIRROR: Region playback with instant MPV sync
        activeRegionRef.current.play();
        
        if (wavesurfer.mpvMirror?.isConnected()) {
          wavesurfer.mpvMirror.seekTo(activeRegionRef.current.start);
          wavesurfer.mpvMirror.play();
        }
      } else {
        // 🎯 PERFECT MIRROR: Normal playback with instant MPV sync
        wavesurfer.playPause();
        
        if (wavesurfer.mpvMirror?.isConnected()) {
          if (currentlyPlaying) {
            wavesurfer.mpvMirror.pause();
          } else {
            wavesurfer.mpvMirror.play();
          }
        }
      }
      
      if (onPlayPause) {
        onPlayPause(!currentlyPlaying);
      }
    } catch (error) {
      console.error("Play/pause error:", error);
    }
  }, [wavesurfer, isReady, isAudioLoaded, onPlayPause]);
  
  // 🎯 PERFECT MIRROR keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!wavesurfer || !isReady || !isAudioLoaded) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
        return;
      }
      
      if (!wavesurfer.mpvMirror?.isConnected()) return;
      
      switch (e.code) {
        case 'ArrowLeft':
          if (e.ctrlKey) {
            e.preventDefault();
            const currentTime = wavesurfer.getCurrentTime();
            const newTime = Math.max(0, currentTime - 5);
            const duration = wavesurfer.getDuration();
            if (duration > 0) {
              wavesurfer.seekTo(newTime / duration);
              // 🎯 PERFECT MIRROR: Keyboard seek → instant MPV sync
              wavesurfer.mpvMirror.seekTo(newTime);
            }
          }
          break;
          
        case 'ArrowRight':
          if (e.ctrlKey) {
            e.preventDefault();
            const currentTime = wavesurfer.getCurrentTime();
            const duration = wavesurfer.getDuration();
            if (duration > 0) {
              const newTime = Math.min(duration, currentTime + 5);
              wavesurfer.seekTo(newTime / duration);
              // 🎯 PERFECT MIRROR: Keyboard seek → instant MPV sync
              wavesurfer.mpvMirror.seekTo(newTime);
            }
          }
          break;
          
        case 'Home':
          e.preventDefault();
          wavesurfer.seekTo(0);
          // 🎯 PERFECT MIRROR: Home key → instant MPV sync
          wavesurfer.mpvMirror.seekTo(0);
          break;
          
        case 'End':
          e.preventDefault();
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            wavesurfer.seekTo(0.99);
            // 🎯 PERFECT MIRROR: End key → instant MPV sync
            wavesurfer.mpvMirror.seekTo(duration * 0.99);
          }
          break;
          
        default:
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePlayPause, wavesurfer, isReady, isAudioLoaded]);
  
  return (
    <div className="waveform-wrapper">
      {/* CLEAN - NO OVERLAPPING ELEMENTS! */}
      
      {/* Single container for waveform, spectrogram and timeline */}
      <div id="waveform-container" ref={containerRef} style={{
        width: '100%',
        marginBottom: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '5px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
        position: 'relative',
        height: '560px',
        overflow: 'visible'
      }}>
        {/* Loading spinner overlay */}
        {loading && (
          <div id="spectrogram-loading" className="loading-container">
            <div className="simple-spinner"></div>
            <div className="loading-text">Loading Audio...</div>
          </div>
        )}
        
        {/* Message when no audio is loaded */}
        {!loading && !isAudioLoaded && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#6c757d'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              <i className="fas fa-music"></i>
            </div>
            <h3>No Audio Loaded</h3>
            <p>Upload an audio file to visualize the waveform and spectrogram.</p>
          </div>
        )}
      </div>
      
      {/* Minimap for navigation */}
      <div id="minimap" ref={minimapRef} style={{
        width: '100%',
        height: '40px',
        marginBottom: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '5px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)'
      }}></div>
      
      {/* CLEAN time display */}
      {isReady && isAudioLoaded && (
        <div className="current-time" style={{ textAlign: 'center', marginBottom: '10px' }}>
          Time: {formatTime(currentTime)} / {formatTime(wavesurfer?.getDuration() || 0)}
          {mpvConnected && (
            <span style={{ marginLeft: '15px', color: '#4ecdc4', fontSize: '0.8rem' }}>
              🎯 MPV Synced
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to format time in MM:SS
const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '--:--';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export default WaveSurferComponent;