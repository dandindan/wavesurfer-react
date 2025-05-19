/**
 * File: src/index.js
 * Description: Application entry point
 * 
 * Version History:
 * v1.0.0 (2025-05-18) - Initial implementation
 * v1.0.1 (2025-05-19) - Added error handling and version logging
 * v1.0.2 (2025-05-19) - Fixed ESLint warning about unused import
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';

// Add global error handler to catch unhandled errors
window.addEventListener('error', (event) => {
  console.error('Uncaught runtime error:', event.error);
});

// Log the React version to verify
console.log("React version:", React.version);

// Create root and render app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);