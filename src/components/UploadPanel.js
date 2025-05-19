/**
 * File: src/components/UploadPanel.js
 * Description: File upload panel component
 * 
 * Version History:
 * v1.0.0 (2025-05-18) - Initial implementation
 */

import React, { useState, useRef } from 'react';
import '../assets/styles/upload-panel.css';

const UploadPanel = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileInputRef = useRef(null);
  
  // Handle file selection
  const handleFileChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      handleFile(file);
    }
  };
  
  // Handle file drop
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      handleFile(file);
    }
  };
  
  // Process the uploaded file
  const handleFile = (file) => {
    // Check if file is audio or video
    const acceptedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 
      'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mkv', 'video/mov'
    ];
    
    if (!acceptedTypes.includes(file.type)) {
      alert('Please upload an audio or video file.');
      return;
    }
    
    setUploadedFile(file);
    onFileUpload(file);
  };
  
  // Drag events
  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  // Format file size
  const formatFileSize = (size) => {
    // Define size units
    const units = ["B", "KB", "MB", "GB", "TB"];
    
    // Calculate the appropriate unit
    let i = 0;
    let sizeBytes = size;
    while (sizeBytes >= 1024 && i < units.length - 1) {
      sizeBytes /= 1024;
      i++;
    }
    
    // Format the result with 2 decimal places if needed
    if (i > 0) {
      return `${sizeBytes.toFixed(2)} ${units[i]}`;
    } else {
      return `${sizeBytes} ${units[i]}`;
    }
  };
  
  // Get file type display
  const getFileTypeDisplay = (file) => {
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  };
  
  return (
    <div className="card mb-4">
      {/* Collapse toggle */}
      <div className="upload-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
        <h3 className="m-0">
          <i className="fas fa-file-upload me-2 text-info"></i>
          Upload Audio/Video
        </h3>
        <i className={`fas fa-chevron-down upload-toggle-icon ${isCollapsed ? '' : 'open'}`}></i>
      </div>
      
      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="card-body">
          {/* Upload area */}
          <div 
            className={`upload-area ${isDragging ? 'drag-active' : ''}`}
            onClick={() => fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <i id="upload-icon" className="fas fa-file-upload fa-3x mb-3 text-info-emphasis"></i>
            <div id="upload-text" className="fw-bold">Drag and Drop or Click to Upload</div>
            <div className="text-muted small mt-1">Supports audio and video files up to 4GB</div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden-input"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              id="file-input"
            />
          </div>
          
          {/* Display file info if uploaded */}
          {uploadedFile && (
            <div id="file-info-display" className="text-light font-italic small mt-2">
              <i className="fas fa-check-circle text-success me-2"></i>
              Uploaded: {uploadedFile.name} ({formatFileSize(uploadedFile.size)}, {getFileTypeDisplay(uploadedFile)})
            </div>
          )}
          
          {/* Launch button - only show if file is uploaded */}
          {uploadedFile && (
            <div className="text-center">
              <button
                id="launch-vlc"
                className="mt-4 launch-btn fw-bold"
                style={{
                  fontSize: '1.2rem',
                  padding: '0.7rem 1.5rem',
                  borderRadius: '30px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s ease',
                  backgroundColor: '#4363ca',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => onFileUpload(uploadedFile)} // Re-load the same file
              >
                <i className="fas fa-play-circle me-2"></i>
                Load Audio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadPanel;