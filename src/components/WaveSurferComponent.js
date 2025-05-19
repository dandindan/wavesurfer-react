/**
 * File: src/components/WaveSurferComponent.js
 * Description: WaveSurfer component using the official @wavesurfer/react hook
 * 
 * Version History:
 * v1.0.0 (2025-05-19) - Implementation using @wavesurfer/react
 * v1.0.1 (2025-05-19) - Fixed loading spinner and plugin issues
 * v1.0.2 (2025-05-19) - Fixed infinite update loop and duplicate plugins
 * v1.0.3 (2025-05-19) - Fixed zoom error, region looping and drag selection issues
 * v1.0.4 (2025-05-19) - Fixed region functionality and event handlers
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import '../assets/styles/main.css';

const WaveSurferComponent = ({ 
  audioFile, 
  isPlaying, 
  loopRegions,
  dragSelection, // Still accept this prop for backward compatibility
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
    console.log('region-in', region.id);
    activeRegionRef.current = region;
    
    // Highlight active region
    try {
      region.setOptions({ color: 'rgba(0,255,0,0.2)' });
    } catch (error) {
      console.error("Error highlighting region:", error);
    }
  }, []);
  
  // Handle region out event - won't cause re-renders
  const handleRegionOut = useCallback((region) => {
    console.log('region-out', region.id);
    
    // Only replay if this is the active region and looping is enabled
    if (region.id === activeRegionRef.current?.id && loopRegions) {
      try {
        // Small delay before replaying to prevent stuttering
        setTimeout(() => {
          // Check if still active before playing
          if (region.id === activeRegionRef.current?.id && loopRegions) {
            region.play();
          }
        }, 10);
      } catch (error) {
        console.error("Error replaying region:", error);
      }
    } else if (region.id === activeRegionRef.current?.id) {
      // Reset region color when we leave the region
      region.setOptions({ color: 'rgba(0,0,255,0.4)' });
      activeRegionRef.current = null;
    }
  }, [loopRegions]);
  
  // Handle region click event - won't cause re-renders
  const handleRegionClick = useCallback((region, e) => {
    console.log('Region clicked!', region);
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
      
      // Update parent component play state
      if (onPlayPause) {
        onPlayPause(true);
      }
    } catch (error) {
      console.error("Error handling region click:", error);
    }
  }, [resetRegionColors, onPlayPause]);
  
  // Handle region update end - called after a region is created or resized
  const handleRegionUpdateEnd = useCallback((region) => {
    console.log('region-update-end', region.id);
    
    // Auto-select the newly created/updated region
    activeRegionRef.current = region;
    
    // Reset all region colors
    resetRegionColors();
    
    // Set this region to active color
    region.setOptions({ color: 'rgba(0,255,0,0.2)' });
  }, [resetRegionColors]);
  
  // Direct method to create a region programmatically
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const createRegion = useCallback((start, end) => {
    if (!wavesurfer) {
      console.error("Cannot create region: wavesurfer not initialized");
      return null;
    }
    
    // Try different ways to access the regions plugin
    let regionsPlugin = regionsPluginRef.current;
    
    if (!regionsPlugin) {
      // Try to find the regions plugin from wavesurfer
      if (wavesurfer.regions) {
        regionsPlugin = wavesurfer.regions;
      } else {
        // Try to find in active plugins
        const plugins = wavesurfer.getActivePlugins();
        regionsPlugin = plugins.find(plugin => 
          plugin.name === 'regions' || 
          plugin.name === 'Regions' || 
          (plugin.constructor && plugin.constructor.name === 'RegionsPlugin')
        );
      }
      
      // Update our ref if we found it
      if (regionsPlugin) {
        regionsPluginRef.current = regionsPlugin;
      } else {
        console.error("Cannot create region: regions plugin not found");
        return null;
      }
    }
    
    try {
      // Create the region with the specified parameters
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
      
      // Try alternative method if available
      try {
        if (wavesurfer.addRegion) {
          const region = wavesurfer.addRegion({
            start: start,
            end: end,
            color: 'rgba(0,0,255,0.4)',
            drag: true,
            resize: true
          });
          console.log("Region created via alternative method:", region);
          return region;
        }
      } catch (altError) {
        console.error("Failed to create region via alternative method:", altError);
      }
      
      return null;
    }
  }, [wavesurfer]);

  // Handle direct waveform click for manual region creation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleWaveformClick = useCallback((event) => {
    console.log("Waveform clicked", event);
    
    // First check if we have an active region
    if (activeRegionRef.current) {
      try {
        // Reset the active region color
        activeRegionRef.current.setOptions({ color: 'rgba(0,0,255,0.4)' });
      } catch (error) {
        console.error("Error resetting active region color:", error);
      }
      activeRegionRef.current = null;
    }
    
    // We don't need to create regions on click with drag selection enabled
  }, []);
  
  // Setup or update regions - this is now only used when manually called
  const updateRegions = useCallback(() => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin || !wavesurfer) return;
    
    try {
      // Clear existing event listeners to prevent duplicates
      regionsPlugin.un('region-in');
      regionsPlugin.un('region-out');
      regionsPlugin.un('region-clicked');
      regionsPlugin.un('region-update-end');
      
      // Add event listeners
      regionsPlugin.on('region-in', handleRegionIn);
      regionsPlugin.on('region-out', handleRegionOut);
      regionsPlugin.on('region-clicked', handleRegionClick);
      regionsPlugin.on('region-update-end', handleRegionUpdateEnd);
    } catch (error) {
      console.error("Error updating regions:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wavesurfer]);
  
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
        
        // Add Regions first (important for order of operations)
        console.log("Creating regions plugin with direct options");
        const regionsPlugin = Regions.create({
          dragSelection: dragSelection,
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
        
        // Add waveform click handler
        wavesurfer.on('interaction', handleWaveformClick);
        
        // Setup regions
        updateRegions();
        
        // Mark as initialized
        pluginsInitializedRef.current = true;
        
        // Check if regions plugin was initialized correctly
        if (regionsPluginRef.current) {
          console.log("Regions plugin initialized:", regionsPluginRef.current);
          console.log("Regions plugin API:", Object.keys(regionsPluginRef.current));
          
          // Log available methods
          if (typeof regionsPluginRef.current.enableDragSelection === 'function') {
            console.log("enableDragSelection is available");
          } else {
            console.log("enableDragSelection is NOT available");
          }
          
          if (typeof regionsPluginRef.current.params !== 'undefined') {
            console.log("Regions plugin params:", regionsPluginRef.current.params);
          }
        } else {
          console.error("Regions plugin was not initialized correctly");
        }
        
        console.log("Plugins initialized successfully");
      } catch (error) {
        console.error("Error initializing plugins:", error);
      }
    };
    
    initializePlugins();
    
    // Cleanup function for when component unmounts
    return () => {
      if (wavesurfer) {
        wavesurfer.un('interaction');
      }
    };
  }, [wavesurfer, isReady, updateRegions, handleWaveformClick]);
  
  // Update loading state
  useEffect(() => {
    if (isReady) {
      setLoading(false);
      setIsAudioLoaded(true);
      
      // Make regions accessible on the wavesurfer instance
      if (wavesurfer && regionsPluginRef.current) {
        wavesurfer.regions = regionsPluginRef.current;
        
        // Add a clearAllRegions helper method for easier access
        wavesurfer.clearAllRegions = () => {
          try {
            if (regionsPluginRef.current && typeof regionsPluginRef.current.clearRegions === 'function') {
              regionsPluginRef.current.clearRegions();
              return true;
            }
            
            // Alternative: manually clear all regions if clearRegions is not available
            if (regionsPluginRef.current && typeof regionsPluginRef.current.getRegions === 'function') {
              const regions = regionsPluginRef.current.getRegions();
              Object.values(regions).forEach(region => {
                try {
                  region.remove();
                } catch (err) {
                  console.warn("Error removing region:", err);
                }
              });
              return true;
            }
            
            console.warn("Could not clear regions: method not available");
            return false;
          } catch (error) {
            console.error("Error clearing regions:", error);
            return false;
          }
        };
      }
      
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
  
  // Update region options when loopRegions changes
  useEffect(() => {
    // Only log the change, don't update any state
    if (loopRegions) {
      console.log("Regions looping enabled");
    } else {
      console.log("Regions looping disabled");
    }
    // No state updates here that could cause re-renders
  }, [loopRegions]);
  
  // Check if regions functionality is working after component is fully mounted
  useEffect(() => {
    if (!isAudioLoaded || !isReady || !wavesurfer) return;
    
    // Test regions functionality after a short delay
    const timer = setTimeout(() => {
      if (regionsPluginRef.current) {
        console.log("Testing regions functionality...");
        
        // Try to enable drag selection explicitly
        try {
          if (typeof regionsPluginRef.current.enableDragSelection === 'function') {
            regionsPluginRef.current.enableDragSelection({
              color: 'rgba(0,0,255,0.4)'
            });
            console.log("Drag selection enabled successfully");
          }
        } catch (error) {
          console.warn("Could not enable drag selection:", error);
        }
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [isAudioLoaded, isReady, wavesurfer]);
  
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
        // If an active region is selected, play that region
        if (activeRegionRef.current) {
          activeRegionRef.current.play();
        } else {
          // Otherwise play/pause the entire track
          wavesurfer.playPause();
        }
        
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