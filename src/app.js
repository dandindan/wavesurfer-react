/**
 * File: src/App.js
 * Description: Main application component
 * 
 * Version History:
 * v1.0.0 (2025-05-18) - Initial implementation based on original HTML
 * v1.0.1 (2025-05-19) - Updated to use @wavesurfer/react
 * v1.0.2 (2025-05-19) - Fixed layout and status display
 */

import React, { useState, useRef, useEffect } from 'react';
import WaveSurferComponent from './components/WaveSurferComponent';
import StatusBar from './components/StatusBar';
import UploadPanel from './components/UploadPanel';
import './assets/styles/main.css';

function App() {
  // State
  const [audioFile, setAudioFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loopRegions, setLoopRegions] = useState(true);
  const [dragSelection, setDragSelection] = useState(true);
  const [status, setStatus] = useState({ text: "No audio loaded", type: "info" });
  const [alert, setAlert] = useState({ message: "", isOpen: false, type: "info" });
  
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
    if (wavesurferRef.current) {
      try {
        // Find regions plugin in the active plugins
        const regionsPlugin = wavesurferRef.current.getActivePlugins().find(plugin => plugin.name === 'regions');
        if (regionsPlugin) {
          regionsPlugin.clearRegions();
          setAlert({ message: "All regions cleared", isOpen: true, type: "warning" });
        } else {
          console.warn("Regions plugin not found");
        }
      } catch (error) {
        console.error("Error clearing regions:", error);
      }
    }
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
      <h1>WaveSurfer with Regions</h1>
      
      <StatusBar status={status.text} type={status.type} />
      
      <UploadPanel onFileUpload={handleFileUpload} />
      
      <WaveSurferComponent
        audioFile={audioFile}
        isPlaying={isPlaying}
        loopRegions={loopRegions}
        dragSelection={dragSelection}
        zoomLevel={zoomLevel}
        playbackSpeed={playbackSpeed}
        onPlayPause={handlePlayPause}
        onReady={handleReady}
      />
      
      {/* Controls Row - Matching the original HTML structure */}
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

        {/* Region looping control */}
        <div className="checkbox-container">
          <input 
            type="checkbox" 
            id="loop-regions" 
            checked={loopRegions}
            onChange={(e) => setLoopRegions(e.target.checked)}
          />
          <label htmlFor="loop-regions">Loop regions</label>
        </div>
        
        {/* Drag selection control */}
        <div className="checkbox-container">
          <input 
            type="checkbox" 
            id="drag-selection" 
            checked={dragSelection}
            onChange={(e) => setDragSelection(e.target.checked)}
          />
          <label htmlFor="drag-selection">Enable drag</label>
        </div>
      </div>
      
      {/* Player control buttons */}
      <div className="controls">
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
      
      {alert.isOpen && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}
    </div>
  );
}

export default App;