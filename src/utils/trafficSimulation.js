import { calculateAngle } from './helpers';

/**
 * Determines if a location is an intersection
 * @param {Object} location - Location to check
 * @param {Array} streets - Array of all streets
 * @returns {boolean} True if location is an intersection
 */
export const isIntersection = (location, streets) => {
  // Count connected streets
  const connectedStreets = streets.filter(
    street => street.from === location.id || street.to === location.id
  );

  // A location is an intersection if it has 3 or more connected streets
  return connectedStreets.length >= 3;
};

/**
 * Gets all streets connected to a location
 * @param {Object} location - The location
 * @param {Array} streets - Array of all streets
 * @returns {Array} Array of connected streets
 */
export const getConnectedStreets = (location, streets) => {
  return streets.filter(
    street => street.from === location.id || street.to === location.id
  );
};

/**
 * Determines if two streets are opposite at an intersection
 * @param {Object} street1 - First street
 * @param {Object} street2 - Second street
 * @param {Object} intersection - The intersection location
 * @param {Array} locations - Array of all locations
 * @returns {boolean} True if the streets are opposite
 */
export const areStreetsOpposite = (street1, street2, intersection, locations) => {
  // Get the other end of each street
  const street1OtherEnd = street1.from === intersection.id
    ? locations.find(loc => loc.id === street1.to)
    : locations.find(loc => loc.id === street1.from);

  const street2OtherEnd = street2.from === intersection.id
    ? locations.find(loc => loc.id === street2.to)
    : locations.find(loc => loc.id === street2.from);

  if (!street1OtherEnd || !street2OtherEnd) return false;

  // Calculate angles from intersection to each street end
  const angle1 = calculateAngle(intersection, street1OtherEnd);
  const angle2 = calculateAngle(intersection, street2OtherEnd);

  // Calculate the difference between angles
  let angleDiff = Math.abs(angle1 - angle2);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;

  // Streets are considered opposite if the angle is close to 180 degrees
  return angleDiff > 165 && angleDiff < 195;
};

/**
 * Creates traffic lights for an intersection
 * @param {Object} intersection - Intersection location
 * @param {Array} streets - Array of all streets
 * @param {Array} locations - Array of all locations
 * @returns {Array} Array of traffic light objects
 */
export const createTrafficLights = (intersection, streets, locations) => {
  // Get all streets connected to this intersection
  const connectedStreets = streets.filter(
    street => street.from === intersection.id || street.to === intersection.id
  );

  // Group streets by direction (roughly north, east, south, west)
  const streetsByDirection = groupStreetsByDirection(intersection, connectedStreets, locations);
  console.log(`Grouped ${Object.keys(streetsByDirection).length} directions for intersection ${intersection.id}`);

  // Create traffic light groups
  const trafficLights = [];

  // Create a traffic light for each connected street
  connectedStreets.forEach((street, index) => {
    // Determine the other end of the street
    const otherEndId = street.from === intersection.id ? street.to : street.from;
    const otherEnd = locations.find(loc => loc.id === otherEndId);

    if (!otherEnd) return;

    // Calculate angle from intersection to other end
    const angle = Math.atan2(
      otherEnd.y - intersection.y,
      otherEnd.x - intersection.x
    ) * (180 / Math.PI);

    // Determine which group this street belongs to
    const direction = getDirectionFromAngle(angle);
    const group = Math.floor(index / 2); // Simple grouping: alternate streets

    // Calculate position for the traffic light (slightly offset from intersection)
    const offsetDistance = 35; // Increased distance from intersection center
    const offsetX = Math.cos((angle * Math.PI) / 180) * offsetDistance;
    const offsetY = Math.sin((angle * Math.PI) / 180) * offsetDistance;

    // Create the traffic light
    trafficLights.push({
      id: `light-${intersection.id}-${index}`,
      locationId: intersection.id,
      streetId: street.id,
      x: intersection.x + offsetX,
      y: intersection.y + offsetY,
      angle: angle,
      direction: direction,
      group: group,
      state: 'red', // Default state
      config: {
        green: 10000, // 10 seconds green by default
        yellow: 3000, // 3 seconds yellow
        red: 13000 // 13 seconds red (green + yellow of other direction)
      }
    });
  });

  return trafficLights;
};

/**
 * Groups streets by their cardinal direction
 * @param {Object} intersection - Intersection location
 * @param {Array} streets - Connected streets
 * @param {Array} locations - All locations
 * @returns {Object} Streets grouped by direction
 */
const groupStreetsByDirection = (intersection, streets, locations) => {
  const groups = {
    north: [],
    east: [],
    south: [],
    west: []
  };

  streets.forEach(street => {
    // Get the other end of the street
    const otherEndId = street.from === intersection.id ? street.to : street.from;
    const otherEnd = locations.find(loc => loc.id === otherEndId);

    if (!otherEnd) return;

    // Calculate angle
    const angle = Math.atan2(
      otherEnd.y - intersection.y,
      otherEnd.x - intersection.x
    ) * (180 / Math.PI);

    // Assign to direction group
    const direction = getDirectionFromAngle(angle);
    groups[direction].push(street);
  });

  return groups;
};

/**
 * Determines cardinal direction from angle
 * @param {number} angle - Angle in degrees
 * @returns {string} Cardinal direction (north, east, south, west)
 */
const getDirectionFromAngle = (angle) => {
  // Normalize angle to 0-360
  const normalizedAngle = ((angle % 360) + 360) % 360;

  if (normalizedAngle >= 315 || normalizedAngle < 45) return 'east';
  if (normalizedAngle >= 45 && normalizedAngle < 135) return 'south';
  if (normalizedAngle >= 135 && normalizedAngle < 225) return 'west';
  return 'north';
};

/**
 * Updates traffic light states
 * @param {Array} trafficLights - Array of traffic lights
 * @param {number} deltaTime - Time step in seconds
 * @param {boolean} isSmartControl - Whether to use smart traffic control
 * @returns {Array} Updated traffic lights
 */
export const updateTrafficLights = (trafficLights, deltaTime, isSmartControl) => {
  // TODO: Use deltaTime and isSmartControl for traffic light timing logic
  console.log(`Updating ${trafficLights.length} traffic lights with deltaTime ${deltaTime} and smart control ${isSmartControl}`);

  // Group traffic lights by intersection
  const lightsByIntersection = {};

  trafficLights.forEach(light => {
    if (!lightsByIntersection[light.locationId]) {
      lightsByIntersection[light.locationId] = [];
    }
    lightsByIntersection[light.locationId].push(light);
  });

  // Update each intersection's lights
  Object.values(lightsByIntersection).forEach(intersectionLights => {
    // Group by traffic light group
    const lightsByGroup = {};

    intersectionLights.forEach(light => {
      if (!lightsByGroup[light.group]) {
        lightsByGroup[light.group] = [];
      }
      lightsByGroup[light.group].push(light);
    });

    // Update each group
    Object.values(lightsByGroup).forEach(groupLights => {
      // Simple traffic light cycle
      // In a real implementation, we would track time and cycle through states

      // For now, just toggle states every 10 seconds
      const currentTime = Date.now();
      const cycleTime = 10000; // 10 seconds
      const cyclePosition = (currentTime % cycleTime) / cycleTime;

      groupLights.forEach(light => {
        if (cyclePosition < 0.7) {
          light.state = 'green';
        } else if (cyclePosition < 0.8) {
          light.state = 'yellow';
        } else {
          light.state = 'red';
        }
      });
    });
  });

  return trafficLights;
};

/**
 * Updates traffic lights with smart control
 * @param {Array} trafficLights - Array of traffic lights
 * @param {Array} cars - Array of cars
 * @param {Array} streets - Array of streets
 * @param {number} deltaTime - Time step in seconds
 * @returns {Array} Updated traffic lights
 */
export const updateTrafficLightsWithSmartControl = (trafficLights, cars, streets, deltaTime) => {
  // TODO: Use deltaTime for smart traffic light timing logic
  console.log(`Smart control updating ${trafficLights.length} lights for ${cars.length} cars with deltaTime ${deltaTime}`);

  // Group traffic lights by intersection
  const lightsByIntersection = {};

  trafficLights.forEach(light => {
    if (!lightsByIntersection[light.locationId]) {
      lightsByIntersection[light.locationId] = [];
    }
    lightsByIntersection[light.locationId].push(light);
  });

  // Update each intersection's lights
  Object.entries(lightsByIntersection).forEach(([locationId, intersectionLights]) => {
    // Group by traffic light group
    const lightsByGroup = {};

    intersectionLights.forEach(light => {
      if (!lightsByGroup[light.group]) {
        lightsByGroup[light.group] = [];
      }
      lightsByGroup[light.group].push(light);
    });

    // Calculate traffic density for each approach
    const trafficDensityByStreet = {};

    // Count cars approaching this intersection
    cars.forEach(car => {
      if (car.reachedDestination) return;

      const street = streets.find(s => s.id === car.currentStreetId);
      if (!street) return;

      // Check if car is approaching this intersection
      const approachingLocationId = car.direction === 'forward' ? street.to : street.from;

      if (approachingLocationId === locationId && car.progress > 0.5) {
        if (!trafficDensityByStreet[street.id]) {
          trafficDensityByStreet[street.id] = 0;
        }
        trafficDensityByStreet[street.id]++;
      }
    });

    // Determine which group has the highest traffic density
    let maxDensityGroup = 0;
    let maxDensity = -1;

    Object.entries(lightsByGroup).forEach(([group, groupLights]) => {
      const groupDensity = groupLights.reduce((sum, light) => {
        return sum + (trafficDensityByStreet[light.streetId] || 0);
      }, 0);

      if (groupDensity > maxDensity) {
        maxDensity = groupDensity;
        maxDensityGroup = parseInt(group);
      }
    });

    // Update light states based on traffic density
    Object.entries(lightsByGroup).forEach(([group, groupLights]) => {
      const isGreenGroup = parseInt(group) === maxDensityGroup;

      groupLights.forEach(light => {
        // If this group has the highest density, make it green
        // Otherwise, make it red
        if (isGreenGroup) {
          light.state = 'green';
        } else {
          // Check if it was already green and needs to transition to yellow
          if (light.state === 'green') {
            light.state = 'yellow';

            // Schedule it to turn red after a short delay
            setTimeout(() => {
              light.state = 'red';
            }, 2000);
          } else if (light.state !== 'yellow') {
            light.state = 'red';
          }
        }
      });
    });
  });

  return trafficLights;
};

// NOTE: simulateTraffic function moved to carManager.js to avoid duplication
// This file now only contains traffic light management functions

/**
 * Creates a random car at a parking lot
 * @param {string} startLocationId - ID of the starting location (parking lot)
 * @param {string} destinationId - ID of the destination location
 * @param {string} startStreetId - ID of the street to start on
 * @param {Array} streets - Array of all streets
 * @returns {Object} New car object
 */
export const createRandomCar = (startLocationId, destinationId, startStreetId, streets) => {
  // Find the starting street
  const startStreet = streets.find(s => s.id === startStreetId);
  if (!startStreet) return null;

  // Determine direction based on street endpoints
  const direction = startStreet.from === startLocationId ? 'forward' : 'backward';
  const progress = direction === 'forward' ? 0 : 1;

  const carId = `car-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const color = getRandomCarColor();

  return {
    id: carId,
    originId: startLocationId,
    destinationId: destinationId,
    currentStreetId: startStreetId,
    direction: direction,
    progress: progress,
    speed: 0.5, // Higher initial speed
    maxSpeed: 0.5 + Math.random() * 0.5, // Random speed between 0.5 and 1.0
    color: color,
    reachedDestination: false,
    createdAt: Date.now(),
    stops: 0,
    timeNotMoving: 0
  };
};

/**
 * Calculates car position on the street
 * @param {Object} car - Car object
 * @param {Array} streets - Array of all streets
 * @param {Array} locations - Array of all locations
 * @returns {Object|null} Position object with x, y coordinates and angle
 */
export const calculateCarPosition = (car, streets, locations) => {
  // Find the street the car is on
  const street = streets.find(s => s.id === car.currentStreetId);
  if (!street) return null;

  // Find the locations at each end of the street
  const fromLocation = locations.find(loc => loc.id === street.from);
  const toLocation = locations.find(loc => loc.id === street.to);
  if (!fromLocation || !toLocation) return null;

  // Calculate position based on progress and direction
  let progress = car.progress;

  // Calculate position along the street
  const x = fromLocation.x + (toLocation.x - fromLocation.x) * progress;
  const y = fromLocation.y + (toLocation.y - fromLocation.y) * progress;

  // Calculate angle based on street direction
  const angle = Math.atan2(
    toLocation.y - fromLocation.y,
    toLocation.x - fromLocation.x
  ) * (180 / Math.PI);

  // Adjust angle based on car direction
  const finalAngle = car.direction === 'forward' ? angle : angle + 180;

  return { x, y, angle: finalAngle };
};

/**
 * Returns a random car color
 * @returns {string} Random color in hex format
 */
export const getRandomCarColor = () => {
  const colors = [
    '#FF0000', // Red
    '#00FF00', // Green
    '#0000FF', // Blue
    '#FFFF00', // Yellow
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#FF8000', // Orange
    '#8000FF', // Purple
    '#0080FF', // Light Blue
    '#FF0080'  // Pink
  ];

  return colors[Math.floor(Math.random() * colors.length)];
};
