import React from 'react';
import { calculateCarPosition } from '../utils/carManager';

const Car = ({ car, streets, locations }) => {
  // Check if required props are available
  if (!car || !streets || !locations) {
    console.warn('Car component missing required props:', { car, streets, locations });
    return null;
  }

  // Calculate car position
  const position = calculateCarPosition(car, streets, locations);


  if (!position) {
    //console.warn('Could not calculate position for car:', car.id);
    return null;
  }

  const { x, y, angle } = position;

  // ENHANCED: Professional car dimensions - more realistic proportions
  const carWidth = 28;
  const carHeight = 14;

  // Determine if car is slowing down or stopped (for tail lights)
  const isSlowingOrStopped = car.speed < 0.1 || (car.lastSpeed && car.speed < car.lastSpeed);

  // Determine turn signals based on nextTurn (FIXED: swapped left/right)
  const isLeftTurn = car.nextTurn === 'right'; // Fixed: was 'left'
  const isRightTurn = car.nextTurn === 'left'; // Fixed: was 'right'

  // ENHANCED: Turn signals only show when timing is active (1 second before turn)
  const shouldShowTurnSignals = car.turnSignalStartTime && (Date.now() - car.turnSignalStartTime < 5000); // Show for max 5 seconds

  // Blinking effect for turn signals (using current time)
  const blinkOn = Math.floor(Date.now() / 500) % 2 === 0;

  return (
    <g transform={`translate(${x}, ${y}) rotate(${angle})`}>
      {/* PROFESSIONAL CAR DESIGN - Modern sedan with realistic proportions */}

      {/* Main car body - rounded rectangle with modern styling */}
      <rect
        x={-carWidth/2}
        y={-carHeight/2}
        width={carWidth}
        height={carHeight}
        fill={car.color || '#FF0000'}
        stroke="#2a2a2a"
        strokeWidth="0.8"
        rx="4"
        ry="3"
        opacity={car.reachedDestination ? 0.3 : 1}
      />

      {/* Car hood - front section */}
      <rect
        x={carWidth/2 - 6}
        y={-carHeight/2 + 1}
        width={5}
        height={carHeight - 2}
        fill={car.color || '#FF0000'}
        stroke="#2a2a2a"
        strokeWidth="0.3"
        rx="2"
        ry="1"
        opacity={car.reachedDestination ? 0.3 : 0.9}
      />

      {/* Windshield - modern curved design */}
      <rect
        x={carWidth/2 - 8}
        y={-carHeight/2 + 2}
        width={4}
        height={carHeight - 4}
        fill="#4a90e2"
        stroke="#2a2a2a"
        strokeWidth="0.2"
        rx="1"
        ry="1"
        opacity="0.8"
      />

      {/* Rear window */}
      <rect
        x={-carWidth/2 + 2}
        y={-carHeight/2 + 2}
        width={3}
        height={carHeight - 4}
        fill="#4a90e2"
        stroke="#2a2a2a"
        strokeWidth="0.2"
        rx="1"
        ry="1"
        opacity="0.8"
      />

      {/* Side windows */}
      <rect
        x={-carWidth/2 + 6}
        y={-carHeight/2 + 1}
        width={carWidth - 14}
        height={2}
        fill="#4a90e2"
        stroke="#2a2a2a"
        strokeWidth="0.2"
        rx="0.5"
        ry="0.5"
        opacity="0.8"
      />
      <rect
        x={-carWidth/2 + 6}
        y={carHeight/2 - 3}
        width={carWidth - 14}
        height={2}
        fill="#4a90e2"
        stroke="#2a2a2a"
        strokeWidth="0.2"
        rx="0.5"
        ry="0.5"
        opacity="0.8"
      />

      {/* Modern LED headlights */}
      <ellipse
        cx={carWidth/2 - 1}
        cy={-carHeight/3}
        rx="1.5"
        ry="1"
        fill="#ffffff"
        stroke="#e0e0e0"
        strokeWidth="0.3"
      />
      <ellipse
        cx={carWidth/2 - 1}
        cy={carHeight/3}
        rx="1.5"
        ry="1"
        fill="#ffffff"
        stroke="#e0e0e0"
        strokeWidth="0.3"
      />

      {/* LED headlight inner glow */}
      <ellipse
        cx={carWidth/2 - 1}
        cy={-carHeight/3}
        rx="0.8"
        ry="0.5"
        fill="#f0f8ff"
      />
      <ellipse
        cx={carWidth/2 - 1}
        cy={carHeight/3}
        rx="0.8"
        ry="0.5"
        fill="#f0f8ff"
      />

      {/* Modern LED tail lights - light up when slowing down or stopped */}
      <ellipse
        cx={-carWidth/2 + 1}
        cy={-carHeight/3}
        rx="1.5"
        ry="1"
        fill={isSlowingOrStopped ? "#FF0000" : "#800000"}
        stroke="#600000"
        strokeWidth="0.3"
        opacity={isSlowingOrStopped ? 1 : 0.4}
        style={{
          filter: isSlowingOrStopped ? 'drop-shadow(0 0 3px #FF0000)' : 'none'
        }}
      />
      <ellipse
        cx={-carWidth/2 + 1}
        cy={carHeight/3}
        rx="1.5"
        ry="1"
        fill={isSlowingOrStopped ? "#FF0000" : "#800000"}
        stroke="#600000"
        strokeWidth="0.3"
        opacity={isSlowingOrStopped ? 1 : 0.4}
        style={{
          filter: isSlowingOrStopped ? 'drop-shadow(0 0 3px #FF0000)' : 'none'
        }}
      />

      {/* Modern LED turn signals - integrated into headlights and taillights */}
      {/* Front left turn signal */}
      <ellipse
        cx={carWidth/2 - 2}
        cy={-carHeight/2 + 1}
        rx="2"
        ry="1.2"
        fill={isLeftTurn && shouldShowTurnSignals && blinkOn ? "#FFA500" : "#804000"}
        stroke="#603000"
        strokeWidth="0.3"
        opacity={isLeftTurn && shouldShowTurnSignals && blinkOn ? 1 : 0.3}
        style={{
          filter: isLeftTurn && shouldShowTurnSignals && blinkOn ? 'drop-shadow(0 0 4px #FFA500) drop-shadow(0 0 8px #FFA500)' : 'none'
        }}
      />

      {/* Front right turn signal */}
      <ellipse
        cx={carWidth/2 - 2}
        cy={carHeight/2 - 1}
        rx="2"
        ry="1.2"
        fill={isRightTurn && shouldShowTurnSignals && blinkOn ? "#FFA500" : "#804000"}
        stroke="#603000"
        strokeWidth="0.3"
        opacity={isRightTurn && shouldShowTurnSignals && blinkOn ? 1 : 0.3}
        style={{
          filter: isRightTurn && shouldShowTurnSignals && blinkOn ? 'drop-shadow(0 0 4px #FFA500) drop-shadow(0 0 8px #FFA500)' : 'none'
        }}
      />

      {/* Rear left turn signal */}
      <ellipse
        cx={-carWidth/2 + 2}
        cy={-carHeight/2 + 1}
        rx="2"
        ry="1.2"
        fill={isLeftTurn && shouldShowTurnSignals && blinkOn ? "#FFA500" : "#804000"}
        stroke="#603000"
        strokeWidth="0.3"
        opacity={isLeftTurn && shouldShowTurnSignals && blinkOn ? 1 : 0.3}
        style={{
          filter: isLeftTurn && shouldShowTurnSignals && blinkOn ? 'drop-shadow(0 0 4px #FFA500) drop-shadow(0 0 8px #FFA500)' : 'none'
        }}
      />

      {/* Rear right turn signal */}
      <ellipse
        cx={-carWidth/2 + 2}
        cy={carHeight/2 - 1}
        rx="2"
        ry="1.2"
        fill={isRightTurn && shouldShowTurnSignals && blinkOn ? "#FFA500" : "#804000"}
        stroke="#603000"
        strokeWidth="0.3"
        opacity={isRightTurn && shouldShowTurnSignals && blinkOn ? 1 : 0.3}
        style={{
          filter: isRightTurn && shouldShowTurnSignals && blinkOn ? 'drop-shadow(0 0 4px #FFA500) drop-shadow(0 0 8px #FFA500)' : 'none'
        }}
      />

      {/* Car roof line for depth */}
      <rect
        x={-carWidth/2 + 4}
        y={-carHeight/2 + 3}
        width={carWidth - 8}
        height={carHeight - 6}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="0.3"
        rx="2"
        ry="1"
        opacity="0.6"
      />

      {/* Debug info */}
      <title>{`Car ${car.id} - Speed: ${car.speed?.toFixed(2)} - From: ${car.startLocationId} To: ${car.destinationId}`}</title>
    </g>
  );
};

export default Car;
