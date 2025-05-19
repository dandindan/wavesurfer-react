/**
 * File: src/components/StatusBar.js
 * Description: Status indicator component
 * 
 * Version History:
 * v1.0.0 (2025-05-18) - Initial implementation
 */

import React from 'react';

const StatusBar = ({ status, type }) => {
  return (
    <div className="status">
      <span className={`text-${type} fw-bold`}>
        Status: {status}
      </span>
    </div>
  );
};

export default StatusBar;