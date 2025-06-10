/**
 * File: src/App.js
 * Description: CLEAN App - No Overlapping Elements
 * 
 * Version History:
 * v4.0.0 (2025-06-10) - CLEAN SIMPLE VERSION - Human Request
 *   - REMOVED overlapping help text elements
 *   - CLEAN UI with no visual mess
 *   - KEPT only essential features
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
  const [audioFile, setAudioFile] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [fileIdentifier, setFileIdentifier] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [waveSurferMuted, setWaveSurferMuted] = useState(false);
  const loopRegions = true;
  const [status, setStatus] = useState({ text: "No audio loaded", type: "info" });
  const [alert, setAlert] = useState({ message: "", isOpen: false, type: "info" });
  const [activeRegion, setActiveRegion] = useState(null);
  const [mpvConnected, setMpvConnected] = useState(false);
  
  // Refs
  const wavesurferRef = useRef(null);
  
  // Handler for file uploads
  const handleFileUpload = (file) => {
    if (!file) return;
    
    console.log("App: File uploaded:", file.name);
    
    const newFileIdentifier = file instanceof File 
      ? `${file.name}-${file.size}-${file.lastModified}`
      : file;
    
    if (newFileIdentifier !== fileIdentifier) {
      setFileIdentifier(newFileIdentifier);
      
      setOriginalFile(file);
      
      if (file instanceof File) {
        const url = URL.createObjectURL(file);
        setAudioFile(url);
        setFileName(file.name);
        console.log("App: Created blob URL for WaveSurfer:", url);
      } else {
        setAudioFile(file);
        setOriginalFile(file);
        setFileName(String(file));
      }
      
      setIsPlaying(false);
      setIsReady(false);
      setMpvConnected(false);
      setStatus({ text: "Loading...", type: "warning" });
      setAlert({ message: `File loaded: ${file instanceof File ? file.name : 'Audio file'}`, isOpen: true, type: "success" });
    }
  };
  
  // Handler for play/pause
  const handlePlayPause = (isCurrentlyPlaying) => {
    console.log("🎵 App: Play/Pause triggered");
    
    const newPlayingState = isCurrentlyPlaying !== undefined ? isCurrentlyPlaying : !isPlaying;
    setIsPlaying(newPlayingState);
    
    setAlert({
      message: newPlayingState ? `Playing` : `Paused`,
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
    
    if (wavesurferRef.current) {
      try {
        if (newMutedState) {
          wavesurferRef.current.setVolume(0);
        } else {
          wavesurferRef.current.setVolume(1);
        }
        
        setAlert({
          message: newMutedState ? `WaveSurfer muted` : "WaveSurfer unmuted",
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
      
      if (typeof wavesurferRef.current.clearAllRegions === 'function') {
        const result = wavesurferRef.current.clearAllRegions();
        if (result) {
          setAlert({ message: "All regions cleared", isOpen: true, type: "success" });
          setActiveRegion(null);
          return;
        }
      }
      
      if (wavesurferRef.current.regions) {
        console.log("Found regions plugin:", wavesurferRef.current.regions);
        wavesurferRef.current.regions.clearRegions();
        setAlert({ message: "All regions cleared", isOpen: true, type: "success" });
        setActiveRegion(null);
      } else {
        const regionsPlugin = wavesurferRef.current.getActivePlugins()?.find(
          plugin => plugin.name === 'regions' || plugin.params?.name === 'regions'
        );
        
        if (regionsPlugin) {
          console.log("Found regions plugin:", regionsPlugin);
          regionsPlugin.clearRegions();
          setAlert({ message: "All regions cleared", isOpen: true, type: "success" });
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
      console.log(`App: Waveform clicked at ${region.start}s`);
      setAlert({
        message: `Seeking to ${region.start.toFixed(2)}s`,
        isOpen: true,
        type: "info"
      });
    } else {
      setActiveRegion(region);
      setAlert({
        message: `Region selected: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s`,
        isOpen: true,
        type: "info"
      });
    }
  };
  
  // Handler for MPV status changes
  const handleMPVStatusChange = (mpvStatus) => {
    console.log("App: MPV status changed:", mpvStatus);
    
    if (mpvStatus.isConnected !== mpvConnected) {
      setMpvConnected(mpvStatus.isConnected);
      
      if (mpvStatus.isConnected) {
        setStatus({ text: `${fileName} - MPV Connected`, type: "success" });
        setAlert({ message: "MPV connected and ready", isOpen: true, type: "success" });
      } else {
        setStatus({ text: `${fileName} - MPV Disconnected`, type: "warning" });
        setAlert({ message: "MPV disconnected", isOpen: true, type: "warning" });
      }
    }
    
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
  
  // Playback speed handler
  const handlePlaybackSpeedChange = (newSpeed) => {
    setPlaybackSpeed(newSpeed);
    
    setAlert({
      message: `Speed: ${newSpeed.toFixed(1)}x`,
      isOpen: true,
      type: "info"
    });
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
  
  return (
    <div className="container">
      <h1>WaveSurfer with Regions and MPV</h1>
      
      <StatusBar status={status.text} type={status.type} />
      
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

          {/* Playback speed control slider */}
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
          
          {/* MPV controls section */}
          <div className="vlc-section">
            <MPVController
              mediaFile={originalFile}
              wavesurferInstance={wavesurferRef.current}
              activeRegion={activeRegion}
              onStatusChange={handleMPVStatusChange}
              onError={handleMPVError}
              onRegionPlayback={handleMPVRegionPlayback}
            />
          </div>
        </div>
      </div>
      
      {/* CLEAN alert system */}
      {alert.isOpen && (
        <div className={`alert alert-${alert.type}`} style={{
          position: 'relative',
          animation: 'fadeIn 0.3s ease-in'
        }}>
          {alert.message}
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
      
      {/* REMOVED ALL OVERLAPPING HELP TEXT - CLEAN! */}
    </div>
  );
}

export default App;