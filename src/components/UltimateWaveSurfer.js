// src/components/UltimateWaveSurfer.js - v22 COMPLETE - Cleaned Up
import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
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
  
  // 🔄 Region loop state (using ref to avoid closure issues)
  const [loopRegions, setLoopRegions] = useState(true);
  const loopRegionsRef = useRef(true);
  
  // 🎯 Ultimate Sync System State
  const [syncActive, setSyncActive] = useState(false);
  const [syncMode, setSyncMode] = useState('idle');
  const [syncAccuracy, setSyncAccuracy] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  
  // 🔄 Sync refs for avoiding closure issues
  const syncActiveRef = useRef(false);
  const syncModeRef = useRef('idle');
  const lastWsTimeRef = useRef(0);
  const lastMpvTimeRef = useRef(0);
  const syncIntervalRef = useRef(null);
  const commandQueueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const driftHistoryRef = useRef([]);
  const performanceStatsRef = useRef({
    syncEvents: 0,
    driftCorrections: 0,
    avgAccuracy: 0,
    lastReset: Date.now()
  });
  
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
    addRegion,
    mpvConnected,
    mpvCurrentTime,
    mpvPlaying,
    setMpvState,
    updateSyncAccuracy
  } = useAudioSyncStore();

  // 🚀 Create regions plugin SEPARATELY
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
      height: 400,
      splitChannels: false,
      colorMap: 'roseus',
      scale: 'linear',
      frequencyMax: 2500
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
      progressColor: '#08c3f2',
      regionColor: 'rgba(74, 158, 255, 0.8)',
      regionBorderColor: '#4a9eff'
    })
  ], [regions]);

  // 🎯 useWavesurfer hook
  const { wavesurfer, isReady, currentTime: wsCurrentTime } = useWavesurfer({
    container: containerRef,
    height,
    waveColor: '#777',
    progressColor: '#08c3f2',
    cursorColor: '#ff5722',
    cursorWidth: 2,
    normalize: true,
    responsive: true,
    hideScrollbar: false,
    url: audioUrl,
    plugins
  });

  // 🎯 Setup regions after decode - Use ref to prevent multiple setups
  const isRegionsSetupRef = useRef(false);
  
  useEffect(() => {
    if (!wavesurfer || !isReady || isRegionsSetupRef.current) return;

    const setupRegions = () => {
      console.log('🎵 Setting up regions with loop functionality - ONCE');
      isRegionsSetupRef.current = true;
      
      try {
        // Enable drag selection
        regions.enableDragSelection({
          color: 'rgba(74, 158, 255, 0.1)',
        });

        // Set up event handlers
        let activeRegionRef = null;

        const handleRegionIn = (region) => {
          console.log('🎵 Region in:', region);
          activeRegionRef = region;
          setActiveRegion(region);
        };

        const handleRegionOut = (region) => {
          console.log('🎵 Region out:', region, 'Loop enabled:', loopRegionsRef.current);
          if (activeRegionRef === region) {
            if (loopRegionsRef.current) {
              region.play();
              console.log('🔄 Looping region:', region);
            } else {
              activeRegionRef = null;
              setActiveRegion(null);
              console.log('⏸️ No loop - stopping region');
            }
          }
        };

        const handleRegionClick = (region, e) => {
          e.stopPropagation();
          console.log('🎵 Region clicked:', region);
          
          activeRegionRef = region;
          setActiveRegion(region);
          region.play(true);
          region.setOptions({ color: randomColor() });
          
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            wavesurfer.seekTo(region.start / duration);
            setCurrentTime(region.start);
          }
          
          if (onRegionClick) onRegionClick(region);
        };

        const handleRegionCreated = (region) => {
          console.log('🎵 Region created ONCE:', region);
          addRegion(region);
          setStatus(`Region created: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s`);
        };

        const handleRegionUpdated = (region) => {
          console.log('🎵 Region updated:', region);
          setActiveRegion(region);
        };

        const handleInteraction = () => {
          activeRegionRef = null;
          setActiveRegion(null);
        };

        // Attach event listeners ONCE
        regions.on('region-in', handleRegionIn);
        regions.on('region-out', handleRegionOut);
        regions.on('region-clicked', handleRegionClick);
        regions.on('region-created', handleRegionCreated);
        regions.on('region-updated', handleRegionUpdated);
        wavesurfer.on('interaction', handleInteraction);

        console.log('✅ Regions setup complete with loop functionality');
        
        return () => {
          console.log('🧹 Cleaning up region event listeners');
          regions.off('region-in', handleRegionIn);
          regions.off('region-out', handleRegionOut);
          regions.off('region-clicked', handleRegionClick);
          regions.off('region-created', handleRegionCreated);
          regions.off('region-updated', handleRegionUpdated);
          wavesurfer.off('interaction', handleInteraction);
          isRegionsSetupRef.current = false;
        };
      } catch (error) {
        console.error('❌ Error setting up regions:', error);
        isRegionsSetupRef.current = false;
      }
    };

    let cleanup;
    
    if (wavesurfer.getDuration() > 0) {
      cleanup = setupRegions();
    } else {
      wavesurfer.once('decode', () => {
        cleanup = setupRegions();
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [wavesurfer, isReady, regions, setActiveRegion, addRegion, setStatus, randomColor, setCurrentTime, onRegionClick]);

  // 🔄 Update ref when state changes
  useEffect(() => {
    loopRegionsRef.current = loopRegions;
  }, [loopRegions]);

  // 🚀 Professional command queue system
  const queueMPVCommand = useCallback(async (command, priority = 'normal') => {
    if (!mpvConnected) return false;
    
    return new Promise((resolve, reject) => {
      const commandObj = {
        id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        command,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      if (priority === 'high') {
        commandQueueRef.current.unshift(commandObj);
      } else {
        commandQueueRef.current.push(commandObj);
      }
      
      processCommandQueue();
    });
  }, [mpvConnected]);
  
  // Ultra-fast command processing
  const processCommandQueue = useCallback(async () => {
    if (isProcessingRef.current || commandQueueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    
    try {
      while (commandQueueRef.current.length > 0) {
        const cmd = commandQueueRef.current.shift();
        
        try {
          const response = await fetch('/api/mpv-command', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Sync-Source': 'ultimate-sync'
            },
            body: JSON.stringify({
              command: cmd.command,
              source: 'sync-engine',
              priority: cmd.priority
            }),
            signal: AbortSignal.timeout(1000)
          });
          
          if (response.ok) {
            const result = await response.json();
            cmd.resolve(result);
          } else {
            cmd.reject(new Error(`Command failed: ${response.status}`));
          }
        } catch (error) {
          cmd.reject(error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2));
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, []);
  
  // Calculate sync accuracy and drift
  const calculateSyncAccuracy = useCallback(() => {
    if (!mpvConnected || !wavesurfer) return 1;
    
    const wsTime = wavesurfer.getCurrentTime() || 0;
    const mpvTime = mpvCurrentTime || 0;
    const timeDrift = Math.abs(wsTime - mpvTime);
    
    driftHistoryRef.current.push({
      time: Date.now(),
      drift: timeDrift,
      wsTime,
      mpvTime
    });
    
    if (driftHistoryRef.current.length > 20) {
      driftHistoryRef.current.shift();
    }
    
    const avgDrift = driftHistoryRef.current.reduce((sum, d) => sum + d.drift, 0) / driftHistoryRef.current.length;
    performanceStatsRef.current.avgAccuracy = avgDrift;
    
    return timeDrift;
  }, [mpvConnected, mpvCurrentTime, wavesurfer]);
  
  // Sync WaveSurfer to MPV (MPV is master)
  const syncWaveSurferToMPV = useCallback(async () => {
    if (!wavesurfer || !mpvConnected || syncModeRef.current !== 'mpv-master') return;
    
    try {
      const wsTime = wavesurfer.getCurrentTime() || 0;
      const mpvTime = mpvCurrentTime || 0;
      const wsPlaying = wavesurfer.isPlaying();
      const timeDrift = Math.abs(wsTime - mpvTime);
      
      if (timeDrift > 0.05) {
        const duration = wavesurfer.getDuration() || 1;
        wavesurfer.seekTo(mpvTime / duration);
        performanceStatsRef.current.driftCorrections++;
        console.log(`🔄 WS←MPV time sync: ${wsTime.toFixed(3)}s → ${mpvTime.toFixed(3)}s`);
      }
      
      if (wsPlaying !== mpvPlaying) {
        if (mpvPlaying) {
          wavesurfer.play();
        } else {
          wavesurfer.pause();
        }
        console.log(`🔄 WS←MPV play state: ${wsPlaying} → ${mpvPlaying}`);
      }
      
      performanceStatsRef.current.syncEvents++;
      
    } catch (error) {
      console.warn('WS←MPV sync error:', error);
    }
  }, [wavesurfer, mpvConnected, mpvCurrentTime, mpvPlaying]);
  
  // Sync MPV to WaveSurfer (WaveSurfer is master)
  const syncMPVToWaveSurfer = useCallback(async () => {
    if (!wavesurfer || !mpvConnected || syncModeRef.current !== 'wavesurfer-master') return;
    
    try {
      const wsTime = wavesurfer.getCurrentTime() || 0;
      const wsPlaying = wavesurfer.isPlaying();
      const timeDrift = Math.abs(wsTime - (mpvCurrentTime || 0));
      
      if (timeDrift > 0.05) {
        await queueMPVCommand(['seek', wsTime, 'absolute', 'exact'], 'high');
        performanceStatsRef.current.driftCorrections++;
        console.log(`🔄 MPV←WS time sync: ${(mpvCurrentTime || 0).toFixed(3)}s → ${wsTime.toFixed(3)}s`);
      }
      
      if (wsPlaying !== mpvPlaying) {
        await queueMPVCommand(['set_property', 'pause', !wsPlaying], 'high');
        console.log(`🔄 MPV←WS play state: ${mpvPlaying} → ${wsPlaying}`);
      }
      
      performanceStatsRef.current.syncEvents++;
      
    } catch (error) {
      console.warn('MPV←WS sync error:', error);
    }
  }, [wavesurfer, mpvConnected, mpvCurrentTime, mpvPlaying, queueMPVCommand]);
  
  // Master sync mode determination
  const determineSyncMode = useCallback(() => {
    if (!mpvConnected) {
      syncModeRef.current = 'idle';
      setSyncMode('idle');
      return;
    }
    
    if (activeRegion) {
      syncModeRef.current = 'wavesurfer-master';
      setSyncMode('wavesurfer-master');
      return;
    }
    
    const wsTime = wavesurfer?.getCurrentTime() || 0;
    const mpvTime = mpvCurrentTime || 0;
    const wsChange = Math.abs(wsTime - lastWsTimeRef.current);
    const mpvChange = Math.abs(mpvTime - lastMpvTimeRef.current);
    
    if (wsChange > 0.1) {
      syncModeRef.current = 'wavesurfer-master';
      setSyncMode('wavesurfer-master');
    } else if (mpvChange > 0.1) {
      syncModeRef.current = 'mpv-master';
      setSyncMode('mpv-master');
    }
    
    lastWsTimeRef.current = wsTime;
    lastMpvTimeRef.current = mpvTime;
    
  }, [mpvConnected, activeRegion, wavesurfer, mpvCurrentTime]);
  
  // Main sync loop
  const runSyncLoop = useCallback(async () => {
    if (!syncActiveRef.current || !mpvConnected || !wavesurfer) return;
    
    try {
      const accuracy = calculateSyncAccuracy();
      setSyncAccuracy(accuracy);
      setLastSyncTime(Date.now());
      
      updateSyncAccuracy(accuracy);
      determineSyncMode();
      
      if (syncModeRef.current === 'wavesurfer-master') {
        await syncMPVToWaveSurfer();
      } else if (syncModeRef.current === 'mpv-master') {
        await syncWaveSurferToMPV();
      }
      
      if (accuracy < 0.05) {
        setStatus(`🎯 Perfect Sync: ${(accuracy * 1000).toFixed(0)}ms (${syncModeRef.current})`);
      } else {
        setStatus(`⚠️ Sync Drift: ${(accuracy * 1000).toFixed(0)}ms (${syncModeRef.current})`);
      }
      
    } catch (error) {
      console.error('Sync loop error:', error);
    }
  }, [calculateSyncAccuracy, determineSyncMode, syncMPVToWaveSurfer, syncWaveSurferToMPV, mpvConnected, wavesurfer, updateSyncAccuracy, setStatus]);
  
  // Start sync system
  const startSync = useCallback(() => {
    if (syncActiveRef.current || !mpvConnected || !wavesurfer) return;
    
    console.log('🚀 Starting Ultimate Sync System...');
    
    syncActiveRef.current = true;
    setSyncActive(true);
    
    performanceStatsRef.current = {
      syncEvents: 0,
      driftCorrections: 0,
      avgAccuracy: 0,
      lastReset: Date.now()
    };
    
    syncIntervalRef.current = setInterval(runSyncLoop, 800);
    setStatus('🎯 Ultimate Sync System Active');
    
  }, [mpvConnected, wavesurfer, runSyncLoop, setStatus]);
  
  // Stop sync system
  const stopSync = useCallback(() => {
    if (!syncActiveRef.current) return;
    
    console.log('🛑 Stopping Ultimate Sync System...');
    
    syncActiveRef.current = false;
    setSyncActive(false);
    syncModeRef.current = 'idle';
    setSyncMode('idle');
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    
    commandQueueRef.current.forEach(cmd => {
      cmd.reject(new Error('Sync stopped'));
    });
    commandQueueRef.current = [];
    
    setStatus('Sync system stopped');
    
  }, [setStatus]);
  
  // Manual sync trigger
  const triggerManualSync = useCallback(async (direction = 'auto') => {
    if (!mpvConnected || !wavesurfer) return false;
    
    try {
      if (direction === 'to-mpv' || direction === 'auto') {
        await syncMPVToWaveSurfer();
      }
      if (direction === 'to-wavesurfer' || direction === 'auto') {
        await syncWaveSurferToMPV();
      }
      
      setStatus(`🎯 Manual sync completed (${direction})`);
      return true;
    } catch (error) {
      console.error('Manual sync failed:', error);
      return false;
    }
  }, [mpvConnected, wavesurfer, syncMPVToWaveSurfer, syncWaveSurferToMPV, setStatus]);
  
  // Auto-start/stop based on MPV connection
  useEffect(() => {
    if (mpvConnected && wavesurfer && !syncActiveRef.current) {
      setTimeout(startSync, 1000);
    } else if (!mpvConnected && syncActiveRef.current) {
      stopSync();
    }
  }, [mpvConnected, wavesurfer, startSync, stopSync]);

  // 🎯 Handle wavesurfer ready
  useEffect(() => {
    if (isReady && wavesurfer) {
      console.log('🎯 WaveSurfer is ready!');
      
      setDuration(wavesurfer.getDuration() || 0);
      setLoading(false);
      setStatus('🎯 Ultimate WaveSurfer ready!');
      
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
        
        setLoopRegions: (loop) => {
          setLoopRegions(loop);
          loopRegionsRef.current = loop;
          setStatus(loop ? 'Region looping enabled' : 'Region looping disabled');
        },
        
        getLoopRegions: () => loopRegionsRef.current,
        
        sync: {
          start: startSync,
          stop: stopSync,
          trigger: triggerManualSync,
          isActive: () => syncActive,
          getMode: () => syncMode,
          getAccuracy: () => syncAccuracy,
          getStats: () => ({
            syncEvents: performanceStatsRef.current.syncEvents,
            driftCorrections: performanceStatsRef.current.driftCorrections,
            avgAccuracy: performanceStatsRef.current.avgAccuracy,
            commandQueueLength: commandQueueRef.current.length
          })
        },
        
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
        
        getDebugInfo: () => ({
          isReady,
          duration: wavesurfer?.getDuration() || 0,
          currentTime: wavesurfer?.getCurrentTime() || 0,
          isPlaying: wavesurfer?.isPlaying() || false,
          regionsCount: regions?.getRegions()?.length || 0,
          loopRegions: loopRegionsRef.current
        })
      };
      
      if (process.env.NODE_ENV === 'development') {
        window.ultimateWaveSurfer = wavesurfer;
        window.ultimateSync = {
          start: startSync,
          stop: stopSync,
          trigger: triggerManualSync,
          active: syncActive,
          mode: syncMode,
          accuracy: syncAccuracy
        };
        console.log('🎯 Ultimate WaveSurfer API ready');
      }
    }
  }, [wavesurfer, isReady, regions, setCurrentTime, setIsPlaying, setActiveRegion, setStatus, randomColor, startSync, stopSync, triggerManualSync, syncActive, syncMode, syncAccuracy, setLoopRegions]);

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

  // 🧹 Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 UltimateWaveSurfer cleanup...');
      
      if (syncActiveRef.current) {
        stopSync();
      }
      
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      
      commandQueueRef.current.forEach(cmd => {
        cmd.reject(new Error('Component unmounted'));
      });
      commandQueueRef.current = [];
      
      syncActiveRef.current = false;
      isProcessingRef.current = false;
      isRegionsSetupRef.current = false;
      
      console.log('✅ UltimateWaveSurfer cleanup complete');
    };
  }, [stopSync]);

  return (
    <div className={`ultimate-wavesurfer ${className}`}>
      <style>{`
        .waveform-container ::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }
        .waveform-container ::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-radius: 4px;
        }
        .waveform-container ::-webkit-scrollbar-thumb {
          background: linear-gradient(45deg, #08c3f2, #4a9eff);
          border-radius: 4px;
          box-shadow: 0 0 8px rgba(8, 195, 242, 0.6);
        }
        .waveform-container ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(45deg, #4a9eff, #08c3f2);
          box-shadow: 0 0 15px rgba(8, 195, 242, 1);
        }
        
        .minimap-container ::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }
        .minimap-container ::-webkit-scrollbar-track {
          background: #2a2a2a;
          border-radius: 4px;
        }
        .minimap-container ::-webkit-scrollbar-thumb {
          background: linear-gradient(45deg, #08c3f2, #4a9eff);
          border-radius: 4px;
          box-shadow: 
            0 0 10px rgba(8, 195, 242, 1),
            0 0 20px rgba(8, 195, 242, 0.8),
            0 0 30px rgba(8, 195, 242, 0.6),
            inset 0 0 10px rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(8, 195, 242, 0.8);
        }
        .minimap-container ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(45deg, #4a9eff, #08c3f2);
          box-shadow: 
            0 0 15px rgba(8, 195, 242, 1),
            0 0 30px rgba(8, 195, 242, 1),
            0 0 45px rgba(8, 195, 242, 0.8),
            inset 0 0 15px rgba(255, 255, 255, 0.3);
          border: 2px solid rgba(8, 195, 242, 1);
        }
        
        @keyframes syncPulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

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
      
      <div 
        ref={minimapRef} 
        className="minimap-container"
        style={{
          width: '100%',
          marginTop: '10px',
          borderRadius: '4px',
          overflow: 'auto',
          backgroundColor: '#2a2a2a',
          border: '1px solid #333'
        }}
      />
    </div>
  );
};

export default UltimateWaveSurfer;