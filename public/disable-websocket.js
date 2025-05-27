/**
 * File: public/disable-websocket.js
 * Description: Disable WebSocket connection errors in development
 * 
 * Version History:
 * v1.0.0 (2025-05-21) - Initial implementation to suppress WebSocket errors - Maoz Lahav
 * v1.0.1 (2025-05-21) - Fixed process undefined error - Maoz Lahav
 */

// Suppress WebSocket connection errors (works in browser environment)
(function() {
  // Override console.error to filter out WebSocket errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    // Check if the error message contains WebSocket connection failure
    const errorMessage = args.join(' ');
    if (errorMessage.includes('WebSocket connection') && errorMessage.includes('failed')) {
      // Suppress this specific error
      return;
    }
    // Call the original console.error for other errors
    originalConsoleError.apply(console, args);
  };
})();