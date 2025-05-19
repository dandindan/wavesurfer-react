/**
 * File: src/components/WaveSurferComponent.js
 * Description: WaveSurfer component using the official @wavesurfer/react hook
 * 
 * Version History:
 * v1.0.0 (2025-05-19) - Implementation using @wavesurfer/react
 * v1.0.1 (2025-05-19) - Fixed loading spinner and plugin issues
 * v1.0.2 (2025-05-19) - Fixed infinite update loop and duplicate plugins
 * v1.0.3 (2025-05-19) - Fixed zoom error, region looping and drag selection issues
 * v1.0.4 (2025-05-19) - Performance optimizations and infinite loop fixes
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import '../assets/styles/main.css';

// Optimization to prevent unnecessary renders
const isEqual = (prev, next) => {
  // Check if the audioFile, isPlaying, loopRegions, zoomLevel, and playbackSpeed are the same
  return (
    prev.audioFile === next.audioFile &&
    prev.isPlaying === next.isPlaying &&
    prev.loopRegions === next.loopRegions &&
    prev.zoomLevel === next.zoomLevel &&
    prev.playbackSpeed === next.playbackSpeed
  );
};

const WaveSurferComponent = ({ 
  audioFile, 
  isPlaying, 
  loopRegions,
  zoomLevel,
  playbackSpeed,
  onPlayPause, 
  onReady,
  onRegionActivated
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
  
  // State for time display with reduced updates
  const [displayTime, setDisplayTime] = useState('00:00');
  const [displayDuration, setDisplayDuration] = useState('00:00');
  
  // Show loading spinner immediately when audio file changes
  useEffect(() => {
    if (audioFile) {
      setLoading(true);
      setIsAudioLoaded(false);
      // Reset plugins initialized flag when audio changes
      pluginsInitializedRef.current = false;
      // Reset active region when audio changes
      activeRegionRef.current = null;
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
  
  // Initialize WaveSurfer with useWavesurfer hook (with options to prevent infinite updates)
  const { wavesurfer, isReady } = useWavesurfer({
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
  
  // Safe access to regions plugin
  const getRegionsPlugin = useCallback(() => {
    if (!wavesurfer) return null;
    
    // First try direct reference
    if (regionsPluginRef.current) return regionsPluginRef.current;
    
    // Then try through wavesurfer
    if (wavesurfer.regions) return wavesurfer.regions;
    
    // Finally try to find in plugins
    const plugins = wavesurfer.getActivePlugins();
    const regionsPlugin = plugins.find(plugin => 
      plugin.name === 'regions' || plugin.name === 'Regions' || 
      (plugin.constructor && plugin.constructor.name === 'RegionsPlugin')
    );
    
    // Store for future use if found
    if (regionsPlugin) {
      regionsPluginRef.current = regionsPlugin;
      // Also expose on wavesurfer for external access
      wavesurfer.regions = regionsPlugin;
    }
    
    return regionsPlugin;
  }, [wavesurfer]);
  
  // Reset region color handler
  const resetRegionColors = useCallback(() => {
    const regionsPlugin = getRegionsPlugin();
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
  }, [getRegionsPlugin]);
  
  // Handle region in event - simplified to match HTML implementation
  const handleRegionIn = useCallback((region) => {
    console.log('region-in', region.id, 'loopRegions:', loopRegions);
    
    // Set as active region
    activeRegionRef.current = region;
    
    // Highlight active region
    try {
      region.setOptions({ color: 'rgba(0,255,0,0.2)' });
    } catch (error) {
      console.error("Error highlighting region:", error);
    }
  }, []);
  
  // Handle region out event - simplified to match HTML implementation
  const handleRegionOut = useCallback((region) => {
    console.log('region-out', region.id, 'loopRegions:', loopRegions);
    
    // Check if this is the active region 
    if (region.id === activeRegionRef.current?.id) {
      if (loopRegions) {
        // If looping is enabled, replay the region
        try {
          region.play();
        } catch (error) {
          console.error("Error replaying region:", error);
        }
      } else {
        // If not looping, clear the active region
        console.log('Not looping, continuing playback');
        region.setOptions({ color: 'rgba(0,0,255,0.4)' });
        activeRegionRef.current = null;
      }
    }
  }, [loopRegions]);
  
  // Handle region click event - simplified to match HTML implementation
  const handleRegionClick = useCallback((region, e) => {
    console.log('Region clicked!', region);
    try {
      e.stopPropagation(); // prevent triggering a click on the waveform
      
      // Set this as the active region
      activeRegionRef.current = region;
      
      // Reset all regions to default color except the clicked one
      resetRegionColors();
      
      // Set this region to active color
      region.setOptions({ color: 'rgba(0,255,0,0.2)' });
      
      // Play the region
      region.play();
      
      // Update parent component play state
      if (onPlayPause) {
        onPlayPause(true);
      }
      
      // Notify parent about region activation
      if (props.onRegionActivated) {
        props.onRegionActivated(region);
      }
    } catch (error) {
      console.error("Error handling region click:", error);
    }
  }, [resetRegionColors, onPlayPause, props]);
  
  // Handle region update end - simplified
  const handleRegionUpdateEnd = useCallback((region) => {
    console.log('region-update-end', region.id);
    
    // Auto-select the newly created/updated region
    activeRegionRef.current = region;
    
    // Reset all region colors
    resetRegionColors();
    
    // Set this region to active color
    region.setOptions({ color: 'rgba(0,255,0,0.2)' });
  }, [resetRegionColors]);
  
  // Handle waveform click - simplified to match HTML implementation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleWaveformClick = useCallback(() => {
    // Reset active region when clicking on the waveform (outside any region)
    activeRegionRef.current = null;
  }, []);
  
  // Direct method to create a region programmatically - simplified
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const createRegion = useCallback((start, end) => {
    const regionsPlugin = getRegionsPlugin();
    if (!regionsPlugin) return null;
    
    try {
      const region = regionsPlugin.addRegion({
        start: start,
        end: end,
        color: 'rgba(0,0,255,0.4)',
        drag: true,
        resize: true
      });
      
      console.log("Region created:", region);
      return region;
    } catch (error) {
      console.error("Failed to create region:", error);
      return null;
    }
  }, [getRegionsPlugin]);
  
  // Update loading state - fix the infinite update loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isReady && !isAudioLoaded) {
      console.log("Setting audio loaded");
      setLoading(false);
      setIsAudioLoaded(true);
      
      // Notify parent component that wavesurfer is ready
      if (onReady) {
        onReady(wavesurfer);
      }
    }
  }, [isReady]);
  
  // Update time display less frequently
  useEffect(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    // Update time display every 500ms instead of every frame
    const interval = setInterval(() => {
      try {
        const currentTime = wavesurfer.getCurrentTime() || 0;
        const duration = wavesurfer.getDuration() || 0;
        setDisplayTime(formatTime(currentTime));
        setDisplayDuration(formatTime(duration));
      } catch (e) {
        // Ignore errors
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [wavesurfer, isReady, isAudioLoaded]);
  
  // Log loopRegions prop change
  useEffect(() => {
    console.log("[LOOP STATUS] loopRegions is now:", loopRegions);
  }, [loopRegions]);
  
  // Initialize plugins manually AFTER wavesurfer is ready
  useEffect(() => {
    // Early exit if not ready
    if (!wavesurfer || !isReady || !minimapRef.current) return;
    
    // Only run once per wavesurfer instance
    if (pluginsInitializedRef.current) {
      return;
    }
    
    console.log("Initializing plugins...");
    
    // Use an IIFE to prevent setState in an effect without dependencies
    (async () => {
      try {
        // Import plugins
        console.log("Importing WaveSurfer plugins...");
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
        
        console.log("Creating plugins...");
        
        // Add Regions first (important for order of operations)
        const regionsPlugin = Regions.create({
          // Always enable drag selection (true is hardcoded since we removed the checkbox)
          dragSelection: true,
          color: 'rgba(0,0,255,0.4)',
        });
        wavesurfer.registerPlugin(regionsPlugin);
        
        // Store regions plugin reference
        regionsPluginRef.current = regionsPlugin;
        
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
        
        // Add waveform click handler - use the correct method based on wavesurfer version
        wavesurfer.on('interaction', handleWaveformClick);
        
        // Add event listeners directly 
        if (regionsPlugin) {
          // Add event listeners
          regionsPlugin.on('region-in', handleRegionIn);
          regionsPlugin.on('region-out', handleRegionOut);
          regionsPlugin.on('region-clicked', handleRegionClick);
          regionsPlugin.on('region-update-end', handleRegionUpdateEnd);
          
          // Ensure the plugin is correctly exposed for external access
          if (!wavesurfer.regions && regionsPlugin) {
            // Add a direct reference to make clearing regions easier
            wavesurfer.regions = regionsPlugin;
          }
        }
        
        // Mark as initialized
        pluginsInitializedRef.current = true;
        
        console.log("Plugins initialized successfully");
      } catch (error) {
        console.error("Error initializing plugins:", error);
      }
    })();
    
    // Cleanup function for when component unmounts
    return () => {
      if (wavesurfer) {
        wavesurfer.un('interaction');
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [
    wavesurfer, 
    isReady, 
    handleWaveformClick, 
    handleRegionIn, 
    handleRegionOut, 
    handleRegionClick, 
    handleRegionUpdateEnd
  ]);
  
  // Handle play/pause
  useEffect(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
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
  }, [isPlaying, wavesurfer, isReady, isAudioLoaded]);
  
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
  
  // Helper function to format time in MM:SS
  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };
  
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
      
      {/* Display current time (optional) - using cached values */}
      {isReady && isAudioLoaded && (
        <div className="current-time" style={{ textAlign: 'center', marginBottom: '10px' }}>
          Time: {displayTime} / {displayDuration}
        </div>
      )}
    </div>
  );
};

// Export with React.memo to prevent unnecessary re-renders
export default React.memo(WaveSurferComponent, isEqual);