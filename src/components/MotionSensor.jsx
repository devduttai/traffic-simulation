import React from 'react';
import { calculateCarPosition } from '../utils/carManager';

const MotionSensor = ({ x, y, angle, cars, streets, locations }) => {
  // Check if any car is near this sensor
  const isCarNear = cars.some(car => {
    if (!car || car.reachedDestination) return false;

    // Get car's actual position
    const carPosition = calculateCarPosition(car, streets, locations);
    if (!carPosition) return false;

    // Calculate distance to sensor
    const distance = Math.hypot(carPosition.x - x, carPosition.y - y);
    return distance < 30; // Detection range
  });

  // Blinking effect for activated sensors
  const blinkOn = Math.floor(Date.now() / 300) % 2 === 0;

  return (
    <g transform={`translate(${x}, ${y}) rotate(${angle})`}>
      {/* Sensor housing - keep same size */}
      <rect
        x={0}
        y={-8}
        width={6}
        height={16}
        fill="#666"
        rx={2}
        ry={2}
      />

      {/* Sensor bubble - twice as big, dark blue when passive, bright blue when active */}
      <circle
        cx={0}
        cy={0}
        r={4} // Doubled from 2 to 4
        fill={isCarNear ? (blinkOn ? "#0080FF" : "#004080") : "#003366"}
        opacity={isCarNear ? 1 : 0.7}
        style={{
          filter: isCarNear && blinkOn ?
            'drop-shadow(0 0 8px #0080FF) drop-shadow(0 0 16px #0080FF)' :
            'none'
        }}
      />

      {/* Transmission effect - expanding and fading blue circle when activated */}
      {isCarNear && (
        <>
          <circle
            cx={0}
            cy={0}
            r={8 + (Date.now() % 1000) / 50} // Expanding circle
            fill="none"
            stroke="#0080FF"
            strokeWidth={2}
            opacity={1 - (Date.now() % 1000) / 1000} // Fading effect
          />
          <circle
            cx={0}
            cy={0}
            r={12 + (Date.now() % 1500) / 75} // Second expanding circle
            fill="none"
            stroke="#0080FF"
            strokeWidth={1}
            opacity={0.5 - (Date.now() % 1500) / 3000} // Fading effect
          />
        </>
      )}
    </g>
  );
};

export default MotionSensor;
