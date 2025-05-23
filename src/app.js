/**
 * File: src/App.js
 * Description: Main application component with integrated controls
 * 
 * Version History:
 * v1.0.0 (2025-05-18) - Initial implementation based on original HTML
 * v1.0.1 (2025-05-19) - Updated to use @wavesurfer/react
 * v1.0.2 (2025-05-19) - Removed loop regions checkbox, set loopRegions to true
 * v1.0.3 (2025-05-19) - Integrated VLC controller with all controls in one row
 */

import React, { useState, useRef, useEffect } from 'react';
import WaveSurferComponent from './components/WaveSurferComponent';
import VLCController from './components/VLCController';
import StatusBar from './components/StatusBar';
import UploadPanel from './components/UploadPanel';
import './assets/styles/main.css';
import './assets/styles/integrated-controls.css';

function App() {
  // State
  const [audioFile, setAudioFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  // Set loopRegions to true - regions will always loop
  const loopRegions = true;
  const [status, setStatus] = useState({ text: "No audio loaded", type: "info" });
  const [alert, setAlert] = useState({ message: "", isOpen: false, type: "info" });
  const [activeRegion, setActiveRegion] = useState(null);
  const [filePath, setFilePath] = useState(null);
  
  // Refs
  const wavesurferRef = useRef(null);
  
  // Handler for file uploads
  const handleFileUpload = (file) => {
    if (!file) return;
    
    setAudioFile(file);
    setFileName(file.name);
    setIsPlaying(false);
    setIsReady(false);
    setStatus({ text: "Loading...", type: "warning" });
    setAlert({ message: `File uploaded: ${file.name}`, isOpen: true, type: "success" });
    
    // Create a path for VLC to use (in a real implementation, this would be a server-side path)
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      setFilePath(url);
    } else {
      setFilePath(file);
    }
  };
  
  // Handler for play/pause
  const handlePlayPause = (isCurrentlyPlaying) => {
    // If isCurrentlyPlaying is provided, use it, otherwise toggle
    const newPlayingState = isCurrentlyPlaying !== undefined ? isCurrentlyPlaying : !isPlaying;
    setIsPlaying(newPlayingState);
    
    setAlert({
      message: newPlayingState ? "Audio playing" : "Audio paused",
      isOpen: true,
      type: "info"
    });
  };
  
  // Handler for WaveSurfer ready event
  const handleReady = (wavesurfer) => {
    wavesurferRef.current = wavesurfer;
    setIsReady(true);
    setStatus({ text: `Loaded: ${fileName}`, type: "success" });
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
  
  // Handler for clear regions
  const handleClearRegions = () => {
    if (!wavesurferRef.current) {
      console.error("WaveSurfer instance not available");
      setAlert({ message: "Cannot clear regions: Player not initialized", isOpen: true, type: "danger" });
      return;
    }
    
    try {
      console.log("Attempting to clear regions...");
      
      // Try direct access to regions plugin
      if (wavesurferRef.current.regions) {
        console.log("Found regions plugin:", wavesurferRef.current.regions);
        wavesurferRef.current.regions.clearRegions();
        setAlert({ message: "All regions cleared", isOpen: true, type: "success" });
        // Reset active region
        setActiveRegion(null);
      } else {
        // Try to find the regions plugin in active plugins
        const regionsPlugin = wavesurferRef.current.getActivePlugins().find(
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
    setActiveRegion(region);
  };
  
  // Handler for VLC status changes
  const handleVLCStatusChange = (vlcStatus) => {
    // Synchronize WaveSurfer playback with VLC if needed
    if (vlcStatus.isPlaying !== isPlaying) {
      setIsPlaying(vlcStatus.isPlaying);
    }
  };
  
  // Handler for VLC errors
  const handleVLCError = (error) => {
    setAlert({ message: error, isOpen: true, type: "danger" });
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
  
  return (
    <div className="container">
      <h1>WaveSurfer with Regions and VLC</h1>
      
      <StatusBar status={status.text} type={status.type} />
      
      <UploadPanel onFileUpload={handleFileUpload} />
      
      <WaveSurferComponent
        audioFile={audioFile}
        isPlaying={isPlaying}
        loopRegions={loopRegions}
        zoomLevel={zoomLevel}
        playbackSpeed={playbackSpeed}
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
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            />
            <span id="speed-value" className="slider-value">{playbackSpeed.toFixed(1)}x</span>
          </div>
        </div>
        
        {/* Second row: combined WaveSurfer and VLC controls */}
        <div className="main-controls">
          {/* WaveSurfer control buttons */}
          <div className="player-buttons">
            <button id="play-pause" onClick={() => handlePlayPause()}>
              {isPlaying ? 'Pause' : 'Play'}
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
          
          {/* VLC controls section */}
          <div className="vlc-section">
            <VLCController
              mediaFile={filePath}
              wavesurferInstance={wavesurferRef.current}
              activeRegion={activeRegion}
              onStatusChange={handleVLCStatusChange}
              onError={handleVLCError}
            />
          </div>
        </div>
      </div>
      
      {alert.isOpen && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}
    </div>
  );
}

export default App;