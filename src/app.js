// src/App.js - Updated with EXACT Retro Synthwave Header Match
import React, { useCallback, useEffect } from 'react';
import { useAudioSyncStore } from './store/audioSyncStore';
import UltimateWaveSurfer from './components/UltimateWaveSurfer';
import UltimateMPVController from './components/UltimateMPVController';
import StatusBar from './components/StatusBar';
import UploadPanel from './components/UploadPanel';
import './assets/styles/retro-header.css'; // 🎯 Import EXACT retro header styles
import './assets/styles/main.css';
import './assets/styles/integrated-controls.css';


function UltimateApp() {
  const {
    // 🎵 Audio state
    audioFile,
    audioUrl,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    zoomLevel,
    isMuted,
    
    // 🎬 MPV state
    mpvConnected,
    syncAccuracy,
    
    // 🎨 UI state
    loading,
    error,
    status,
    activeRegion,
    
    // 🚀 Actions
    setAudioFile,
    setIsPlaying,
    setPlaybackRate,
    setZoomLevel,
    setIsMuted,
    setActiveRegion,
    setError,
    setStatus,
    reset,
    validateAudioFile,
    getPerformanceStats
  } = useAudioSyncStore();

  // 🎯 Helper function for formatting time
  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // 📁 Ultimate file upload handler
  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    
    console.log("🎵 Ultimate App: File uploaded:", file.name);
    
    // Validate file before processing
    if (!validateAudioFile(file)) {
      return; // Error already set by validateAudioFile
    }
    
    setAudioFile(file);
    setStatus(`🚀 Loading ultimate visualization for: ${file.name}`);
  }, [setAudioFile, setStatus, validateAudioFile]);

  // 🎯 WaveSurfer ready handler
  const handleWaveSurferReady = useCallback((wavesurfer) => {
    console.log("🎯 Ultimate WaveSurfer ready!");
    setStatus(`🎯 Ultimate WaveSurfer ready: ${audioFile?.name || 'Audio loaded'}`);
    
    // Attach to global scope for debugging
    if (process.env.NODE_ENV === 'development') {
      window.ultimateWaveSurfer = wavesurfer;
      console.log('🎯 WaveSurfer attached to window.ultimateWaveSurfer');
    }
  }, [audioFile?.name, setStatus]);

  // 🎵 Region interaction handler
  const handleRegionClick = useCallback((region) => {
    console.log("🎵 Region activated:", region);
    setActiveRegion(region);
    setStatus(`🎵 Region active: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s`);
  }, [setActiveRegion, setStatus]);

  // ⏱️ Time update handler
  const handleTimeUpdate = useCallback((time) => {
    // Auto-clear active region when playback moves beyond it
    if (activeRegion && time >= activeRegion.end) {
      setActiveRegion(null);
      setStatus("Playback beyond region - region deactivated");
    }
  }, [activeRegion, setActiveRegion, setStatus]);

  // 🎬 MPV status change handler
  const handleMPVStatusChange = useCallback((mpvStatus) => {
    console.log("🎬 MPV status changed:", mpvStatus);
    
    if (mpvStatus.isConnected) {
      setStatus("🎯 Ultimate MPV connected - Perfect sync active!");
    } else {
      setStatus("🎬 MPV disconnected");
    }
  }, [setStatus]);

  // ❌ Error handler
  const handleError = useCallback((errorMessage) => {
    console.error("❌ Ultimate App Error:", errorMessage);
    setError(errorMessage);
  }, [setError]);

  // ⌨️ Ultimate keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Don't interfere with input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          setStatus(isPlaying ? "⏸️ Paused" : "▶️ Playing");
          break;
          
        case 'KeyR':
          if (e.ctrlKey) {
            e.preventDefault();
            reset();
            setStatus("🔄 Ultimate reset complete!");
          }
          break;
          
        case 'KeyM':
          if (e.ctrlKey) {
            e.preventDefault();
            setIsMuted(!isMuted);
            setStatus(isMuted ? "🔊 WaveSurfer unmuted" : "🔇 WaveSurfer muted");
          }
          break;
          
        case 'Equal':
        case 'NumpadAdd':
          if (e.ctrlKey) {
            e.preventDefault();
            const newZoom = Math.min(1000, zoomLevel + 50);
            setZoomLevel(newZoom);
            setStatus(`🔍 Zoom: ${newZoom}px/s`);
          }
          break;
          
        case 'Minus':
        case 'NumpadSubtract':
          if (e.ctrlKey) {
            e.preventDefault();
            const newZoom = Math.max(10, zoomLevel - 50);
            setZoomLevel(newZoom);
            setStatus(`🔍 Zoom: ${newZoom}px/s`);
          }
          break;
          
        case 'Digit0':
        case 'Numpad0':
          if (e.ctrlKey) {
            e.preventDefault();
            setZoomLevel(100);
            setStatus("🔍 Zoom reset to 100px/s");
          }
          break;
          
        case 'ArrowUp':
          if (e.ctrlKey) {
            e.preventDefault();
            const newRate = Math.min(3, playbackRate + 0.25);
            setPlaybackRate(newRate);
            setStatus(`⚡ Speed: ${newRate.toFixed(2)}x`);
          }
          break;
          
        case 'ArrowDown':
          if (e.ctrlKey) {
            e.preventDefault();
            const newRate = Math.max(0.25, playbackRate - 0.25);
            setPlaybackRate(newRate);
            setStatus(`⚡ Speed: ${newRate.toFixed(2)}x`);
          }
          break;
          
        case 'Escape':
          if (activeRegion) {
            setActiveRegion(null);
            setStatus("Region deactivated");
          }
          break;
          
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [isPlaying, isMuted, zoomLevel, playbackRate, activeRegion, 
      setIsPlaying, setIsMuted, setZoomLevel, setPlaybackRate, 
      setActiveRegion, reset, setStatus]);

  // 🧹 Auto-clear errors
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // 📊 Performance monitoring (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        const stats = getPerformanceStats();
        console.log('📊 Performance Stats:', stats);
      }, 10000); // Every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [getPerformanceStats]);
// 🎯 ADD THE SLIDER PROGRESS CODE RIGHT HERE:
  useEffect(() => {
    const updateSliderProgress = () => {
      // Update zoom slider
      const zoomSlider = document.querySelector('.zoom-controls input[type="range"]');
      if (zoomSlider) {
        const zoomPercent = ((zoomLevel - 10) / (1000 - 10)) * 100;
        zoomSlider.style.setProperty('--progress', `${zoomPercent}%`);
      }
      
      // Update speed slider  
      const speedSlider = document.querySelector('.speed-controls input[type="range"]');
      if (speedSlider) {
        const speedPercent = ((playbackRate - 0.25) / (3 - 0.25)) * 100;
        speedSlider.style.setProperty('--progress', `${speedPercent}%`);
      }
    };
    
    updateSliderProgress();
  }, [zoomLevel, playbackRate]);
  return (
    <div className="ultimate-app">
      {/* 🎯 EXACT RETRO SYNTHWAVE HEADER - Matching Original Reference */}
      <div className="retro-app-header">
        <div className="retro-top">
          <div className="retro-sky"></div>
        </div>
        <div className="retro-bottom">
          <div className="retro-ground"></div>
        </div>
        <div className="retro-text-container">
          <h1 className="retro-main-title">ULTIMATE WAVESURFER</h1>
          <h2 className="retro-sub-title">Media Player Synchronization</h2>
        </div>
        
        {/* Stats positioned like the "a" link in original */}
        <div className="retro-stats-bar">
          <div className="retro-stat-item">
            ⚡ {duration > 0 ? formatTime(duration) : 'Ready'}
          </div>
          <div className="retro-stat-item">
            🎯 {playbackRate.toFixed(1)}x
          </div>
          <div className="retro-stat-item">
            🔍 {zoomLevel}px/s
          </div>
          {mpvConnected && (
            <div className="retro-stat-item">
              {syncAccuracy < 0.05 ? '✅ SYNC' : `⚠️ ${(syncAccuracy * 1000).toFixed(0)}ms`}
            </div>
          )}
        </div>
      </div>

      {/* 📊 Status bar */}
      <StatusBar 
        status={status} 
        type={error ? "danger" : loading ? "warning" : mpvConnected ? "success" : "info"} 
      />

      {/* 📁 Upload panel */}
      <UploadPanel onFileUpload={handleFileUpload} />

      {/* 🎯 Main audio visualization */}
      {audioUrl && (
        <UltimateWaveSurfer
          audioUrl={audioUrl}
          onReady={handleWaveSurferReady}
          onRegionClick={handleRegionClick}
          onTimeUpdate={handleTimeUpdate}
          className="main-wavesurfer"
          height={220}
        />
      )}

      {/* 🎮 Ultimate control panels */}
      <div className="ultimate-controls">
        {/* 🎵 Playback controls */}
        <div className="control-section playback-controls">
          <h3>🎵 Playback</h3>
          <div className="controls-grid">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`play-pause ${isPlaying ? 'playing' : 'paused'}`}
              disabled={!audioUrl}
              title="Spacebar"
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`mute-toggle ${isMuted ? 'muted' : ''}`}
              disabled={!audioUrl}
              title="Ctrl+M - Mute WaveSurfer (MPV audio continues)"
            >
              <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`}></i>
              WS Audio
            </button>
          </div>
        </div>

        {/* 🔍 Zoom controls */}
        <div className="control-section zoom-controls">
          <h3>🔍 Zoom</h3>
          <div className="range-control">
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              disabled={!audioUrl}
            />
            <div className="range-info">
              <span>{zoomLevel}px/s</span>
              <small>Ctrl + +/- to adjust</small>
            </div>
          </div>
        </div>

        {/* ⚡ Speed controls */}
        <div className="control-section speed-controls">
          <h3>⚡ Speed</h3>
          <div className="range-control">
            <input
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={playbackRate}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
              disabled={!audioUrl}
            />
            <div className="range-info">
              <span>{playbackRate.toFixed(2)}x</span>
              <small>Ctrl + ↑/↓ to adjust</small>
            </div>
          </div>
        </div>

        {/* 📊 FIXED Region controls - Consistent height */}
<div className="control-section region-controls">
  <h3 style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '0 0 15px 0'
  }}>
    <span>📊 Regions</span>
    {/* ACTIVE REGION INFO IN HEADER */}
    {activeRegion && (
      <span style={{
        fontSize: '0.9rem',
        color: '#4a9eff',
        fontWeight: '500',
        backgroundColor: 'rgba(74, 158, 255, 0.1)',
        padding: '2px 8px',
        borderRadius: '12px',
        border: '1px solid rgba(74, 158, 255, 0.3)'
      }}>
        📊 {activeRegion.start.toFixed(2)}s-{activeRegion.end.toFixed(2)}s ({(activeRegion.end - activeRegion.start).toFixed(2)}s)
      </span>
    )}
  </h3>
  
  {/* Row 1: Loop toggle and region count */}
  <div className="region-info-row" style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    fontSize: '0.9rem'
  }}>
    {/* Loop Regions Toggle */}
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      color: '#fff',
      fontSize: '0.9rem'
    }}>
      <input
        type="checkbox"
        checked={window.ultimateWaveSurfer?.ultimate?.getLoopRegions() || false}
        onChange={(e) => {
          const newValue = e.target.checked;
          if (window.ultimateWaveSurfer?.ultimate?.setLoopRegions) {
            window.ultimateWaveSurfer.ultimate.setLoopRegions(newValue);
          }
        }}
        style={{
          accentColor: '#4a9eff',
          width: '14px',
          height: '14px'
        }}
      />
      <span>🔄 Loop</span>
    </label>

    {/* Region Count */}
    <span style={{ 
      color: '#4caf50', 
      fontWeight: '500',
      fontSize: '0.9rem'
    }}>
      📊 Count: {window.ultimateWaveSurfer?.ultimate?.getRegions()?.length || 0}
    </span>
  </div>

  {/* Row 2: Current time and drag hint */}
  <div className="region-status-row" style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    padding: '6px 12px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '6px',
    fontSize: '0.8rem'
  }}>
    {/* Current Time Display */}
    <span style={{ 
      color: '#4a9eff', 
      fontWeight: '600',
      fontSize: '0.85rem'
    }}>
      ⏱️ {formatTime(currentTime)} / {formatTime(duration)}
    </span>

    {/* Drag Hint */}
    <span style={{ 
      color: '#888', 
      fontSize: '0.9rem',
      fontStyle: 'italic'
    }}>
      🎨 Drag to create
    </span>
  </div>

  {/* Row 3: Action buttons - FIXED HEIGHT CONTAINER */}
  <div style={{
    minHeight: '45px', // Fixed height to prevent layout shift
    display: 'flex',
    alignItems: 'center'
  }}>
    <div className="controls-grid" style={{ width: '100%' }}>
      <button 
        onClick={() => window.ultimateWaveSurfer?.ultimate?.clearAllRegions()}
        disabled={!audioUrl}
        className="clear-regions"
        title="Clear all regions"
      >
        <i className="fas fa-trash"></i>
        Clear All
      </button>
      
      {activeRegion && (
        <button
          onClick={() => setActiveRegion(null)}
          className="deactivate-region"
          title="Escape key"
        >
          <i className="fas fa-times"></i>
          Deactivate
        </button>
      )}
    </div>
  </div>
</div>

        {/* 🎬 MPV controls */}
        <div className="control-section mpv-section">
          <h3>🎬 Ultimate MPV</h3>
          <UltimateMPVController
            onStatusChange={handleMPVStatusChange}
            onError={handleError}
          />
        </div>
      </div>

      {/* ❌ Error display */}
      {error && (
        <div className="error-display">
          <div className="error-content">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              title="Close error"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* ⏳ Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="ultimate-spinner"></div>
            <span>🎯 Processing ultimate audio visualization...</span>
            <div className="loading-tips">
              <p>✨ Preparing perfect sync experience</p>
            </div>
          </div>
        </div>
      )}

      {/* ⌨️ Keyboard shortcuts help */}
      <div className="keyboard-shortcuts">
        <details>
          <summary>⌨️ Ultimate Shortcuts</summary>
          <div className="shortcuts-grid">
            <div className="shortcut-group">
              <h4>🎵 Playback</h4>
              <div className="shortcut"><kbd>Space</kbd> Play/Pause</div>
              <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>M</kbd> Mute WS</div>
              <div className="shortcut"><kbd>Esc</kbd> Deactivate Region</div>
            </div>
            <div className="shortcut-group">
              <h4>🔍 View</h4>
              <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>+/-</kbd> Zoom</div>
              <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>0</kbd> Reset Zoom</div>
              <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>↑/↓</kbd> Speed</div>
            </div>
            <div className="shortcut-group">
              <h4>🎯 System</h4>
              <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>R</kbd> Reset All</div>
              <div className="shortcut"><kbd>Drag</kbd> Create Region</div>
              <div className="shortcut"><kbd>Click</kbd> Seek to Position</div>
            </div>
          </div>
        </details>
      </div>

      {/* 🎯 Performance display */}
      {mpvConnected && (
        <div className="performance-display">
          <div className="perf-indicator">
            <span className="perf-label">🎯 Sync:</span>
            <span className={`perf-value ${syncAccuracy < 0.05 ? 'excellent' : syncAccuracy < 0.1 ? 'good' : 'poor'}`}>
              {syncAccuracy < 0.05 ? 'PERFECT' : `${(syncAccuracy * 1000).toFixed(0)}ms`}
            </span>
          </div>
        </div>
      )}

      {/* 🐛 Debug panel (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-panel">
          <details>
            <summary>🐛 Ultimate Debug</summary>
            <div className="debug-grid">
              <div className="debug-section">
                <h4>📁 Audio</h4>
                <div>File: {audioFile?.name || 'None'}</div>
                <div>Duration: {formatTime(duration)}</div>
                <div>Current: {formatTime(currentTime)}</div>
                <div>Playing: {isPlaying ? 'Yes' : 'No'}</div>
                <div>Rate: {playbackRate}x</div>
                <div>Muted: {isMuted ? 'Yes' : 'No'}</div>
              </div>
              <div className="debug-section">
                <h4>🎬 MPV</h4>
                <div>Connected: {mpvConnected ? 'Yes' : 'No'}</div>
                <div>Sync: {syncAccuracy.toFixed(4)}s</div>
                <div>Mode: {useAudioSyncStore.getState().syncMode}</div>
              </div>
              <div className="debug-section">
                <h4>📊 Regions</h4>
                <div>Active: {activeRegion ? `${activeRegion.start.toFixed(2)}s-${activeRegion.end.toFixed(2)}s` : 'None'}</div>
                <div>Total: {useAudioSyncStore.getState().regions.length}</div>
              </div>
              <div className="debug-section">
                <h4>⚡ Performance</h4>
                <div>Zoom: {zoomLevel}px/s</div>
                <div>Status: {status}</div>
                <div>Loading: {loading ? 'Yes' : 'No'}</div>
                <div>Error: {error ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* 🎯 Ultimate footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <span>🎯 Ultimate WaveSurfer-MPV Sync v2.0</span>
          <span>•</span>
          <span>Perfect audio visualization with real-time synchronization</span>
          {mpvConnected && (
            <>
              <span>•</span>
              <span className="sync-badge">✅ SYNCED</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

export default UltimateApp;