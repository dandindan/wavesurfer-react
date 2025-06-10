/**
 * File: src/app.js
 * Description: Main application component with enhanced MPV integration
 * 
 * Version History:
 * v1.0.17 (2025-06-10) - Enhanced MPV integration replacing VLC - Human Request
 *   - Replaced VLCController with MPVController for real-time sync
 *   - Enhanced control integration with 10-20ms response time
 *   - Improved multi-monitor window positioning
 *   - Professional error handling and status reporting
 *   - Real-time performance monitoring and sync statistics
 * 
 * Previous Versions:
 * v1.0.16 (2025-05-27) - Fixed VLC file passing - now passes File object instead of blob URL - Maoz Lahav
 * v1.0.15 (2025-05-27) - Enhanced for EXACT mirroring with WaveSurfer - Human Request
 * v1.0.14 (2025-05-21) - Fixed infinite update loop in file handling - Maoz Lahav
 * v1.0.13 (2025-05-19) - Integrated VLC controller with all controls in one row
 * v1.0.12 (2025-05-19) - Removed loop regions checkbox, set loopRegions to true
 * v1.0.11 (2025-05-19) - Updated to use @wavesurfer/react
 * v1.0.10 (2025-05-18) - Initial implementation based on original HTML
 */

import React, { useState, useRef, useEffect } from 'react';
import WaveSurferComponent from './components/WaveSurferComponent';
import MPVController from './components/MPVController';
import StatusBar from './components/StatusBar';
import UploadPanel from './components/UploadPanel';
import './assets/styles/main.css';
import './assets/styles/integrated-controls.css';

function App() {
  // State
  const [audioFile, setAudioFile] = useState(null); // For WaveSurfer (blob URL)
  const [originalFile, setOriginalFile] = useState(null); // For MPV (File object)
  const [fileIdentifier, setFileIdentifier] = useState(null); // Track unique files
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [waveSurferMuted, setWaveSurferMuted] = useState(false); // Manual mute control
  // Set loopRegions to true - regions will always loop
  const loopRegions = true;
  const [status, setStatus] = useState({ text: "No audio loaded", type: "info" });
  const [alert, setAlert] = useState({ message: "", isOpen: false, type: "info" });
  const [activeRegion, setActiveRegion] = useState(null);
  
  // Enhanced MPV integration state
  const [mpvConnected, setMpvConnected] = useState(false);
  const [mpvSyncActive, setMpvSyncActive] = useState(false);
  const [syncPerformance, setSyncPerformance] = useState({ avgDelay: 0, commands: 0 });
  
  // Refs
  const wavesurferRef = useRef(null);
  
  // Handler for file uploads
  const handleFileUpload = (file) => {
    if (!file) return;
    
    console.log("App: File uploaded:", file.name);
    
    // Create a unique identifier for the file to avoid re-processing the same file
    const newFileIdentifier = file instanceof File 
      ? `${file.name}-${file.size}-${file.lastModified}`
      : file;
    
    // Only update if this is a different file
    if (newFileIdentifier !== fileIdentifier) {
      setFileIdentifier(newFileIdentifier);
      
      // Store the original File object for MPV
      setOriginalFile(file);
      
      // Create blob URL for WaveSurfer
      if (file instanceof File) {
        const url = URL.createObjectURL(file);
        setAudioFile(url);
        setFileName(file.name);
        console.log("App: Created blob URL for WaveSurfer:", url);
        console.log("App: Stored original File object for MPV:", file.name);
      } else {
        // If it's already a URL, use it for both
        setAudioFile(file);
        setOriginalFile(file);
        setFileName(String(file));
      }
      
      setIsPlaying(false);
      setIsReady(false);
      setMpvConnected(false);
      setMpvSyncActive(false);
      setStatus({ text: "Loading...", type: "warning" });
      setAlert({ message: `File loaded: ${file instanceof File ? file.name : 'Audio file'}`, isOpen: true, type: "success" });
    }
  };
  
  // Enhanced handler for play/pause with MPV sync
  const handlePlayPause = (isCurrentlyPlaying) => {
    console.log("🎵 App: Play/Pause triggered");
    
    // If isCurrentlyPlaying is provided, use it, otherwise toggle
    const newPlayingState = isCurrentlyPlaying !== undefined ? isCurrentlyPlaying : !isPlaying;
    setIsPlaying(newPlayingState);
    
    // Show user feedback with MPV sync status
    const syncStatus = mpvSyncActive ? " (MPV Synced)" : "";
    setAlert({
      message: newPlayingState ? `Playing${syncStatus}` : `Paused${syncStatus}`,
      isOpen: true,
      type: "info"
    });
    
    console.log(`🎵 App: Setting play state to ${newPlayingState}`);
  };
  
  // Handler for WaveSurfer ready event
  const handleReady = (wavesurfer) => {
    wavesurferRef.current = wavesurfer;
    setIsReady(true);
    setStatus({ text: `Loaded: ${fileName}`, type: "success" });
    
    // Apply mute state if WaveSurfer was muted before audio loaded
    if (waveSurferMuted) {
      try {
        wavesurfer.setVolume(0);
      } catch (error) {
        console.error("Error applying mute on ready:", error);
      }
    }
  };
  
  // Handler for zoom in
  const handleZoomIn = () => {
    const newZoom = Math.min(1000, zoomLevel + 50);
    setZoomLevel(newZoom);
  };
  
  // Handler for zoom out
  const handleZoomOut = () => {
    const newZoom = Math.max(10, zoomLevel - 50);
    setZoomLevel(newZoom);
  };
  
  // Handler for reset zoom
  const handleResetZoom = () => {
    setZoomLevel(100);
  };
  
  // Handler for mute/unmute WaveSurfer
  const handleToggleWaveSurferMute = () => {
    const newMutedState = !waveSurferMuted;
    setWaveSurferMuted(newMutedState);
    
    // Apply mute to WaveSurfer instance if available
    if (wavesurferRef.current) {
      try {
        if (newMutedState) {
          wavesurferRef.current.setVolume(0);
        } else {
          wavesurferRef.current.setVolume(1);
        }
        
        const syncInfo = mpvSyncActive ? " (Check MPV sync)" : "";
        setAlert({
          message: newMutedState ? `WaveSurfer muted${syncInfo}` : "WaveSurfer unmuted",
          isOpen: true,
          type: "info"
        });
      } catch (error) {
        console.error("Error toggling WaveSurfer mute:", error);
      }
    }
  };
  
  // Handler for clear regions
  const handleClearRegions = () => {
    if (!wavesurferRef.current) {
      console.error("WaveSurfer instance not available");
      setAlert({ message: "Cannot clear regions: Player not initialized", isOpen: true, type: "danger" });
      return;
    }
    
    try {
      console.log("Attempting to clear regions...");
      
      // Try direct access to clearAllRegions method we added
      if (typeof wavesurferRef.current.clearAllRegions === 'function') {
        const result = wavesurferRef.current.clearAllRegions();
        if (result) {
          setAlert({ message: "All regions cleared", isOpen: true, type: "success" });
          // Reset active region
          setActiveRegion(null);
          return;
        }
      }
      
      // Try direct access to regions plugin
      if (wavesurferRef.current.regions) {
        console.log("Found regions plugin:", wavesurferRef.current.regions);
        wavesurferRef.current.regions.clearRegions();
        setAlert({ message: "All regions cleared", isOpen: true, type: "success" });
        // Reset active region
        setActiveRegion(null);
      } else {
        // Try to find the regions plugin in active plugins
        const regionsPlugin = wavesurferRef.current.getActivePlugins()?.find(
          plugin => plugin.name === 'regions' || plugin.params?.name === 'regions'
        );
        
        if (regionsPlugin) {
          console.log("Found regions plugin:", regionsPlugin);
          regionsPlugin.clearRegions();
          setAlert({ message: "All regions cleared", isOpen: true, type: "success" });
          // Reset active region
          setActiveRegion(null);
        } else {
          console.error("Regions plugin not found");
          setAlert({ message: "Could not clear regions", isOpen: true, type: "danger" });
        }
      }
    } catch (error) {
      console.error("Error clearing regions:", error);
      setAlert({ message: "Error clearing regions", isOpen: true, type: "danger" });
    }
  };
  
  // Handler for region activation
  const handleRegionActivated = (region) => {
    console.log("App: Region activated:", region);
    
    if (region.isClickPosition) {
      // This is a click position, not an actual region
      console.log(`App: Waveform clicked at ${region.start}s`);
      // Don't set this as activeRegion since it's just a click position
      const syncInfo = mpvSyncActive ? " (MPV synced)" : "";
      setAlert({
        message: `Seeking to ${region.start.toFixed(2)}s${syncInfo}`,
        isOpen: true,
        type: "info"
      });
    } else {
      // This is an actual region
      setActiveRegion(region);
      const syncInfo = mpvSyncActive ? " (MPV synced)" : "";
      setAlert({
        message: `Region selected: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s${syncInfo}`,
        isOpen: true,
        type: "info"
      });
    }
  };
  
  // Enhanced handler for MPV status changes
  const handleMPVStatusChange = (mpvStatus) => {
    console.log("App: MPV status changed:", mpvStatus);
    
    // Update connection status
    if (mpvStatus.isConnected !== mpvConnected) {
      setMpvConnected(mpvStatus.isConnected);
      setMpvSyncActive(mpvStatus.isConnected);
      
      if (mpvStatus.isConnected) {
        setStatus({ text: `${fileName} - MPV Connected`, type: "success" });
        setAlert({ message: "MPV connected and ready for real-time sync", isOpen: true, type: "success" });
      } else {
        setStatus({ text: `${fileName} - MPV Disconnected`, type: "warning" });
        setAlert({ message: "MPV disconnected", isOpen: true, type: "warning" });
      }
    }
    
    // Synchronize WaveSurfer playback with MPV if needed
    if (mpvStatus.isPlaying !== undefined && mpvStatus.isPlaying !== isPlaying) {
      setIsPlaying(mpvStatus.isPlaying);
    }
  };
  
  // Handler for MPV errors
  const handleMPVError = (error) => {
    console.error("App: MPV error:", error);
    setAlert({ message: `MPV Error: ${error}`, isOpen: true, type: "danger" });
    setStatus({ text: `${fileName} - MPV Error`, type: "danger" });
  };
  
  // Handler for MPV region playback
  const handleMPVRegionPlayback = (data) => {
    console.log("App: MPV playing region:", data);
    const regionInfo = `Region: ${data.region.start.toFixed(2)}s - ${data.region.end.toFixed(2)}s`;
    setAlert({
      message: `MPV ${regionInfo}`,
      isOpen: true,
      type: "info"
    });
  };
  
  // Enhanced playback speed handler with MPV sync
  const handlePlaybackSpeedChange = (newSpeed) => {
    setPlaybackSpeed(newSpeed);
    
    // Show feedback with sync status
    const syncInfo = mpvSyncActive ? " (MPV synced)" : "";
    setAlert({
      message: `Speed: ${newSpeed.toFixed(1)}x${syncInfo}`,
      isOpen: true,
      type: "info"
    });
  };
  
  // Performance monitoring for sync
  const handleSyncPerformanceUpdate = (perfData) => {
    setSyncPerformance(perfData);
  };
  
  // Close alert after 3 seconds
  useEffect(() => {
    if (alert.isOpen) {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, isOpen: false }));
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [alert.isOpen]);
  
  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (audioFile && audioFile.startsWith && audioFile.startsWith('blob:')) {
        URL.revokeObjectURL(audioFile);
      }
    };
  }, [audioFile]);
  
  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Global shortcuts that work anywhere
      switch (e.code) {
        case 'F1':
          if (e.ctrlKey) {
            e.preventDefault();
            console.log("🎯 Sync Status:", {
              mpvConnected,
              mpvSyncActive,
              syncPerformance,
              fileName
            });
            setAlert({
              message: `Sync Status: ${mpvSyncActive ? 'Active' : 'Inactive'} | Avg Delay: ${syncPerformance.avgDelay.toFixed(1)}ms`,
              isOpen: true,
              type: "info"
            });
          }
          break;
        case 'F2':
          if (e.ctrlKey) {
            e.preventDefault();
            handleToggleWaveSurferMute();
          }
          break;
        default:
          break;
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [mpvConnected, mpvSyncActive, syncPerformance, fileName, handleToggleWaveSurferMute]);
  
  return (
    <div className="container">
      <h1>WaveSurfer with Regions and MPV</h1>
      
      <StatusBar status={status.text} type={status.type} />
      
      {/* Enhanced status indicators */}
      {mpvSyncActive && (
        <div style={{
          textAlign: 'center',
          padding: '8px',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          color: '#28a745',
          borderRadius: '4px',
          marginBottom: '10px',
          fontSize: '0.9rem'
        }}>
          🎯 MPV Real-time Sync Active | Avg Response: {syncPerformance.avgDelay.toFixed(1)}ms | Commands: {syncPerformance.commands}
        </div>
      )}
      
      <UploadPanel onFileUpload={handleFileUpload} />
      
      <WaveSurferComponent
        audioFile={audioFile}
        isPlaying={isPlaying}
        loopRegions={loopRegions}
        zoomLevel={zoomLevel}
        playbackSpeed={playbackSpeed}
        isMuted={waveSurferMuted}
        onPlayPause={handlePlayPause}
        onReady={handleReady}
        onRegionActivated={handleRegionActivated}
      />
      
      <div className="all-controls">
        {/* First row: sliders for zoom and speed */}
        <div className="controls-row">
          {/* Zoom control slider */}
          <div className="slider-container">
            <span className="slider-label">Zoom:</span>
            <input
              type="range"
              id="zoom-slider"
              min="10"
              max="1000"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
            />
            <span id="zoom-value" className="slider-value">{zoomLevel}</span>
          </div>

          {/* Playback speed control slider with MPV sync */}
          <div className="slider-container">
            <span className="slider-label">Speed:</span>
            <input
              type="range"
              id="speed-slider"
              min="0.5"
              max="3"
              step="0.1"
              value={playbackSpeed}
              onChange={(e) => handlePlaybackSpeedChange(Number(e.target.value))}
            />
            <span id="speed-value" className="slider-value">{playbackSpeed.toFixed(1)}x</span>
          </div>
        </div>
        
        {/* Second row: combined WaveSurfer and MPV controls */}
        <div className="main-controls">
          {/* WaveSurfer control buttons */}
          <div className="player-buttons">
            <button id="play-pause" onClick={() => handlePlayPause()}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button 
              id="toggle-mute" 
              onClick={handleToggleWaveSurferMute} 
              disabled={!isReady}
              className={waveSurferMuted ? 'muted' : ''}
              title={waveSurferMuted ? 'Unmute WaveSurfer audio' : 'Mute WaveSurfer audio (MPV audio stays active)'}
            >
              <i className={`fas ${waveSurferMuted ? 'fa-volume-mute' : 'fa-volume-up'}`}></i> WS
            </button>
            <button id="zoom-in" onClick={handleZoomIn} disabled={!isReady}>
              Zoom In
            </button>
            <button id="zoom-out" onClick={handleZoomOut} disabled={!isReady}>
              Zoom Out
            </button>
            <button id="reset-zoom" onClick={handleResetZoom} disabled={!isReady}>
              Reset Zoom
            </button>
            <button id="clear-regions" className="danger" onClick={handleClearRegions} disabled={!isReady}>
              Clear Regions
            </button>
          </div>
          
          {/* Enhanced MPV controls section */}
          <div className="vlc-section">
            <MPVController
              mediaFile={originalFile}
              wavesurferInstance={wavesurferRef.current}
              activeRegion={activeRegion}
              onStatusChange={handleMPVStatusChange}
              onError={handleMPVError}
              onRegionPlayback={handleMPVRegionPlayback}
              onPerformanceUpdate={handleSyncPerformanceUpdate}
            />
          </div>
        </div>
      </div>
      
      {/* Enhanced alert system */}
      {alert.isOpen && (
        <div className={`alert alert-${alert.type}`} style={{
          position: 'relative',
          animation: 'fadeIn 0.3s ease-in'
        }}>
          {alert.message}
          {/* Add close button for persistent alerts */}
          <button 
            onClick={() => setAlert(prev => ({ ...prev, isOpen: false }))}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'inherit',
              fontSize: '1.2rem',
              cursor: 'pointer',
              opacity: 0.7,
              padding: '0',
              width: '20px',
              height: '20px'
            }}
            title="Close alert"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Enhanced help text */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        fontSize: '0.7rem',
        color: '#6c757d',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: '8px',
        borderRadius: '4px',
        maxWidth: '200px'
      }}>
        <strong>Shortcuts:</strong><br/>
        Space: Play/Pause<br/>
        Ctrl+F1: Sync Status<br/>
        Ctrl+F2: Toggle Mute<br/>
        Ctrl+Shift+M: MPV Control<br/>
        Ctrl+←/→: Seek ±5s
      </div>
    </div>
  );
}

export default App;