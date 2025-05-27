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
 * v1.0.5 (2025-05-21) - Fixed maximum update depth exceeded warnings - Maoz Lahav
 * v1.0.6 (2025-05-21) - Fixed multiple spectrogram rendering issue - Maoz Lahav
 * v1.0.7 (2025-05-21) - Fixed duplicate spectrograms and minimaps - Maoz Lahav
 * v1.0.8 (2025-05-21) - Complete rewrite to fix duplicates - Maoz Lahav
 * v1.0.9 (2025-05-21) - Fixed hundreds of timelines issue - Maoz Lahav
 * v1.0.10 (2025-05-21) - Implemented official WaveSurfer regions example with random colors - 
 * v1.0.11 (2025-05-27) - Added mute functionality and click-to-seek for VLC control 
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
  isMuted,
  onPlayPause, 
  onReady,
  onRegionActivated
}) => {
  // Refs
  const containerRef = useRef(null);
  const minimapRef = useRef(null);
  const regionsPluginRef = useRef(null);
  const activeRegionRef = useRef(null);
  const lastZoomLevelRef = useRef(zoomLevel);
  const lastPlaybackSpeedRef = useRef(playbackSpeed);
  const currentAudioFileRef = useRef(null);
  const wavesurferInstanceRef = useRef(null);
  const pluginsRegisteredRef = useRef(false);
  
  // State 
  const [loading, setLoading] = useState(true);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  
  // Random color functions from official example
  const random = useCallback((min, max) => Math.random() * (max - min) + min, []);
  const randomColor = useCallback(() => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`, [random]);
  
  // Handle audio file changes
  useEffect(() => {
    const hasFileChanged = currentAudioFileRef.current !== audioFile;
    
    if (hasFileChanged) {
      console.log("Audio file changed:", audioFile ? (audioFile.name || 'URL') : 'null');
      
      // Clean up previous URL
      if (currentAudioFileRef.current && typeof currentAudioFileRef.current === 'string' && currentAudioFileRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioFileRef.current);
      }
      
      // Reset all states and flags
      setLoading(true);
      setIsAudioLoaded(false);
      activeRegionRef.current = null;
      wavesurferInstanceRef.current = null;
      pluginsRegisteredRef.current = false;
      
      // Create new URL or set to null
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
    }
    
    // Cleanup on unmount
    return () => {
      if (currentAudioFileRef.current && typeof currentAudioFileRef.current === 'string' && currentAudioFileRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioFileRef.current);
      }
    };
  }, [audioFile]);
  
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
  
  // Region event handlers - exactly following the official WaveSurfer example
  const handleRegionIn = useCallback((region) => {
    console.log('region-in', region);
    activeRegionRef.current = region;
  }, []);
  
  const handleRegionOut = useCallback((region) => {
    console.log('region-out', region);
    if (activeRegionRef.current === region) {
      if (loopRegions) {
        region.play();
      } else {
        activeRegionRef.current = null;
      }
    }
  }, [loopRegions]);
  
  const handleRegionClick = useCallback((region, e) => {
    console.log('region-clicked', region);
    e.stopPropagation(); // prevent triggering a click on the waveform
    activeRegionRef.current = region;
    region.play(true); // restart the region
    region.setOptions({ color: randomColor() }); // give it a new random color like the official example
    
    // Update parent component play state
    if (onPlayPause) {
      onPlayPause(true);
    }
    
    // Notify parent component about the active region
    if (onRegionActivated) {
      onRegionActivated(region);
    }
  }, [onPlayPause, onRegionActivated, randomColor]);
  
  const handleRegionUpdated = useCallback((region) => {
    console.log('region-updated', region);
    
    // Auto-select the newly updated region
    activeRegionRef.current = region;
    
    // Give it a random color like the official example
    region.setOptions({ color: randomColor() });
    
    // Notify parent component about the active region
    if (onRegionActivated) {
      onRegionActivated(region);
    }
  }, [onRegionActivated, randomColor]);
  
  const handleWaveformClick = useCallback((event) => {
    console.log("Waveform interaction event:", event);
    
    // First check if we have an active region and reset its color
    if (activeRegionRef.current) {
      try {
        activeRegionRef.current.setOptions({ color: 'rgba(0,0,255,0.4)' });
      } catch (error) {
        console.error("Error resetting active region color:", error);
      }
      activeRegionRef.current = null;
    }
    
    // Calculate click position and seek + play both WaveSurfer and VLC
    if (wavesurfer && event) {
      try {
        let relativeX;
        
        // Try to get relative position from the event
        if (typeof event.relativeX === 'number') {
          relativeX = event.relativeX;
        } else if (event.originalEvent && event.originalEvent.offsetX && event.originalEvent.target) {
          // Calculate relative position manually
          const offsetX = event.originalEvent.offsetX;
          const containerWidth = event.originalEvent.target.offsetWidth;
          relativeX = offsetX / containerWidth;
        } else {
          console.warn("Could not determine click position");
          return;
        }
        
        const duration = wavesurfer.getDuration();
        const clickTime = relativeX * duration;
        
        console.log(`🎯 Click-to-play: ${(relativeX * 100).toFixed(1)}% = ${clickTime.toFixed(2)}s`);
        
        // 1. Seek WaveSurfer to clicked position
        wavesurfer.seekTo(relativeX);
        console.log("📻 WaveSurfer seeked to:", clickTime.toFixed(2) + "s");
        
        // 2. Start WaveSurfer playing
        if (!wavesurfer.isPlaying()) {
          wavesurfer.play();
          console.log("▶️ WaveSurfer started playing");
          
          // Update parent component about play state
          if (onPlayPause) {
            onPlayPause(true);
          }
        }
        
        // 3. Seek VLC to the exact same position and start playing
        if (wavesurfer.vlc && typeof wavesurfer.vlc.seekTo === 'function') {
          console.log("🎬 Seeking VLC to same position:", clickTime.toFixed(2) + "s");
          
          // Seek VLC to exact position
          wavesurfer.vlc.seekTo(clickTime).then((success) => {
            if (success) {
              console.log("✅ VLC seek successful");
              
              // Start VLC playing to match WaveSurfer
              if (wavesurfer.vlc.play) {
                wavesurfer.vlc.play().then(() => {
                  console.log("▶️ VLC started playing - synchronized!");
                });
              }
            } else {
              console.error("❌ VLC seek failed");
            }
          });
        } else {
          console.log("⚠️ VLC not available for synchronization");
        }
        
        // Notify parent about the position change
        if (onRegionActivated) {
          onRegionActivated({
            start: clickTime,
            end: clickTime,
            id: 'click-position',
            isClickPosition: true
          });
        }
        
      } catch (error) {
        console.error("Error handling synchronized click-to-play:", error);
      }
    }
  }, [wavesurfer, onRegionActivated, onPlayPause]);
  
  // CRITICAL: One-time plugin registration when wavesurfer instance changes
  useEffect(() => {
    // Only proceed if we have a valid wavesurfer instance and it's ready
    if (!wavesurfer || !isReady) return;
    
    // Check if this is a new wavesurfer instance
    const isNewInstance = wavesurferInstanceRef.current !== wavesurfer;
    
    // Only register plugins for new instances that haven't been processed
    if (isNewInstance && !pluginsRegisteredRef.current) {
      console.log("Registering plugins for new wavesurfer instance...");
      
      // Mark this instance as current
      wavesurferInstanceRef.current = wavesurfer;
      pluginsRegisteredRef.current = true;
      
      // Clear minimap container
      if (minimapRef.current) {
        minimapRef.current.innerHTML = '';
      }
      
      const registerPlugins = async () => {
        try {
          // Import all plugins
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
          
          // Double-check we're still working with the same instance
          if (wavesurferInstanceRef.current !== wavesurfer) {
            console.log("Wavesurfer instance changed during plugin import, aborting...");
            return;
          }
          
          console.log("Creating and registering plugins...");
          
          // Create and register each plugin
          const regionsPlugin = Regions.create();
          wavesurfer.registerPlugin(regionsPlugin);
          regionsPluginRef.current = regionsPlugin;
          
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
          
          // Enable drag selection - exactly like the official example
          regionsPlugin.enableDragSelection({
            color: 'rgba(255, 0, 0, 0.1)',
          });
          
          // Set up event listeners - following the official example pattern exactly
          regionsPlugin.on('region-in', handleRegionIn);
          regionsPlugin.on('region-out', handleRegionOut);
          regionsPlugin.on('region-clicked', handleRegionClick);
          regionsPlugin.on('region-updated', handleRegionUpdated);
          
          // Reset the active region when the user clicks anywhere in the waveform
          wavesurfer.on('interaction', handleWaveformClick);
          
          // CRITICAL: Add direct event listener to the waveform container for VLC sync
          const waveformContainer = containerRef.current;
          if (waveformContainer) {
            const handleDirectWaveformClick = (event) => {
              console.log("🖱️ Direct container click detected:", event);
              
              try {
                // Calculate relative position from the click
                const containerRect = waveformContainer.getBoundingClientRect();
                const clickX = event.clientX - containerRect.left;
                const relativeX = clickX / containerRect.width;
                
                if (relativeX >= 0 && relativeX <= 1) {
                  const duration = wavesurfer.getDuration();
                  const clickTime = relativeX * duration;
                  
                  console.log(`🎯 Direct click: ${(relativeX * 100).toFixed(1)}% = ${clickTime.toFixed(2)}s`);
                  
                  // Force both WaveSurfer and VLC to seek and play
                  setTimeout(() => {
                    // 1. Seek WaveSurfer
                    wavesurfer.seekTo(relativeX);
                    console.log("📻 WaveSurfer force-seeked to:", clickTime.toFixed(2) + "s");
                    
                    // 2. Start WaveSurfer playing if not playing
                    if (!wavesurfer.isPlaying()) {
                      wavesurfer.play();
                      console.log("▶️ WaveSurfer force-started playing");
                      
                      // Update parent play state
                      if (onPlayPause) {
                        onPlayPause(true);
                      }
                    }
                    
                    // 3. Force VLC synchronization
                    if (wavesurfer.vlc && typeof wavesurfer.vlc.seekTo === 'function') {
                      console.log("🎬 Force-syncing VLC to:", clickTime.toFixed(2) + "s");
                      
                      wavesurfer.vlc.seekTo(clickTime).then((success) => {
                        if (success) {
                          console.log("✅ VLC force-seek successful");
                          
                          // Force VLC to start playing
                          if (wavesurfer.vlc.play) {
                            wavesurfer.vlc.play().then(() => {
                              console.log("▶️ VLC force-started playing - SYNCHRONIZED!");
                            });
                          }
                        } else {
                          console.error("❌ VLC force-seek failed");
                        }
                      });
                    }
                  }, 50); // Small delay to ensure proper execution order
                }
              } catch (error) {
                console.error("Error in direct click handler:", error);
              }
            };
            
            // Add click listener to the waveform container
            waveformContainer.addEventListener('click', handleDirectWaveformClick);
            
            // Store cleanup function
            cleanupFunctionsRef.current.push(() => {
              waveformContainer.removeEventListener('click', handleDirectWaveformClick);
            });
          }
          
          // Set up helper methods on wavesurfer instance
          wavesurfer.regions = regionsPlugin;
          wavesurfer.getActiveRegion = () => activeRegionRef.current;
          wavesurfer.clearAllRegions = () => {
            try {
              if (regionsPlugin && typeof regionsPlugin.clearRegions === 'function') {
                regionsPlugin.clearRegions();
                activeRegionRef.current = null; // Reset active region when clearing
                return true;
              }
              return false;
            } catch (error) {
              console.error("Error clearing regions:", error);
              return false;
            }
          };
          
          // Add method to create regions with random colors like the official example
          wavesurfer.createRegion = (options = {}) => {
            try {
              if (regionsPlugin && typeof regionsPlugin.addRegion === 'function') {
                const regionOptions = {
                  color: randomColor(), // Give regions a random color when they are created
                  drag: true,
                  resize: true,
                  ...options
                };
                
                const region = regionsPlugin.addRegion(regionOptions);
                console.log("Region created with options:", regionOptions);
                return region;
              }
              return null;
            } catch (error) {
              console.error("Error creating region:", error);
              return null;
            }
          };
          
          console.log("All plugins registered successfully");
          
          // Update state
          setLoading(false);
          setIsAudioLoaded(true);
          
          // Notify parent component
          if (onReady) {
            onReady(wavesurfer);
          }
          
        } catch (error) {
          console.error("Error registering plugins:", error);
          // Reset flag on error so we can try again
          pluginsRegisteredRef.current = false;
        }
      };
      
      // Register plugins with a small delay to ensure DOM is ready
      setTimeout(registerPlugins, 100);
    }
    
    // Cleanup function
    return () => {
      if (wavesurfer && wavesurferInstanceRef.current === wavesurfer) {
        try {
          wavesurfer.un('interaction');
        } catch (error) {
          console.warn("Error during cleanup:", error);
        }
      }
    };
    
  }, [wavesurfer, isReady, handleRegionIn, handleRegionOut, handleRegionClick, handleRegionUpdated, handleWaveformClick, onReady, randomColor]);
  
  // Reset plugin flag when audio file changes
  useEffect(() => {
    if (audioFile !== currentAudioFileRef.current) {
      pluginsRegisteredRef.current = false;
    }
  }, [audioFile]);
  
  // Update playback status
  useEffect(() => {
    if (wavesurfer && isReady && isAudioLoaded) {
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
  }, [isPlaying, wavesurfer, isReady, isAudioLoaded]);
  
  // Safe zoom function
  const safeZoom = useCallback((level) => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    try {
      wavesurfer.zoom(level);
    } catch (error) {
      console.warn("Zoom error:", error);
    }
  }, [wavesurfer, isReady, isAudioLoaded]);
  
  // Update zoom level
  useEffect(() => {
    if (!isAudioLoaded || !isReady || !wavesurfer) return;
    
    if (lastZoomLevelRef.current !== zoomLevel) {
      lastZoomLevelRef.current = zoomLevel;
      
      const zoomTimer = setTimeout(() => {
        safeZoom(zoomLevel);
      }, 100);
      
      return () => clearTimeout(zoomTimer);
    }
  }, [zoomLevel, isAudioLoaded, isReady, wavesurfer, safeZoom]);
  
  // Update playback speed
  useEffect(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    if (lastPlaybackSpeedRef.current !== playbackSpeed) {
      lastPlaybackSpeedRef.current = playbackSpeed;
      
      try {
        wavesurfer.setPlaybackRate(playbackSpeed);
      } catch (error) {
        console.error("Error setting playback speed:", error);
      }
    }
  }, [playbackSpeed, wavesurfer, isReady, isAudioLoaded]);
  
  // Update mute state
  useEffect(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    try {
      if (isMuted) {
        wavesurfer.setVolume(0);
        console.log("WaveSurfer muted");
      } else {
        wavesurfer.setVolume(1);
        console.log("WaveSurfer unmuted");
      }
    } catch (error) {
      console.error("Error setting WaveSurfer volume:", error);
    }
  }, [isMuted, wavesurfer, isReady, isAudioLoaded]);
  
  // Play/Pause handler
  const handlePlayPause = useCallback(() => {
    if (wavesurfer && isReady && isAudioLoaded) {
      try {
        if (activeRegionRef.current) {
          activeRegionRef.current.play();
        } else {
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
  
  // Keyboard shortcut
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
      <div id="minimap" ref={minimapRef} style={{
        width: '100%',
        height: '40px',
        marginBottom: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '5px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)'
      }}></div>
      
      {/* Display current time */}
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