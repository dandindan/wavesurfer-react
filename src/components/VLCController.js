/**
 * File: src/components/VLCController.js
 * Description: VLC Media Player controller component
 * 
 * Version History:
 * v1.0.0 (2025-05-19) - Initial implementation based on Dash-VLC controller
 * v1.0.1 (2025-05-19) - Optimized for integration in main controls row
 */

import React, { useState, useEffect, useCallback } from 'react';

const VLCController = ({ 
  mediaFile, 
  onStatusChange,
  wavesurferInstance,
  activeRegion,
  onError
}) => {
  // State for the VLC controller
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [vlcConnected, setVlcConnected] = useState(false);
  
  // VLC connection settings
  const VLC_HOST = 'localhost';
  const VLC_PORT = 9999;

  // Function to send commands to VLC via backend API
  const sendVLCCommand = useCallback(async (command) => {
    try {
      // In a real implementation, you would make an API call to your backend
      // For demonstration, we'll use a mock implementation
      console.log(`Sending VLC command: ${command}`);
      
      // Simulate a backend call
      const response = await fetch('/api/vlc-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send command: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.response;
    } catch (error) {
      console.error(`Error sending command: ${error.message}`);
      if (onError) onError(`Error: ${error.message}`);
      return null;
    }
  }, [onError]);

  // Function to launch VLC
  const launchVLC = useCallback(async () => {
    if (!mediaFile) {
      if (onError) onError('Please upload a media file first');
      return;
    }

    try {
      // Make API call to backend to launch VLC
      const response = await fetch('/api/launch-vlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaPath: mediaFile })
      });

      if (!response.ok) {
        throw new Error(`Failed to launch VLC: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setVlcConnected(true);
        setStatus('Ready');
        
        // Pause immediately after launch
        await sendVLCCommand('pause');
        setIsPlaying(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error(`Error launching VLC: ${error.message}`);
      if (onError) onError(`Error launching VLC: ${error.message}`);
      setStatus('Error');
    }
  }, [mediaFile, sendVLCCommand, onError]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('pause');
      const newPlayingState = !isPlaying;
      setIsPlaying(newPlayingState);
      setStatus(newPlayingState ? 'Playing' : 'Paused');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: newPlayingState });
      }
    } catch (error) {
      console.error(`Error toggling play/pause: ${error.message}`);
    }
  }, [vlcConnected, isPlaying, sendVLCCommand, onStatusChange]);

  // Stop playback
  const stopPlayback = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      // First pause then seek to beginning
      await sendVLCCommand('pause');
      await sendVLCCommand('seek 0');
      setIsPlaying(false);
      setStatus('Stopped');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: false });
      }
    } catch (error) {
      console.error(`Error stopping playback: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, onStatusChange]);

  // Seek backward/forward
  const seekMedia = useCallback(async (seconds) => {
    if (!vlcConnected) return;
    
    try {
      const command = `seek ${seconds > 0 ? '+' : ''}${seconds}`;
      await sendVLCCommand(command);
    } catch (error) {
      console.error(`Error seeking media: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Volume up/down
  const adjustVolume = useCallback(async (amount) => {
    if (!vlcConnected) return;
    
    try {
      const command = amount > 0 ? 'volup 5' : 'voldown 5';
      await sendVLCCommand(command);
    } catch (error) {
      console.error(`Error adjusting volume: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('fullscreen');
    } catch (error) {
      console.error(`Error toggling fullscreen: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Effect to handle active region changes
  useEffect(() => {
    if (!vlcConnected || !activeRegion || !wavesurferInstance) return;
    
    const handleRegionPlayback = async () => {
      try {
        // Seek to the region start time
        const startTime = activeRegion.start;
        await sendVLCCommand(`seek ${Math.floor(startTime)}`);
        
        // Resume playback if paused
        if (!isPlaying) {
          await sendVLCCommand('pause'); // VLC uses the same command to toggle play/pause
          setIsPlaying(true);
          setStatus('Playing region');
          
          // Notify parent component
          if (onStatusChange) {
            onStatusChange({ isPlaying: true });
          }
        }
      } catch (error) {
        console.error(`Error handling region playback: ${error.message}`);
      }
    };
    
    handleRegionPlayback();
  }, [activeRegion, vlcConnected, sendVLCCommand, wavesurferInstance, isPlaying, onStatusChange]);

  // Render compact VLC controller buttons
  return (
    <div className="vlc-controls">
      {/* Launch VLC Button */}
      <button 
        className="vlc-launch"
        onClick={launchVLC}
        disabled={!mediaFile || vlcConnected}
        title="Launch VLC Player"
      >
        <i className="fas fa-external-link-alt"></i> VLC
      </button>
      
      {/* Only show playback controls if VLC is connected */}
      {vlcConnected && (
        <>
          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          
          <button
            onClick={stopPlayback}
            title="Stop"
          >
            <i className="fas fa-stop"></i>
          </button>
          
          <button
            onClick={() => adjustVolume(-5)}
            title="Volume Down"
          >
            <i className="fas fa-volume-down"></i>
          </button>
          
          <button
            onClick={() => adjustVolume(5)}
            title="Volume Up"
          >
            <i className="fas fa-volume-up"></i>
          </button>
          
          <button
            onClick={() => seekMedia(-10)}
            title="Seek Backward 10s"
          >
            <i className="fas fa-backward"></i>
          </button>
          
          <button
            onClick={() => seekMedia(10)}
            title="Seek Forward 10s"
          >
            <i className="fas fa-forward"></i>
          </button>
          
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            <i className="fas fa-expand"></i>
          </button>
        </>
      )}
      
      {/* Status indicator */}
      <div className="vlc-status">
        <span className="status-label">VLC:</span>
        <span className={`status-value ${status.toLowerCase()}`}>{status}</span>
      </div>
    </div>
  );
};

export default VLCController;
File) {
      if (onError) onError('Please upload a media file first');
      return;
    }

    try {
      // Make API call to backend to launch VLC
      const response = await fetch('/api/launch-vlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaPath: mediaFile })
      });

      if (!response.ok) {
        throw new Error(`Failed to launch VLC: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setVlcConnected(true);
        setStatus('Ready');
        
        // Pause immediately after launch
        await sendVLCCommand('pause');
        setIsPlaying(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error(`Error launching VLC: ${error.message}`);
      if (onError) onError(`Error launching VLC: ${error.message}`);
      setStatus('Error');
    }
  }, [mediaFile, sendVLCCommand, onError]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('pause');
      const newPlayingState = !isPlaying;
      setIsPlaying(newPlayingState);
      setStatus(newPlayingState ? 'Playing' : 'Paused');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: newPlayingState });
      }
    } catch (error) {
      console.error(`Error toggling play/pause: ${error.message}`);
    }
  }, [vlcConnected, isPlaying, sendVLCCommand, onStatusChange]);

  // Stop playback
  const stopPlayback = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      // First pause then seek to beginning
      await sendVLCCommand('pause');
      await sendVLCCommand('seek 0');
      setIsPlaying(false);
      setStatus('Stopped');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: false });
      }
    } catch (error) {
      console.error(`Error stopping playback: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, onStatusChange]);

  // Seek backward/forward
  const seekMedia = useCallback(async (seconds) => {
    if (!vlcConnected) return;
    
    try {
      const command = `seek ${seconds > 0 ? '+' : ''}${seconds}`;
      await sendVLCCommand(command);
    } catch (error) {
      console.error(`Error seeking media: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Volume up/down
  const adjustVolume = useCallback(async (amount) => {
    if (!vlcConnected) return;
    
    try {
      const command = amount > 0 ? 'volup 5' : 'voldown 5';
      await sendVLCCommand(command);
    } catch (error) {
      console.error(`Error adjusting volume: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('fullscreen');
    } catch (error) {
      console.error(`Error toggling fullscreen: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Effect to handle active region changes
  useEffect(() => {
    if (!vlcConnected || !activeRegion || !wavesurferInstance) return;
    
    const handleRegionPlayback = async () => {
      try {
        // Seek to the region start time
        const startTime = activeRegion.start;
        await sendVLCCommand(`seek ${Math.floor(startTime)}`);
        
        // Resume playback if paused
        if (!isPlaying) {
          await sendVLCCommand('pause'); // VLC uses the same command to toggle play/pause
          setIsPlaying(true);
          setStatus('Playing region');
          
          // Notify parent component
          if (onStatusChange) {
            onStatusChange({ isPlaying: true });
          }
        }
      } catch (error) {
        console.error(`Error handling region playback: ${error.message}`);
      }
    };
    
    handleRegionPlayback();
  }, [activeRegion, vlcConnected, sendVLCCommand, wavesurferInstance, isPlaying, onStatusChange]);

  // Render compact VLC controller buttons
  return (
    <div className="vlc-controls">
      {/* Launch VLC Button */}
      <button 
        className="vlc-launch"
        onClick={launchVLC}
        disabled={!mediaFile || vlcConnected}
        title="Launch VLC Player"
      >
        <i className="fas fa-external-link-alt"></i> VLC
      </button>
      
      {/* Only show playback controls if VLC is connected */}
      {vlcConnected && (
        <>
          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          
          <button
            onClick={stopPlayback}
            title="Stop"
          >
            <i className="fas fa-stop"></i>
          </button>
          
          <button
            onClick={() => adjustVolume(-5)}
            title="Volume Down"
          >
            <i className="fas fa-volume-down"></i>
          </button>
          
          <button
            onClick={() => adjustVolume(5)}
            title="Volume Up"
          >
            <i className="fas fa-volume-up"></i>
          </button>
          
          <button
            onClick={() => seekMedia(-10)}
            title="Seek Backward 10s"
          >
            <i className="fas fa-backward"></i>
          </button>
          
          <button
            onClick={() => seekMedia(10)}
            title="Seek Forward 10s"
          >
            <i className="fas fa-forward"></i>
          </button>
          
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            <i className="fas fa-expand"></i>
          </button>
        </>
      )}
      
      {/* Status indicator */}
      <div className="vlc-status">
        <span className="status-label">VLC:</span>
        <span className={`status-value ${status.toLowerCase()}`}>{status}</span>
      </div>
    </div>
  );
};

export default VLCController;
File, 
  onStatusChange,
  wavesurferInstance,
  activeRegion,
  onError
}) => {
  // State for the VLC controller
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [vlcConnected, setVlcConnected] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('info');

  // VLC connection settings
  const VLC_HOST = 'localhost';
  const VLC_PORT = 9999;

  // Function to send commands to VLC via backend API
  const sendVLCCommand = useCallback(async (command) => {
    try {
      // In a real implementation, you would make an API call to your backend
      // For demonstration, we'll use a mock implementation
      console.log(`Sending VLC command: ${command}`);
      
      // Simulate a backend call
      const response = await fetch('/api/vlc-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send command: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.response;
    } catch (error) {
      console.error(`Error sending command: ${error.message}`);
      showAlert(`Error: ${error.message}`, 'danger');
      return null;
    }
  }, []);

  // Function to launch VLC
  const launchVLC = useCallback(async () => {
    if (!mediaFile) {
      showAlert('Please upload a media file first', 'danger');
      return;
    }

    try {
      // Make API call to backend to launch VLC
      const response = await fetch('/api/launch-vlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaPath: mediaFile })
      });

      if (!response.ok) {
        throw new Error(`Failed to launch VLC: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setVlcConnected(true);
        setStatus('Ready');
        showAlert('VLC launched successfully', 'success');
        
        // Pause immediately after launch
        await sendVLCCommand('pause');
        setIsPlaying(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error(`Error launching VLC: ${error.message}`);
      showAlert(`Error launching VLC: ${error.message}`, 'danger');
      setStatus('Error');
    }
  }, [mediaFile, sendVLCCommand]);

  // Helper to show alert messages
  const showAlert = (message, type = 'info') => {
    setAlertMessage(message);
    setAlertType(type);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setAlertMessage(null);
    }, 3000);
  };

  // Play/Pause toggle
  const togglePlayPause = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('pause');
      const newPlayingState = !isPlaying;
      setIsPlaying(newPlayingState);
      setStatus(newPlayingState ? 'Playing' : 'Paused');
      showAlert(newPlayingState ? 'Media playing' : 'Media paused');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: newPlayingState });
      }
    } catch (error) {
      console.error(`Error toggling play/pause: ${error.message}`);
    }
  }, [vlcConnected, isPlaying, sendVLCCommand, onStatusChange]);

  // Stop playback
  const stopPlayback = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      // First pause then seek to beginning
      await sendVLCCommand('pause');
      await sendVLCCommand('seek 0');
      setIsPlaying(false);
      setStatus('Stopped');
      showAlert('Media stopped');
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange({ isPlaying: false });
      }
    } catch (error) {
      console.error(`Error stopping playback: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand, onStatusChange]);

  // Seek backward/forward
  const seekMedia = useCallback(async (seconds) => {
    if (!vlcConnected) return;
    
    try {
      const command = `seek ${seconds > 0 ? '+' : ''}${seconds}`;
      await sendVLCCommand(command);
      showAlert(`Jumped ${seconds > 0 ? 'forward' : 'backward'} ${Math.abs(seconds)} seconds`);
    } catch (error) {
      console.error(`Error seeking media: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Volume up/down
  const adjustVolume = useCallback(async (amount) => {
    if (!vlcConnected) return;
    
    try {
      const command = amount > 0 ? 'volup 5' : 'voldown 5';
      await sendVLCCommand(command);
      showAlert(`Volume ${amount > 0 ? 'increased' : 'decreased'}`);
    } catch (error) {
      console.error(`Error adjusting volume: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!vlcConnected) return;
    
    try {
      await sendVLCCommand('fullscreen');
      showAlert('Toggled fullscreen mode');
    } catch (error) {
      console.error(`Error toggling fullscreen: ${error.message}`);
    }
  }, [vlcConnected, sendVLCCommand]);

  // Effect to handle active region changes
  useEffect(() => {
    if (!vlcConnected || !activeRegion || !wavesurferInstance) return;
    
    const handleRegionPlayback = async () => {
      try {
        // Seek to the region start time
        const startTime = activeRegion.start;
        await sendVLCCommand(`seek ${Math.floor(startTime)}`);
        
        // Resume playback if paused
        if (!isPlaying) {
          await sendVLCCommand('pause'); // VLC uses the same command to toggle play/pause
          setIsPlaying(true);
          setStatus('Playing region');
          
          // Notify parent component
          if (onStatusChange) {
            onStatusChange({ isPlaying: true });
          }
        }
      } catch (error) {
        console.error(`Error handling region playback: ${error.message}`);
      }
    };
    
    handleRegionPlayback();
  }, [activeRegion, vlcConnected, sendVLCCommand, wavesurferInstance, isPlaying, onStatusChange]);

  // Render VLC controller buttons
  return (
    <div className="vlc-controls">
      {/* Launch VLC Button */}
      <button 
        className="vlc-launch"
        onClick={launchVLC}
        disabled={!mediaFile || vlcConnected}
      >
        <i className="fas fa-external-link-alt"></i> Launch VLC
      </button>
      
      {/* VLC Playback Controls */}
      <div className={`vlc-playback-controls ${!vlcConnected ? 'disabled' : ''}`}>
        <button
          onClick={togglePlayPause}
          disabled={!vlcConnected}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
        </button>
        
        <button
          onClick={stopPlayback}
          disabled={!vlcConnected}
          title="Stop"
        >
          <i className="fas fa-stop"></i>
        </button>
        
        <button
          onClick={() => adjustVolume(-5)}
          disabled={!vlcConnected}
          title="Volume Down"
        >
          <i className="fas fa-volume-down"></i>
        </button>
        
        <button
          onClick={() => adjustVolume(5)}
          disabled={!vlcConnected}
          title="Volume Up"
        >
          <i className="fas fa-volume-up"></i>
        </button>
        
        <button
          onClick={() => seekMedia(-10)}
          disabled={!vlcConnected}
          title="Seek Backward 10s"
        >
          <i className="fas fa-backward"></i>
        </button>
        
        <button
          onClick={() => seekMedia(10)}
          disabled={!vlcConnected}
          title="Seek Forward 10s"
        >
          <i className="fas fa-forward"></i>
        </button>
        
        <button
          onClick={toggleFullscreen}
          disabled={!vlcConnected}
          title="Toggle Fullscreen"
        >
          <i className="fas fa-expand"></i>
        </button>
        
        <div className="vlc-status">
          <span className="status-label">VLC Status:</span>
          <span className={`status-value ${status.toLowerCase()}`}>{status}</span>
        </div>
      </div>
      
      {/* Alert message */}
      {alertMessage && (
        <div className={`vlc-alert alert-${alertType}`}>
          {alertMessage}
        </div>
      )}
    </div>
  );
};

export default VLCController;