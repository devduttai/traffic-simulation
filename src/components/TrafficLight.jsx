import React from 'react';

const TrafficLight = ({
  x,
  y,
  angle,
  state,
  isSmartControl,
  isEditable,
  onConfigure
}) => {
  const handleContextMenu = (e) => {
    if (!isEditable) return;
    e.preventDefault();
    e.stopPropagation();

    const action = window.prompt(
      "What would you like to do with this traffic light?\n1. Configure\nEnter number:",
      "1"
    );

    if (action === "1") {
      const greenDuration = parseInt(window.prompt("Enter green light duration (seconds):", "10"), 10);
      if (!isNaN(greenDuration) && greenDuration > 0) {
        onConfigure(greenDuration);
      }
    }
  };

  // Determine colors and glow effects based on state
  let redColor = '#555555'; // Default gray
  let amberColor = '#555555'; // Default gray
  let greenColor = '#555555'; // Default gray
  let redGlow = 'none';
  let amberGlow = 'none';
  let greenGlow = 'none';

  if (state === 'red') {
    redColor = '#FF0000'; // Bright red
    redGlow = '0 0 8px #FF0000, 0 0 16px #FF0000, 0 0 24px #FF0000'; // Enhanced red glow effect
  } else if (state === 'yellow') {
    amberColor = '#FFFF00'; // Bright yellow
    amberGlow = '0 0 8px #FFFF00, 0 0 16px #FFFF00, 0 0 24px #FFFF00'; // Enhanced yellow glow effect
  } else if (state === 'green') {
    greenColor = '#00FF00'; // Bright green
    greenGlow = '0 0 8px #00FF00, 0 0 16px #00FF00, 0 0 24px #00FF00'; // Enhanced green glow effect
  }

  // Add a small indicator if this is a smart traffic light
  const smartIndicator = isSmartControl ? (
    <circle cx={0} cy={-25} r={3} fill="#00ffff" />
  ) : null;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${angle})`}
      onContextMenu={handleContextMenu}
    >
      {/* Traffic light housing */}
      <rect
        x={-7.5}
        y={-25}
        width={15}
        height={50}
        fill="#333"
        rx={5}
        ry={5}
      />

      {/* Red light */}
      <circle
        cx={0}
        cy={15}
        r={5}
        fill={redColor}
        style={{ filter: redGlow !== 'none' ? `drop-shadow(${redGlow})` : 'none' }}
      />

      {/* Amber light */}
      <circle
        cx={0}
        cy={0}
        r={5}
        fill={amberColor}
        style={{ filter: amberGlow !== 'none' ? `drop-shadow(${amberGlow})` : 'none' }}
      />

      {/* Green light */}
      <circle
        cx={0}
        cy={-15}
        r={5}
        fill={greenColor}
        style={{ filter: greenGlow !== 'none' ? `drop-shadow(${greenGlow})` : 'none' }}
      />

      {/* Smart indicator */}
      {smartIndicator}
    </g>
  );
};

export default TrafficLight;
