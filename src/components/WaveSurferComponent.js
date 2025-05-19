/**
 * File: src/components/WaveSurferComponent.js
 * Description: WaveSurfer component using the official @wavesurfer/react hook
 * 
 * Version History:
 * v1.0.0 (2025-05-19) - Implementation using @wavesurfer/react
 * v1.0.1 (2025-05-19) - Fixed loading spinner and plugin issues
 * v1.0.2 (2025-05-19) - Fixed infinite update loop and duplicate plugins
 * v1.0.3 (2025-05-19) - Fixed zoom error, region looping and drag selection issues
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import '../assets/styles/main.css';

const WaveSurferComponent = ({ 
  audioFile, 
  isPlaying, 
  loopRegions,
  dragSelection,
  zoomLevel,
  playbackSpeed,
  onPlayPause, 
  onReady
}) => {
  // Refs
  const containerRef = useRef(null);
  const minimapRef = useRef(null);
  const pluginsInitializedRef = useRef(false);
  const regionsPluginRef = useRef(null);
  const activeRegionRef = useRef(null);
  
  // State
  const [loading, setLoading] = useState(true);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  
  // Show loading spinner immediately when audio file changes
  useEffect(() => {
    if (audioFile) {
      setLoading(true);
      setIsAudioLoaded(false);
      // Reset plugins initialized flag when audio changes
      pluginsInitializedRef.current = false;
    }
  }, [audioFile]);
  
  // Convert File to URL if needed
  useEffect(() => {
    if (audioFile) {
      if (audioFile instanceof File) {
        const url = URL.createObjectURL(audioFile);
        setAudioUrl(url);
        
        // Clean up URL when component unmounts or audio changes
        return () => {
          URL.revokeObjectURL(url);
        };
      } else {
        setAudioUrl(audioFile);
      }
    } else {
      setAudioUrl(null);
    }
  }, [audioFile]);
  
  // Initialize WaveSurfer with useWavesurfer hook
  const { wavesurfer, currentTime, isReady } = useWavesurfer({
    container: containerRef,
    height: 180,
    waveColor: '#b8b8b8',
    progressColor: '#08c3f2',
    cursorColor: '#ff5722',
    cursorWidth: 2,
    minPxPerSec: 100, // Start with default zoom - will update later
    url: audioUrl,
    normalize: true,
    autoScroll: true,
    autoCenter: true,
  });
  
  // Reset region color handler - won't cause re-renders
  const resetRegionColors = useCallback(() => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin) return;
    
    try {
      const allRegions = regionsPlugin.getRegions();
      Object.values(allRegions).forEach((region) => {
        if (region.id !== (activeRegionRef.current?.id)) {
          region.setOptions({ color: 'rgba(0,0,255,0.4)' });
        }
      });
    } catch (error) {
      console.error("Error resetting region colors:", error);
    }
  }, []);
  
  // Handle region in event - won't cause re-renders
  const handleRegionIn = useCallback((region) => {
    console.log('region-in', region);
    activeRegionRef.current = region;
  }, []);
  
  // Handle region out event - won't cause re-renders
  const handleRegionOut = useCallback((region) => {
    console.log('region-out', region);
    
    // Only replay if this is the active region and looping is enabled
    if (region === activeRegionRef.current && loopRegions) {
      try {
        region.play();
      } catch (error) {
        console.error("Error replaying region:", error);
      }
    } else if (region === activeRegionRef.current) {
      activeRegionRef.current = null;
    }
  }, [loopRegions]);
  
  // Handle region click event - won't cause re-renders
  const handleRegionClick = useCallback((region, e) => {
    try {
      e.stopPropagation();
      
      // Set as active region
      activeRegionRef.current = region;
      
      // Reset all region colors
      resetRegionColors();
      
      // Set this region to active color
      region.setOptions({ color: 'rgba(0,255,0,0.2)' });
      
      // Play the region
      region.play();
    } catch (error) {
      console.error("Error handling region click:", error);
    }
  }, [resetRegionColors]);
  
  // Handle waveform click - won't cause re-renders
  const handleWaveformClick = useCallback(() => {
    activeRegionRef.current = null;
  }, []);
  
  // Setup or update regions
  const updateRegions = useCallback(() => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin) return;
    
    try {
      // Clear existing event listeners to prevent duplicates
      regionsPlugin.un('region-in', handleRegionIn);
      regionsPlugin.un('region-out', handleRegionOut);
      regionsPlugin.un('region-clicked', handleRegionClick);
      
      // Add event listeners
      regionsPlugin.on('region-in', handleRegionIn);
      regionsPlugin.on('region-out', handleRegionOut);
      regionsPlugin.on('region-clicked', handleRegionClick);
      
      // Update drag selection
      if (dragSelection) {
        regionsPlugin.disableDragSelection(); // Clear any existing
        regionsPlugin.enableDragSelection({
          color: 'rgba(0,0,255,0.4)'
        });
      } else {
        regionsPlugin.disableDragSelection();
      }
    } catch (error) {
      console.error("Error updating regions:", error);
    }
  }, [handleRegionIn, handleRegionOut, handleRegionClick, dragSelection]);
  
  // Initialize plugins manually AFTER wavesurfer is ready
  useEffect(() => {
    if (!wavesurfer || !isReady || !minimapRef.current) return;
    
    // Only run once per wavesurfer instance
    if (pluginsInitializedRef.current) {
      // Just update region settings if necessary
      updateRegions();
      return;
    }
    
    console.log("Initializing plugins...");
    
    // Import plugins dynamically and initialize
    const initializePlugins = async () => {
      try {
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
        
        // Add Timeline
        const timelinePlugin = Timeline.create({
          height: 30,
          timeInterval: 1,
          primaryColor: '#ffffff',
          secondaryColor: '#aaaaaa',
          primaryFontColor: '#ffffff',
          secondaryFontColor: '#dddddd',
        });
        wavesurfer.registerPlugin(timelinePlugin);
        
        // Add Spectrogram
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
        
        // Add Hover
        const hoverPlugin = Hover.create({
          lineColor: '#ff5722',
          lineWidth: 2,
          labelBackground: '#111111',
          labelColor: '#ffffff',
        });
        wavesurfer.registerPlugin(hoverPlugin);
        
        // Add Minimap
        const minimapPlugin = Minimap.create({
          container: minimapRef.current,
          height: 40,
          waveColor: '#b8b8b8',
          progressColor: '#08c3f2',
        });
        wavesurfer.registerPlugin(minimapPlugin);
        
        // Add Regions
        const regionsPlugin = Regions.create();
        wavesurfer.registerPlugin(regionsPlugin);
        
        // Store regions plugin reference
        regionsPluginRef.current = regionsPlugin;
        
        // Add waveform click handler
        wavesurfer.on('interaction', handleWaveformClick);
        
        // Setup regions
        updateRegions();
        
        // Mark as initialized
        pluginsInitializedRef.current = true;
        
        console.log("Plugins initialized successfully");
      } catch (error) {
        console.error("Error initializing plugins:", error);
      }
    };
    
    initializePlugins();
    
  }, [wavesurfer, isReady, updateRegions, handleWaveformClick]);
  
  // Update loading state
  useEffect(() => {
    if (isReady) {
      setLoading(false);
      setIsAudioLoaded(true);
      
      // Notify parent component that wavesurfer is ready
      if (onReady) {
        onReady(wavesurfer);
      }
    }
  }, [isReady, wavesurfer, onReady]);
  
  // Update playback status
  useEffect(() => {
    if (wavesurfer && isReady) {
      try {
        const wsIsPlaying = wavesurfer.isPlaying();
        
        if (isPlaying && !wsIsPlaying) {
          wavesurfer.play();
        } else if (!isPlaying && wsIsPlaying) {
          wavesurfer.pause();
        }
      } catch (error) {
        console.error("Error updating playback status:", error);
      }
    }
  }, [isPlaying, wavesurfer, isReady]);
  
  // Safe zoom function - prevent errors
  const safeZoom = useCallback((level) => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    try {
      wavesurfer.zoom(level);
    } catch (error) {
      console.warn("Zoom error - audio may not be fully loaded yet:", error);
    }
  }, [wavesurfer, isReady, isAudioLoaded]);
  
  // Update zoom level - but only after audio is fully loaded
  useEffect(() => {
    if (isAudioLoaded && isReady && wavesurfer) {
      // Use a small timeout to ensure audio is fully processed
      const zoomTimer = setTimeout(() => {
        safeZoom(zoomLevel);
      }, 100);
      
      return () => clearTimeout(zoomTimer);
    }
  }, [zoomLevel, isAudioLoaded, isReady, wavesurfer, safeZoom]);
  
  // Update drag selection
  useEffect(() => {
    updateRegions();
  }, [dragSelection, updateRegions]);
  
  // Update playback speed
  useEffect(() => {
    if (wavesurfer && isReady && isAudioLoaded && playbackSpeed) {
      try {
        wavesurfer.setPlaybackRate(playbackSpeed);
      } catch (error) {
        console.error("Error setting playback speed:", error);
      }
    }
  }, [playbackSpeed, wavesurfer, isReady, isAudioLoaded]);
  
  // Play/Pause handler
  const handlePlayPause = useCallback(() => {
    if (wavesurfer && isReady && isAudioLoaded) {
      try {
        wavesurfer.playPause();
        if (onPlayPause) {
          onPlayPause(!wavesurfer.isPlaying());
        }
      } catch (error) {
        console.error("Error toggling play/pause:", error);
      }
    }
  }, [wavesurfer, isReady, isAudioLoaded, onPlayPause]);
  
  // Add global play/pause keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && wavesurfer && isReady && isAudioLoaded) {
        e.preventDefault();
        handlePlayPause();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [wavesurfer, isReady, isAudioLoaded, handlePlayPause]);
  
  return (
    <div className="waveform-wrapper">
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
      
      {/* Minimap for navigation - separate container */}
      <div id="minimap" ref={minimapRef}></div>
      
      {/* Display current time (optional) */}
      {isReady && isAudioLoaded && (
        <div className="current-time" style={{ textAlign: 'center', marginBottom: '10px' }}>
          Time: {formatTime(currentTime)} / {formatTime(wavesurfer?.getDuration() || 0)}
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