import React from 'react';
import './MetricsPanel.css';

const MetricsPanel = ({ metrics, onReset }) => {
  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0 min: 0 sec';

    // Convert to real-world time by multiplying by 600 (simulation to real-world extrapolation)
    const realWorldSeconds = seconds * 600;
    const minutes = Math.floor(realWorldSeconds / 60);
    const remainingSeconds = Math.floor(realWorldSeconds % 60);

    return `${minutes} min: ${remainingSeconds} sec`;
  };

  const formatNumber = (num) => {
    if (isNaN(num) || !isFinite(num)) return '0.0';
    return num.toFixed(1);
  };

  return (
    <div className="metrics-panel">
      <h3 className=" ">{title}</h3>
      <div className="metrics-grid">
        <div className="metrics-top-row">
          <div className="metric">
            <div className="metric-label">Cars Completed</div>
            <div className="metric-value">{metrics.carsCompleted || 0}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Avg Travel Time</div>
            <div className="metric-value">{formatTime(metrics.avgTravelTime)}</div>
          </div>
        </div>
        <div className="metrics-bottom-row">
          <div className="metric metric-stops">
            <div className="metric-label">Stops per Car</div>
            <div className="metric-value">{formatNumber(metrics.stopsPerCar)}</div>
          </div>
          <div className="metric metric-speed">
            <div className="metric-label">Avg Speed</div>
            <div className="metric-value">{formatNumber(metrics.averageSpeed)}</div>
          </div>
        </div>
      </div>
      <button className="reset-button" onClick={onReset}>Reset Metrics</button>
    </div>
  );
};

export default MetricsPanel;
