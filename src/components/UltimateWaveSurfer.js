// src/components/UltimateWaveSurfer.js - COMPLETE WORKING VERSION
import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram.js';
import MinimapPlugin from 'wavesurfer.js/dist/plugins/minimap.js';
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.js';
import { useAudioSyncStore } from '../store/audioSyncStore';

const UltimateWaveSurfer = ({ 
  audioUrl, 
  className = "",
  height = 200,
  onRegionClick,
  onTimeUpdate,
  onReady 
}) => {
  const containerRef = useRef(null);
  const minimapRef = useRef(null);
  
  // 🎯 Global state management
  const { 
    isPlaying, 
    currentTime, 
    playbackRate,
    zoomLevel,
    isMuted,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setLoading,
    setStatus,
    activeRegion,
    setActiveRegion,
    addRegion
  } = useAudioSyncStore();

  // 🚀 Create regions plugin SEPARATELY (following official example)
  const regions = useMemo(() => RegionsPlugin.create(), []);

  // 🎨 Random color generator for regions
  const randomColor = useCallback(() => {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
  }, []);

  // 🎯 All plugins including regions
  const plugins = useMemo(() => [
    regions,
    TimelinePlugin.create({
      height: 30,
      timeInterval: 1,
      primaryColor: '#ffffff',
      secondaryColor: '#aaaaaa'
    }),
    SpectrogramPlugin.create({
      labels: true,
      height: 200,
      splitChannels: false,
      colorMap: 'roseus',
      scale: 'linear',
      frequencyMax: 8000
    }),
    HoverPlugin.create({
      lineColor: '#ff5722',
      lineWidth: 2,
      labelBackground: '#333',
      labelColor: '#fff',
      formatTimeCallback: (seconds) => `${seconds.toFixed(3)}s`
    }),
    MinimapPlugin.create({
      container: minimapRef.current || undefined,
      height: 50,
      waveColor: '#777',
      progressColor: '#08c3f2'
    })
  ], [regions]);

  // 🎯 useWavesurfer hook
  const { wavesurfer, isReady, currentTime: wsCurrentTime } = useWavesurfer({
    container: containerRef,
    height,
    waveColor: '#4a9eff',
    progressColor: '#08c3f2',
    cursorColor: '#ff5722',
    cursorWidth: 2,
    normalize: true,
    responsive: true,
    hideScrollbar: true,
    url: audioUrl,
    plugins
  });

  // 🎯 Setup regions after decode (following official example)
  useEffect(() => {
    if (!wavesurfer || !isReady) return;

    const setupRegions = () => {
      console.log('🎵 Setting up regions after decode');
      
      try {
        // Enable drag selection (official pattern)
        regions.enableDragSelection({
          color: 'rgba(74, 158, 255, 0.1)',
        });

        // Set up event handlers (official pattern)
        let activeRegionRef = null;

        // Region clicked - play and change color
        regions.on('region-clicked', (region, e) => {
          e.stopPropagation();
          console.log('🎵 Region clicked:', region);
          
          activeRegionRef = region;
          setActiveRegion(region);
          
          // Play the region (official pattern)
          region.play(true);
          
          // Change color on click (official pattern)
          region.setOptions({ color: randomColor() });
          
          // Update global state
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            wavesurfer.seekTo(region.start / duration);
            setCurrentTime(region.start);
          }
          
          if (onRegionClick) onRegionClick(region);
        });

        // Region created
        regions.on('region-created', (region) => {
          console.log('🎵 Region created:', region);
          addRegion(region);
          setStatus(`Region created: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s`);
        });

        // Region updated
        regions.on('region-updated', (region) => {
          console.log('🎵 Region updated:', region);
          setActiveRegion(region);
        });

        // Region playback events (official pattern)
        regions.on('region-in', (region) => {
          console.log('🎵 Region in:', region);
          activeRegionRef = region;
        });
        
        regions.on('region-out', (region) => {
          console.log('🎵 Region out:', region);
          if (activeRegionRef === region) {
            // Optional: enable looping
            // region.play();
            activeRegionRef = null;
          }
        });

        // Reset active region on waveform click (official pattern)
        wavesurfer.on('interaction', () => {
          activeRegionRef = null;
          setActiveRegion(null);
        });

        console.log('✅ Regions setup complete');
      } catch (error) {
        console.error('❌ Error setting up regions:', error);
      }
    };

    // Wait for decode or setup immediately if ready
    if (wavesurfer.getDuration() > 0) {
      setupRegions();
    } else {
      wavesurfer.once('decode', setupRegions);
    }

    // Cleanup function
    return () => {
      try {
        regions.off('region-clicked');
        regions.off('region-created');
        regions.off('region-updated');
        regions.off('region-in');
        regions.off('region-out');
        wavesurfer.off('interaction');
      } catch (error) {
        console.warn('Region cleanup error:', error);
      }
    };
  }, [wavesurfer, isReady, regions, setActiveRegion, addRegion, setStatus, setCurrentTime, onRegionClick, randomColor]);

  // 🎯 Handle wavesurfer ready
  useEffect(() => {
    if (isReady && wavesurfer) {
      console.log('🎯 WaveSurfer is ready!');
      
      setDuration(wavesurfer.getDuration() || 0);
      setLoading(false);
      setStatus('🎯 Ultimate WaveSurfer ready!');
      
      // Apply settings
      try {
        if (playbackRate !== 1.0) {
          wavesurfer.setPlaybackRate(playbackRate);
        }
        if (zoomLevel !== 100) {
          wavesurfer.zoom(zoomLevel);
        }
        if (isMuted) {
          wavesurfer.setVolume(0);
        }
      } catch (error) {
        console.warn('Error applying settings:', error);
      }
      
      if (onReady) onReady(wavesurfer);
    }
  }, [isReady, wavesurfer, setDuration, setLoading, setStatus, playbackRate, zoomLevel, isMuted, onReady]);

  // 🎯 Ultimate API
  useEffect(() => {
    if (wavesurfer && isReady) {
      wavesurfer.ultimate = {
        // Core controls
        seekTo: (time) => {
          try {
            const duration = wavesurfer.getDuration();
            if (duration > 0 && time >= 0) {
              wavesurfer.seekTo(time / duration);
              setCurrentTime(time);
            }
          } catch (error) {
            console.error('Error seeking:', error);
          }
        },
        
        getCurrentTime: () => {
          try {
            return wavesurfer.getCurrentTime() || 0;
          } catch (error) {
            return 0;
          }
        },
        
        getDuration: () => {
          try {
            return wavesurfer.getDuration() || 0;
          } catch (error) {
            return 0;
          }
        },
        
        isPlaying: () => {
          try {
            return wavesurfer.isPlaying() || false;
          } catch (error) {
            return false;
          }
        },
        
        play: () => {
          try {
            wavesurfer.play();
            setIsPlaying(true);
          } catch (error) {
            console.error('Error playing:', error);
          }
        },
        
        pause: () => {
          try {
            wavesurfer.pause();
            setIsPlaying(false);
          } catch (error) {
            console.error('Error pausing:', error);
          }
        },
        
        playPause: () => {
          try {
            wavesurfer.playPause();
            setIsPlaying(wavesurfer.isPlaying());
          } catch (error) {
            console.error('Error in playPause:', error);
          }
        },
        
        // Region controls
        createRegion: (start, end, options = {}) => {
          try {
            return regions.addRegion({
              start,
              end,
              color: randomColor(),
              drag: true,
              resize: true,
              ...options
            });
          } catch (error) {
            console.error('Error creating region:', error);
            return null;
          }
        },
        
        clearAllRegions: () => {
          try {
            regions.clearRegions();
            setActiveRegion(null);
            setStatus('All regions cleared');
          } catch (error) {
            console.error('Error clearing regions:', error);
          }
        },
        
        getRegions: () => {
          try {
            return regions.getRegions() || [];
          } catch (error) {
            return [];
          }
        },
        
        // Utility
        setVolume: (volume) => {
          try {
            wavesurfer.setVolume(Math.max(0, Math.min(1, volume)));
          } catch (error) {
            console.error('Error setting volume:', error);
          }
        },
        
        zoom: (level) => {
          try {
            wavesurfer.zoom(Math.max(1, level));
          } catch (error) {
            console.error('Error zooming:', error);
          }
        },
        
        // Debug
        getDebugInfo: () => ({
          isReady,
          duration: wavesurfer?.getDuration() || 0,
          currentTime: wavesurfer?.getCurrentTime() || 0,
          isPlaying: wavesurfer?.isPlaying() || false,
          regionsCount: regions?.getRegions()?.length || 0
        })
      };
      
      // Global access for debugging
      if (process.env.NODE_ENV === 'development') {
        window.ultimateWaveSurfer = wavesurfer;
        console.log('🎯 Ultimate WaveSurfer API ready');
      }
    }
  }, [wavesurfer, isReady, regions, setCurrentTime, setIsPlaying, setActiveRegion, setStatus, randomColor]);

  // 🔄 Sync time updates
  useEffect(() => {
    if (wsCurrentTime !== undefined) {
      setCurrentTime(wsCurrentTime);
      if (onTimeUpdate) onTimeUpdate(wsCurrentTime);
    }
  }, [wsCurrentTime, setCurrentTime, onTimeUpdate]);

  // 🎯 Sync playback controls
  useEffect(() => {
    if (!wavesurfer || !isReady) return;
    
    try {
      const wsIsPlaying = wavesurfer.isPlaying();
      
      if (isPlaying && !wsIsPlaying) {
        wavesurfer.play();
      } else if (!isPlaying && wsIsPlaying) {
        wavesurfer.pause();
      }
    } catch (error) {
      console.warn('Playback sync error:', error);
    }
  }, [isPlaying, wavesurfer, isReady]);

  // 🔧 Control sync effects
  useEffect(() => {
    if (!wavesurfer || !isReady) return;
    
    try {
      wavesurfer.zoom(zoomLevel);
    } catch (error) {
      console.warn('Zoom error:', error);
    }
  }, [zoomLevel, wavesurfer, isReady]);

  useEffect(() => {
    if (!wavesurfer || !isReady) return;
    
    try {
      wavesurfer.setPlaybackRate(playbackRate);
    } catch (error) {
      console.warn('Playback rate error:', error);
    }
  }, [playbackRate, wavesurfer, isReady]);

  useEffect(() => {
    if (!wavesurfer || !isReady) return;
    
    try {
      wavesurfer.setVolume(isMuted ? 0 : 1);
    } catch (error) {
      console.warn('Volume error:', error);
    }
  }, [isMuted, wavesurfer, isReady]);

  // 🎯 Format time helper
  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`ultimate-wavesurfer ${className}`}>
      {/* 🎯 Main waveform container */}
      <div 
        ref={containerRef} 
        className="waveform-container"
        style={{
          width: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#1a1a1a',
          border: '2px solid transparent',
          background: 'linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(45deg, #4a9eff, #08c3f2) border-box'
        }}
      />
      
      {/* 🗺️ Minimap container */}
      <div 
        ref={minimapRef} 
        className="minimap-container"
        style={{
          width: '100%',
          marginTop: '10px',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#2a2a2a',
          border: '1px solid #333'
        }}
      />
      
      {/* 📊 Real-time info display */}
      {isReady && (
        <div className="wavesurfer-info" style={{
          marginTop: '10px',
          padding: '8px 12px',
          backgroundColor: '#333',
          borderRadius: '4px',
          fontSize: '0.9rem',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <span>
            ⏱️ {formatTime(wsCurrentTime)} / {formatTime(wavesurfer?.getDuration() || 0)}
          </span>
          <span>
            🎵 Rate: {playbackRate.toFixed(1)}x | 🔍 Zoom: {zoomLevel}px/s
          </span>
          <span className={`status ${wavesurfer?.isPlaying() ? 'playing' : 'paused'}`}>
            {wavesurfer?.isPlaying() ? '▶️ Playing' : '⏸️ Paused'}
          </span>
          {activeRegion && (
            <span style={{ color: '#4a9eff' }}>
              📊 Region: {activeRegion.start.toFixed(2)}s - {activeRegion.end.toFixed(2)}s
            </span>
          )}
          <span style={{ color: '#4caf50', fontSize: '0.8rem' }}>
            🎨 Regions: {regions?.getRegions()?.length || 0} | Drag to create!
          </span>
        </div>
      )}
    </div>
  );
};

export default UltimateWaveSurfer;