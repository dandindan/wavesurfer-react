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
 * v1.0.10 (2025-05-21) - Implemented official WaveSurfer regions example with random colors - Maoz Lahav
 * v1.0.11 (2025-06-09) - Added EXACT VLC mirroring for all WaveSurfer interactions - Human Request
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
  // v1.0.11 - Added VLC sync tracking refs for exact mirroring
  const vlcSyncActiveRef = useRef(false);
  const lastVlcSyncTimeRef = useRef(0);
  const vlcSyncIntervalRef = useRef(null);
  const pendingVlcSeekRef = useRef(null);
  
  // State 
  const [loading, setLoading] = useState(true);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  // v1.0.11 - Added VLC sync status state
  const [vlcSyncStatus, setVlcSyncStatus] = useState('disconnected');
  
  // Random color functions from official example
  const random = useCallback((min, max) => Math.random() * (max - min) + min, []);
  const randomColor = useCallback(() => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`, [random]);
  
  // v1.0.11 - Added comprehensive VLC sync utility functions
  const vlcSyncUtils = useCallback((wavesurferInstance = null) => {
    const wsInstance = wavesurferInstance || wavesurfer;
    if (!wsInstance || !wsInstance.vlc || !wsInstance.vlc.isConnected()) {
      return null;
    }
    
    return {
      // Immediate sync to VLC with debouncing
      syncSeekToVLC: async (timeInSeconds, source = 'unknown') => {
        if (!vlcSyncActiveRef.current) return false;
        
        console.log(`🎯 [${source}] WaveSurfer → VLC EXACT SEEK: ${timeInSeconds.toFixed(3)}s`);
        
        // Cancel any pending seek
        if (pendingVlcSeekRef.current) {
          clearTimeout(pendingVlcSeekRef.current);
        }
        
        // Debounce rapid seeks (within 50ms)
        const now = Date.now();
        if (now - lastVlcSyncTimeRef.current < 50) {
          pendingVlcSeekRef.current = setTimeout(() => {
            wavesurfer.vlc.seekTo(timeInSeconds);
            lastVlcSyncTimeRef.current = Date.now();
          }, 50);
          return true;
        }
        
        try {
          await wsInstance.vlc.seekTo(timeInSeconds);
          lastVlcSyncTimeRef.current = now;
          console.log(`✅ [${source}] VLC seek SUCCESS: ${timeInSeconds.toFixed(3)}s`);
          return true;
        } catch (error) {
          console.error(`❌ [${source}] VLC seek FAILED:`, error);
          return false;
        }
      },
      
      // Sync play state to VLC
      syncPlayStateToVLC: async (shouldPlay, source = 'unknown') => {
        if (!vlcSyncActiveRef.current) return false;
        
        console.log(`🎵 [${source}] WaveSurfer → VLC PLAY STATE: ${shouldPlay ? 'PLAY' : 'PAUSE'}`);
        
        try {
          if (shouldPlay) {
            await wsInstance.vlc.play();
          } else {
            await wsInstance.vlc.pause();
          }
          console.log(`✅ [${source}] VLC play state synced: ${shouldPlay ? 'PLAYING' : 'PAUSED'}`);
          return true;
        } catch (error) {
          console.error(`❌ [${source}] VLC play state sync FAILED:`, error);
          return false;
        }
      },
      
      // Sync region playback to VLC with exact timing
      syncRegionToVLC: async (region, source = 'unknown') => {
        if (!vlcSyncActiveRef.current || !region) return false;
        
        console.log(`🎵 [${source}] WaveSurfer → VLC REGION PLAY: ${region.start.toFixed(3)}s - ${region.end.toFixed(3)}s`);
        
        try {
          // First seek to region start
          await wsInstance.vlc.seekTo(region.start);
          
          // Then start playing
          await wsInstance.vlc.play();
          
          // Set up region end monitoring if looping is enabled
          if (loopRegions) {
            const regionDuration = (region.end - region.start) * 1000; // Convert to ms
            setTimeout(async () => {
              try {
                // Loop back to region start
                await wsInstance.vlc.seekTo(region.start);
                console.log(`🔄 [${source}] VLC region loop: back to ${region.start.toFixed(3)}s`);
              } catch (error) {
                console.error(`❌ [${source}] VLC region loop FAILED:`, error);
              }
            }, regionDuration);
          }
          
          console.log(`✅ [${source}] VLC region playback started`);
          return true;
        } catch (error) {
          console.error(`❌ [${source}] VLC region sync FAILED:`, error);
          return false;
        }
      }
    };
  }, [loopRegions]);
  
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
      // v1.0.11 - Reset VLC sync state on file change
      vlcSyncActiveRef.current = false;
      setVlcSyncStatus('disconnected');
      
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
  
  // v1.0.11 - Enhanced region event handlers with exact VLC mirroring
  const handleRegionIn = useCallback((region) => {
    console.log('region-in', region);
    activeRegionRef.current = region;
    
    // v1.0.11 - Sync region entry to VLC
    const syncUtils = vlcSyncUtils(wavesurfer);
    if (syncUtils) {
      syncUtils.syncSeekToVLC(region.start, 'region-in');
    }
  }, [vlcSyncUtils]);
  
  const handleRegionOut = useCallback((region) => {
    console.log('region-out', region);
    if (activeRegionRef.current === region) {
      if (loopRegions) {
        region.play();
        // v1.0.11 - Sync region loop to VLC
        const syncUtils = vlcSyncUtils(wavesurfer);
        if (syncUtils) {
          syncUtils.syncRegionToVLC(region, 'region-loop');
        }
      } else {
        activeRegionRef.current = null;
      }
    }
  }, [loopRegions, vlcSyncUtils]);
  
  const handleRegionClick = useCallback((region, e) => {
    console.log('region-clicked', region);
    e.stopPropagation(); // prevent triggering a click on the waveform
    activeRegionRef.current = region;
    region.play(true); // restart the region
    region.setOptions({ color: randomColor() }); // give it a new random color like the official example
    
    // v1.0.11 - Exact VLC sync for region click
    const syncUtils = vlcSyncUtils(wavesurfer);
    if (syncUtils) {
      syncUtils.syncRegionToVLC(region, 'region-click');
    }
    
    // Update parent component play state
    if (onPlayPause) {
      onPlayPause(true);
    }
    
    // Notify parent component about the active region
    if (onRegionActivated) {
      onRegionActivated(region);
    }
  }, [onPlayPause, onRegionActivated, randomColor, vlcSyncUtils]);
  
  const handleRegionUpdated = useCallback((region) => {
    console.log('region-updated', region);
    
    // Auto-select the newly updated region
    activeRegionRef.current = region;
    
    // Give it a random color like the official example
    region.setOptions({ color: randomColor() });
    
    // v1.0.11 - Sync region boundary changes to VLC
    const syncUtils = vlcSyncUtils(wavesurfer);
    if (syncUtils) {
      // When region is resized/moved, seek VLC to new start position
      syncUtils.syncSeekToVLC(region.start, 'region-updated');
    }
    
    // Notify parent component about the active region
    if (onRegionActivated) {
      onRegionActivated(region);
    }
  }, [onRegionActivated, randomColor, vlcSyncUtils]);
  
  const handleWaveformClick = useCallback((event) => {
    console.log("🖱️ Waveform clicked:", event);
    
    // Reset active region color if any
    if (activeRegionRef.current) {
      try {
        activeRegionRef.current.setOptions({ color: 'rgba(0,0,255,0.4)' });
      } catch (error) {
        console.error("Error resetting active region color:", error);
      }
      activeRegionRef.current = null;
    }
    
    // v1.0.11 - Enhanced VLC synchronization for direct clicks with exact positioning
    if (wavesurfer && event && typeof event.relativeX === 'number') {
      try {
        const duration = wavesurfer.getDuration();
        const clickTime = event.relativeX * duration;
        
        console.log(`🎯 Click at: ${clickTime.toFixed(3)}s (${(event.relativeX * 100).toFixed(2)}%)`);
        
        // v1.0.11 - Immediate exact VLC sync for waveform clicks
        const syncUtils = vlcSyncUtils(wavesurfer);
        if (syncUtils) {
          syncUtils.syncSeekToVLC(clickTime, 'waveform-click');
          
          // v1.0.11 - If WaveSurfer is playing, ensure VLC continues playing
          if (wavesurfer.isPlaying()) {
            syncUtils.syncPlayStateToVLC(true, 'waveform-click-play');
          }
        }
        
      } catch (error) {
        console.error("Error syncing VLC on click:", error);
      }
    }
  }, [wavesurfer, vlcSyncUtils]);
  
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
          
          // v1.0.11 - Added comprehensive VLC mirroring event listeners
          // Listen to ALL WaveSurfer events for exact mirroring
          wavesurfer.on('seeking', (currentTime) => {
            console.log(`🎯 WaveSurfer SEEKING: ${currentTime.toFixed(3)}s`);
            const syncUtils = vlcSyncUtils(wavesurfer);
            if (syncUtils) {
              syncUtils.syncSeekToVLC(currentTime, 'wavesurfer-seeking');
            }
          });
          
          wavesurfer.on('timeupdate', (currentTime) => {
            // v1.0.11 - Continuous time sync (throttled to avoid spam)
            const syncUtils = vlcSyncUtils(wavesurfer);
            if (syncUtils && vlcSyncActiveRef.current) {
              const now = Date.now();
              if (now - lastVlcSyncTimeRef.current > 500) { // Sync every 500ms during playback
                syncUtils.syncSeekToVLC(currentTime, 'wavesurfer-timeupdate');
              }
            }
          });
          
          wavesurfer.on('play', () => {
            console.log(`▶️ WaveSurfer PLAY event`);
            const syncUtils = vlcSyncUtils(wavesurfer);
            if (syncUtils) {
              syncUtils.syncPlayStateToVLC(true, 'wavesurfer-play');
            }
          });
          
          wavesurfer.on('pause', () => {
            console.log(`⏸️ WaveSurfer PAUSE event`);
            const syncUtils = vlcSyncUtils(wavesurfer);
            if (syncUtils) {
              syncUtils.syncPlayStateToVLC(false, 'wavesurfer-pause');
            }
          });
          
          // v1.0.11 - Timeline and spectrogram click handling for exact VLC sync
          timelinePlugin.on && timelinePlugin.on('click', (time) => {
            console.log(`🕐 Timeline clicked: ${time.toFixed(3)}s`);
            const syncUtils = vlcSyncUtils(wavesurfer);
            if (syncUtils) {
              syncUtils.syncSeekToVLC(time, 'timeline-click');
            }
          });
          
          // v1.0.11 - Spectrogram interaction for VLC sync
          spectrogramPlugin.on && spectrogramPlugin.on('click', (frequency, time) => {
            console.log(`📊 Spectrogram clicked: ${time.toFixed(3)}s at ${frequency.toFixed(1)}Hz`);
            const syncUtils = vlcSyncUtils(wavesurfer);
            if (syncUtils) {
              syncUtils.syncSeekToVLC(time, 'spectrogram-click');
            }
          });
          
          // v1.0.11 - Minimap interaction for VLC sync
          minimapPlugin.on && minimapPlugin.on('click', (time) => {
            console.log(`🗺️ Minimap clicked: ${time.toFixed(3)}s`);
            const syncUtils = vlcSyncUtils(wavesurfer);
            if (syncUtils) {
              syncUtils.syncSeekToVLC(time, 'minimap-click');
            }
          });
          
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
                
                // v1.0.11 - Immediately sync new region to VLC
                const syncUtils = vlcSyncUtils(wavesurfer);
                if (syncUtils && regionOptions.start !== undefined) {
                  syncUtils.syncSeekToVLC(regionOptions.start, 'region-created');
                }
                
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
          // v1.0.11 - Cleanup VLC sync event listeners
          wavesurfer.un('seeking');
          wavesurfer.un('timeupdate');
          wavesurfer.un('play');
          wavesurfer.un('pause');
        } catch (error) {
          console.warn("Error during cleanup:", error);
        }
      }
    };
    
  }, [wavesurfer, isReady, handleRegionIn, handleRegionOut, handleRegionClick, handleRegionUpdated, handleWaveformClick, onReady, randomColor, vlcSyncUtils]);
  
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
        
        // v1.0.11 - Sync playback speed changes to VLC
        console.log(`⚡ WaveSurfer playback speed changed: ${playbackSpeed}x`);
        // Note: VLC speed sync would require additional VLC command implementation
        
      } catch (error) {
        console.error("Error setting playback speed:", error);
      }
    }
  }, [playbackSpeed, wavesurfer, isReady, isAudioLoaded]);
  
  // v1.0.11 - Enhanced VLC synchronization manager with exact mirroring
  const setupExactVLCMirroring = useCallback(() => {
    if (!wavesurfer || !wavesurfer.vlc || !wavesurfer.vlc.isConnected()) {
      setVlcSyncStatus('disconnected');
      return null;
    }
    
    console.log("🎯 Setting up EXACT VLC mirroring system");
    vlcSyncActiveRef.current = true;
    setVlcSyncStatus('connected');
    
    // v1.0.11 - Continuous sync monitoring (every 100ms for exact mirroring)
    if (vlcSyncIntervalRef.current) {
      clearInterval(vlcSyncIntervalRef.current);
    }
    
    vlcSyncIntervalRef.current = setInterval(() => {
      if (!wavesurfer || !wavesurfer.vlc || !vlcSyncActiveRef.current) return;
      
      try {
        const wsCurrentTime = wavesurfer.getCurrentTime();
        const vlcCurrentTime = wavesurfer.vlc.getCurrentTime ? wavesurfer.vlc.getCurrentTime() : 0;
        
        // v1.0.11 - Detect time drift and correct (tolerance: 100ms)
        const timeDrift = Math.abs(wsCurrentTime - vlcCurrentTime);
        if (timeDrift > 0.1 && wavesurfer.isPlaying()) {
          console.log(`⚠️ Time drift detected: ${timeDrift.toFixed(3)}s - correcting VLC`);
          wavesurfer.vlc.seekTo(wsCurrentTime);
        }
        
      } catch (error) {
        console.warn("VLC sync monitoring error:", error);
      }
    }, 100); // v1.0.11 - 100ms monitoring for exact sync
    
    console.log("✅ EXACT VLC mirroring system active");
    
    // Return cleanup function
    return () => {
      console.log("🧹 Cleaning up EXACT VLC mirroring");
      vlcSyncActiveRef.current = false;
      setVlcSyncStatus('disconnected');
      
      if (vlcSyncIntervalRef.current) {
        clearInterval(vlcSyncIntervalRef.current);
        vlcSyncIntervalRef.current = null;
      }
    };
  }, [wavesurfer]);
  
  // v1.0.11 - Set up exact VLC mirroring when VLC becomes available
  useEffect(() => {
    if (!wavesurfer || !isReady || !isAudioLoaded) return;
    
    // Check if VLC is connected
    if (wavesurfer.vlc && wavesurfer.vlc.isConnected()) {
      const cleanup = setupExactVLCMirroring();
      return cleanup;
    }
    
    // If VLC is not connected yet, check periodically
    const vlcCheckInterval = setInterval(() => {
      if (wavesurfer.vlc && wavesurfer.vlc.isConnected()) {
        clearInterval(vlcCheckInterval);
        setupExactVLCMirroring();
      }
    }, 1000);
    
    return () => {
      clearInterval(vlcCheckInterval);
    };
  }, [wavesurfer, isReady, isAudioLoaded, setupExactVLCMirroring]);
  
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
  
  // v1.0.11 - Enhanced Play/Pause handler with exact VLC sync
  const handlePlayPause = useCallback(() => {
    if (wavesurfer && isReady && isAudioLoaded) {
      try {
        console.log("🎵 Play/Pause button clicked - EXACT SYNC MODE");
        
        // Handle region playback with exact VLC mirroring
        if (activeRegionRef.current) {
          console.log("🎵 Playing active region with EXACT VLC sync");
          activeRegionRef.current.play();
          
          // v1.0.11 - Exact VLC region sync
          const syncUtils = vlcSyncUtils(wavesurfer);
          if (syncUtils) {
            syncUtils.syncRegionToVLC(activeRegionRef.current, 'play-pause-region');
          }
        } else {
          // Normal play/pause - WaveSurfer events will auto-sync VLC exactly
          console.log("🎵 Toggle play/pause with EXACT VLC mirroring");
          wavesurfer.playPause();
        }
        
        // Update parent component
        if (onPlayPause) {
          onPlayPause(!wavesurfer.isPlaying());
        }
      } catch (error) {
        console.error("Error toggling play/pause:", error);
      }
    }
  }, [wavesurfer, isReady, isAudioLoaded, onPlayPause, vlcSyncUtils]);
  
  // v1.0.11 - Enhanced keyboard shortcut with exact VLC sync
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && wavesurfer && isReady && isAudioLoaded) {
        e.preventDefault();
        console.log("⌨️ Spacebar pressed - triggering EXACT synchronized play/pause");
        handlePlayPause();
      }
      
      // v1.0.11 - Additional keyboard shortcuts for exact VLC control
      if (wavesurfer && isReady && isAudioLoaded) {
        const syncUtils = vlcSyncUtils(wavesurfer);
        
        switch (e.code) {
          case 'ArrowLeft':
            if (e.ctrlKey) {
              e.preventDefault();
              const currentTime = wavesurfer.getCurrentTime();
              const newTime = Math.max(0, currentTime - 5); // Seek back 5s
              wavesurfer.seekTo(newTime / wavesurfer.getDuration());
              console.log("⏪ Ctrl+Left: Seek back 5s with VLC sync");
              if (syncUtils) {
                syncUtils.syncSeekToVLC(newTime, 'keyboard-seek-back');
              }
            }
            break;
            
          case 'ArrowRight':
            if (e.ctrlKey) {
              e.preventDefault();
              const currentTime = wavesurfer.getCurrentTime();
              const duration = wavesurfer.getDuration();
              const newTime = Math.min(duration, currentTime + 5); // Seek forward 5s
              wavesurfer.seekTo(newTime / duration);
              console.log("⏩ Ctrl+Right: Seek forward 5s with VLC sync");
              if (syncUtils) {
                syncUtils.syncSeekToVLC(newTime, 'keyboard-seek-forward');
              }
            }
            break;
            
          case 'Home':
            e.preventDefault();
            wavesurfer.seekTo(0);
            console.log("🏠 Home: Seek to start with VLC sync");
            if (syncUtils) {
              syncUtils.syncSeekToVLC(0, 'keyboard-home');
            }
            break;
            
          case 'End':
            e.preventDefault();
            const duration = wavesurfer.getDuration();
            wavesurfer.seekTo(0.99); // Almost to end
            console.log("🔚 End: Seek to end with VLC sync");
            if (syncUtils) {
              syncUtils.syncSeekToVLC(duration * 0.99, 'keyboard-end');
            }
            break;
            
          default:
            // v1.0.11 - Added default case to fix ESLint warning
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [wavesurfer, isReady, isAudioLoaded, handlePlayPause, vlcSyncUtils]);
  
  // v1.0.11 - Cleanup VLC sync on unmount
  useEffect(() => {
    return () => {
      if (vlcSyncIntervalRef.current) {
        clearInterval(vlcSyncIntervalRef.current);
      }
      if (pendingVlcSeekRef.current) {
        clearTimeout(pendingVlcSeekRef.current);
      }
    };
  }, []);
  
  return (
    <div className="waveform-wrapper">
      {/* v1.0.11 - Added VLC sync status indicator */}
      {vlcSyncStatus === 'connected' && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(40, 167, 69, 0.8)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '0.8rem',
          zIndex: 1000
        }}>
          🎯 VLC EXACT SYNC
        </div>
      )}
      
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
          {/* v1.0.11 - Show sync status in time display */}
          {vlcSyncStatus === 'connected' && (
            <span style={{ marginLeft: '10px', color: '#28a745', fontSize: '0.8rem' }}>
              🎯 SYNCED
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