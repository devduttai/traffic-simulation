/**
 * Car Manager - Handles all car-related operations
 */

// Unique ID generator
const generateUniqueId = () => `car-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

// Bright car color generator - only bright colors for visibility on dark streets
export const getRandomCarColor = () => {
  const colors = [
    '#FF0000', // Bright Red
    '#00FF00', // Bright Green
    '#0080FF', // Bright Blue
    '#FFFF00', // Bright Yellow
    '#FF00FF', // Bright Magenta
    '#00FFFF', // Bright Cyan
    '#FF8000', // Bright Orange
    '#8000FF', // Bright Purple
    '#FF4080', // Bright Pink
    '#80FF00', // Bright Lime
    '#FF0080', // Bright Rose
    '#0040FF'  // Bright Electric Blue
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Creates a new car
 * @param {string} startLocationId - Starting location ID
 * @param {string} destinationId - Destination location ID
 * @param {string} startStreetId - Starting street ID
 * @param {string} direction - Direction ('forward' or 'backward')
 * @param {number} maxSpeed - Maximum speed of the car
 * @returns {Object} New car object
 */
export const createCar = (startLocationId, destinationId, startStreetId, direction, maxSpeed = 1.0) => {
  const id = generateUniqueId();

  // Random preferred speed between 1-4 car lengths per second (as per spec)
  // Doubled for faster simulation
  const preferredSpeed = Math.min((0.3 + Math.random() * 0.4) * 2, maxSpeed);

  return {
    id,
    startLocationId,
    destinationId,
    currentStreetId: startStreetId,
    direction,
    // FIXED: Cars should always start at the beginning of their journey
    // For forward direction: start near 0 (at 'from' location)
    // For backward direction: start near 1 (at 'to' location)
    progress: direction === 'forward' ? 0.05 : 0.95, // Start slightly away from the starting location
    speed: 0,
    maxSpeed: preferredSpeed,
    preferredSpeed: preferredSpeed,
    color: getRandomCarColor(),
    createdAt: Date.now(),
    reachedDestination: false,
    counted: false,
    stops: 0,
    timeNotMoving: 0,
    timeNotMovingStart: null,
    lastPosition: null,
    path: [], // Track the path taken
    nextTurn: null, // 'left', 'right', 'straight'
    waitingToTurnLeft: false,
    followingCar: null, // ID of car being followed
    streetsTraveled: 0, // Count of streets traveled (for travel time metric)
    totalTravelTime: 0, // Total time spent traveling on streets
    currentStreetStartTime: Date.now(), // When car started on current street
    turnSignalStartTime: null, // When turn signal should start blinking
    lane: 'right', // Always drive on right side
    totalDistance: 0, // Track total distance traveled for speed calculation
    locationsVisited: 0, // Track number of locations visited
    lastSpeed: 0, // Track previous speed for tail light logic
    originalId: null // For twin synchronization
  };
};

/**
 * Calculates car position on a street with right-hand driving
 * @param {Object} car - Car object
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {Object|null} Position object with x, y coordinates and angle
 */
export const calculateCarPosition = (car, streets, locations) => {
  // Validate inputs
  if (!car || !streets || !locations || !Array.isArray(streets) || !Array.isArray(locations)) {
    console.warn('calculateCarPosition received invalid parameters:', { car, streets, locations });
    return null;
  }

  // Find the street the car is on
  const street = streets.find(s => s && s.id === car.currentStreetId);

  if (!street) {
    //console.warn(`Street not found for car ${car.id} with streetId ${car.currentStreetId}`);
    return null;
  }

  // Find the locations at each end of the street
  const fromLocation = locations.find(loc => loc && loc.id === street.from);
  const toLocation = locations.find(loc => loc && loc.id === street.to);
  if (!fromLocation || !toLocation) {
    console.warn(`Locations not found for street ${street.id}: from=${street.from}, to=${street.to}`);
    return null;
  }

  // Calculate position based on progress
  let progress = car.progress;
  if (progress < 0) progress = 0;
  if (progress > 1) progress = 1;

  // Calculate center line position
  // CRITICAL FIX: For backward direction, we need to invert the progress calculation
  // This ensures that progress=0 is always the start point of the car's journey on this street
  // and progress=1 is always the end point, regardless of direction
  let centerX, centerY;
  if (car.direction === 'forward') {
    // Forward: from 'from' location to 'to' location
    // progress=0 -> at fromLocation, progress=1 -> at toLocation
    centerX = fromLocation.x + (toLocation.x - fromLocation.x) * progress;
    centerY = fromLocation.y + (toLocation.y - fromLocation.y) * progress;
  } else {
    // Backward: from 'to' location to 'from' location
    // progress=0 -> at toLocation, progress=1 -> at fromLocation
    // FIXED: Use (1 - progress) to invert the direction
    centerX = toLocation.x + (fromLocation.x - toLocation.x) * (1 - progress);
    centerY = toLocation.y + (fromLocation.y - toLocation.y) * (1 - progress);
  }

  // Calculate street angle
  const streetAngle = Math.atan2(toLocation.y - fromLocation.y, toLocation.x - fromLocation.x);

  // Debug logging for problematic cars - increased frequency for testing
  if (Math.random() < 0.05) { // 5% chance to log
    console.log(`🚗 Car ${car.id.substring(0, 8)} position calculation:`, {
      streetId: car.currentStreetId.substring(0, 8),
      direction: car.direction,
      progress: progress.toFixed(3),
      fromLocation: { x: fromLocation.x.toFixed(1), y: fromLocation.y.toFixed(1), id: fromLocation.id.substring(0, 8) },
      toLocation: { x: toLocation.x.toFixed(1), y: toLocation.y.toFixed(1), id: toLocation.id.substring(0, 8) },
      calculatedCenter: { x: centerX.toFixed(1), y: centerY.toFixed(1) },
      finalPosition: { x: (centerX + Math.cos(car.direction === 'forward' ? streetAngle + Math.PI/2 : streetAngle - Math.PI/2) * 12).toFixed(1),
                      y: (centerY + Math.sin(car.direction === 'forward' ? streetAngle + Math.PI/2 : streetAngle - Math.PI/2) * 12).toFixed(1) }
    });
  }

  // Calculate perpendicular angle for lane offset
  // For right-hand driving: add 90° when going forward, subtract 90° when going backward
  const perpAngle = car.direction === 'forward'
    ? streetAngle + Math.PI/2  // Add 90° for right-hand side when going forward
    : streetAngle - Math.PI/2; // Subtract 90° for right-hand side when going backward

  // Apply lane offset
  const laneOffset = 12;
  const laneOffsetX = Math.cos(perpAngle) * laneOffset;
  const laneOffsetY = Math.sin(perpAngle) * laneOffset;

  // Final position
  const x = centerX + laneOffsetX;
  const y = centerY + laneOffsetY;

  // Calculate car angle (direction)
  let angle = streetAngle * 180 / Math.PI;

  // If car is going backward, flip the angle
  if (car.direction === 'backward') {
    angle = (angle + 180) % 360;
  }

  return { x, y, angle };
};

// Global routing decisions cache to synchronize twin cars
const routingDecisions = new Map();

/**
 * Streamlined routing logic for three distinct scenarios
 * @param {string} currentLocationId - Current location ID
 * @param {string} destinationId - Destination location ID
 * @param {string} previousStreetId - Previous street ID (to avoid going back)
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @param {string} carOriginalId - Original car ID for synchronization
 * @returns {Object|null} Best street object, direction, and turn type
 */
export const findBestNextStreet = (currentLocationId, destinationId, previousStreetId, streets, locations, carOriginalId = null) => {
  // TODO: Use destinationId for more intelligent routing in future versions
  console.log(`Finding best street from ${currentLocationId} to ${destinationId} for car ${carOriginalId || 'unknown'}`);

  // Get all connected streets
  const allConnectedStreets = streets.filter(
    s => (s.from === currentLocationId || s.to === currentLocationId)
  );

  // Filter out the previous street for normal routing
  const connectedStreets = streets.filter(
    s => (s.from === currentLocationId || s.to === currentLocationId) && s.id !== previousStreetId
  );

  // Create a unique key for this routing decision
  const routingKey = `${carOriginalId}-${currentLocationId}-${previousStreetId}`;

  // Check if we already have a routing decision for this car's twin
  if (carOriginalId && routingDecisions.has(routingKey)) {
    const cachedDecision = routingDecisions.get(routingKey);
    console.log(`🔄 Using cached routing decision for car ${carOriginalId} at ${currentLocationId}`);
    return cachedDecision;
  }

  let routingDecision = null;

  // SCENARIO 1: Dead end (1 street total) - Make U-turn
  if (allConnectedStreets.length === 1) {
    const street = allConnectedStreets[0];
    const direction = street.from === currentLocationId ? 'backward' : 'forward'; // Reverse direction for U-turn
    routingDecision = { street, direction, turn: 'uturn' };
    console.log(`🔄 SCENARIO 1: Dead end at ${currentLocationId} - U-turn on ${street.id}`);
  }

  // SCENARIO 2: Two streets (one in, one out) - Go straight through
  else if (allConnectedStreets.length === 2) {
    // Find the street that's NOT the one we came from
    const exitStreet = connectedStreets[0]; // There should be exactly one
    if (exitStreet) {
      const direction = exitStreet.from === currentLocationId ? 'forward' : 'backward';
      routingDecision = { street: exitStreet, direction, turn: 'straight' };
      console.log(`➡️ SCENARIO 2: Two streets at ${currentLocationId} - Going straight to ${exitStreet.id}`);
    } else {
      // Fallback: U-turn if no exit street found
      const street = allConnectedStreets[0];
      const direction = street.from === currentLocationId ? 'backward' : 'forward';
      routingDecision = { street, direction, turn: 'uturn' };
      console.log(`🔄 SCENARIO 2 Fallback: U-turn at ${currentLocationId}`);
    }
  }

  // SCENARIO 3: Intersection (3+ streets) - Random selection
  else if (allConnectedStreets.length >= 3) {
    // Randomly pick one of the available streets (excluding the one we came from)
    if (connectedStreets.length > 0) {
      const randomIndex = Math.floor(Math.random() * connectedStreets.length);
      const selectedStreet = connectedStreets[randomIndex];
      const direction = selectedStreet.from === currentLocationId ? 'forward' : 'backward';

      // Calculate turn type for intersection
      const currentLocation = locations.find(loc => loc.id === currentLocationId);
      const previousStreet = streets.find(s => s.id === previousStreetId);
      let turn = 'straight';

      if (currentLocation && previousStreet) {
        const prevOtherEndId = previousStreet.from === currentLocationId ? previousStreet.to : previousStreet.from;
        const prevOtherLocation = locations.find(loc => loc.id === prevOtherEndId);
        if (prevOtherLocation) {
          const approachAngle = Math.atan2(
            currentLocation.y - prevOtherLocation.y,
            currentLocation.x - prevOtherLocation.x
          );
          turn = calculateTurnType(currentLocation, selectedStreet, approachAngle, locations);
        }
      }

      routingDecision = { street: selectedStreet, direction, turn };
      console.log(`🎲 SCENARIO 3: Intersection at ${currentLocationId} - Random turn ${turn} to ${selectedStreet.id} (${randomIndex + 1}/${connectedStreets.length} options)`);
    } else {
      // Fallback: U-turn if no connected streets
      const street = allConnectedStreets[0];
      const direction = street.from === currentLocationId ? 'backward' : 'forward';
      routingDecision = { street, direction, turn: 'uturn' };
      console.log(`🔄 SCENARIO 3 Fallback: U-turn at ${currentLocationId}`);
    }
  }

  // Fallback for unexpected cases
  else {
    console.warn(`⚠️ Unexpected routing scenario at ${currentLocationId}: ${allConnectedStreets.length} streets`);
    if (allConnectedStreets.length > 0) {
      const street = allConnectedStreets[0];
      const direction = street.from === currentLocationId ? 'forward' : 'backward';
      routingDecision = { street, direction, turn: 'straight' };
      console.log(`🔧 FALLBACK: Using first available street ${street.id} with direction ${direction}`);
    } else {
      console.error(`❌ CRITICAL: No streets available at ${currentLocationId}!`);
      return null; // No streets available
    }
  }

  // Cache the decision for twin car synchronization
  if (carOriginalId && routingDecision) {
    routingDecisions.set(routingKey, routingDecision);
    console.log(`💾 Cached routing decision for car ${carOriginalId} at ${currentLocationId}`);
  }

  return routingDecision;
};

/**
 * Clears the routing decisions cache
 * Useful when resetting the simulation or changing scenarios
 */
export const clearRoutingCache = () => {
  routingDecisions.clear();
  console.log('🗑️ Routing cache cleared');
};

/**
 * Gets routing statistics for debugging
 * @returns {Object} Routing statistics
 */
export const getRoutingStats = () => {
  return {
    cachedDecisions: routingDecisions.size,
    decisions: Array.from(routingDecisions.entries()).map(([key, decision]) => ({
      key,
      street: decision.street.id,
      direction: decision.direction,
      turn: decision.turn
    }))
  };
};

/**
 * Calculates the type of turn needed
 * @param {Object} currentLocation - Current intersection location
 * @param {Object} nextStreet - Street to turn onto
 * @param {number} approachAngle - Angle of approach in radians
 * @param {Array} locations - All locations
 * @returns {string} Turn type: 'left', 'right', 'straight', 'uturn'
 */
const calculateTurnType = (currentLocation, nextStreet, approachAngle, locations) => {
  // Find the other end of the next street
  const otherEndId = nextStreet.from === currentLocation.id ? nextStreet.to : nextStreet.from;
  const otherEndLocation = locations.find(loc => loc.id === otherEndId);

  if (!otherEndLocation) return 'straight';

  // Calculate exit angle
  const exitAngle = Math.atan2(
    otherEndLocation.y - currentLocation.y,
    otherEndLocation.x - currentLocation.x
  );

  // Calculate turn angle
  let turnAngle = exitAngle - approachAngle;

  // Normalize to [-π, π]
  while (turnAngle > Math.PI) turnAngle -= 2 * Math.PI;
  while (turnAngle < -Math.PI) turnAngle += 2 * Math.PI;

  // Determine turn type based on angle
  const turnDegrees = Math.abs(turnAngle * 180 / Math.PI);

  if (turnDegrees < 30) {
    return 'straight';
  } else if (turnDegrees > 150) {
    return 'uturn';
  } else if (turnAngle > 0) {
    return 'left';
  } else {
    return 'right';
  }
};



/**
 * Updates a car's position and state with proper traffic behavior
 * @param {Object} car - Car object
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @param {Array} trafficLights - All traffic lights
 * @param {number} deltaTime - Time step in seconds
 * @param {Array} allCars - All cars for collision detection
 * @returns {Object} Updated car
 */
export const updateCar = (car, streets, locations, trafficLights, deltaTime, allCars = []) => {
  // Skip cars that have reached their destination
  if (car.reachedDestination) return car;

  // Get current street
  const currentStreet = streets.find(s => s.id === car.currentStreetId);
  if (!currentStreet) return { ...car, reachedDestination: true };

  // Get start and end locations of current street
  const fromLocation = locations.find(loc => loc.id === currentStreet.from);
  const toLocation = locations.find(loc => loc.id === currentStreet.to);
  if (!fromLocation || !toLocation) return { ...car, reachedDestination: true };

  // Calculate target speed based on preferred speed
  let targetSpeed = car.preferredSpeed || car.maxSpeed;
  let shouldStop = false;
  let waitingToTurnLeft = false;

  // Check for cars ahead (car following behavior)
  const carAhead = findCarAhead(car, allCars, streets, locations);
  if (carAhead) {
    const distanceToCarAhead = calculateDistanceBetweenCars(car, carAhead, streets, locations);
    const CAR_LENGTH = 24; // Car length in pixels (matches visual size)
    const SAFE_FOLLOWING_DISTANCE = CAR_LENGTH * 2.5; // 2.5 car lengths for realistic following
    const MINIMUM_DISTANCE = CAR_LENGTH * 1.2; // Minimum distance to prevent overlap

    if (distanceToCarAhead < SAFE_FOLLOWING_DISTANCE) {
      // Gradual speed reduction based on distance
      const speedReduction = Math.max(0, (SAFE_FOLLOWING_DISTANCE - distanceToCarAhead) / SAFE_FOLLOWING_DISTANCE);
      targetSpeed = Math.min(targetSpeed, carAhead.speed * (1 - speedReduction * 0.5));

      if (distanceToCarAhead < MINIMUM_DISTANCE) {
        targetSpeed = 0; // Stop if too close to prevent overlap
        shouldStop = true;
      }
    }
  }

  // Check for traffic lights
  const relevantLights = trafficLights.filter(light => {
    // A light is relevant if it controls this street and is at the end the car is approaching
    const isAtEnd = (car.direction === 'forward' && light.locationId === currentStreet.to) ||
                   (car.direction === 'backward' && light.locationId === currentStreet.from);
    return light.streetId === car.currentStreetId && isAtEnd;
  });

  // Check if car should stop for a red light
  const shouldStopForLight = relevantLights.some(light => {
    // Calculate distance to intersection (as a percentage of street length)
    let distanceToIntersection;
    if (car.direction === 'forward') {
      distanceToIntersection = 1 - car.progress;
    } else {
      distanceToIntersection = car.progress;
    }

    // Calculate if car has entered the intersection
    const LOCATION_RADIUS = 20; // Radius of location circle in pixels
    const streetLength = Math.hypot(toLocation.x - fromLocation.x, toLocation.y - fromLocation.y);
    const distanceToIntersectionPixels = distanceToIntersection * streetLength;
    const hasEnteredIntersection = distanceToIntersectionPixels < LOCATION_RADIUS;

    // Debug traffic light behavior - more frequent logging for testing
    if (Math.random() < 0.05 && distanceToIntersection < 0.4) { // Log when cars are near lights
      console.log(`Car ${car.id} approaching traffic light:`, {
        lightId: light.id,
        lightState: light.state,
        distanceToIntersection: distanceToIntersection.toFixed(3),
        hasEnteredIntersection,
        shouldStop: (light.state === 'red' ||
                    (light.state === 'yellow' && !hasEnteredIntersection)) &&
                    distanceToIntersection < 0.3,
        carDirection: car.direction,
        streetId: car.currentStreetId
      });
    }

    // Stop for red lights - stop at the very edge of the intersection unless there's a car ahead
    if (light.state === 'red' && distanceToIntersection < 0.3) {
      // Check if there's a car ahead that's already stopped
      const carAhead = findCarAhead(car, allCars, streets, locations);
      if (!carAhead || calculateDistanceBetweenCars(car, carAhead, streets, locations) > 30) {
        // No car ahead or car ahead is far enough - stop at intersection edge
        const LOCATION_RADIUS_PIXELS = 20;
        const streetLength = Math.hypot(toLocation.x - fromLocation.x, toLocation.y - fromLocation.y);
        const targetStopDistance = LOCATION_RADIUS_PIXELS / streetLength; // Stop at location edge

        if (distanceToIntersection > targetStopDistance) {
          return true;
        }
      } else {
        // There's a car ahead - use normal following behavior
        return true;
      }
    }

    // For yellow lights: stop only if not already in the intersection
    if (light.state === 'yellow' && !hasEnteredIntersection && distanceToIntersection < 0.3) {
      return true;
    }

    // Special handling for left turns
    if (light.state === 'green' && car.nextTurn === 'left' && distanceToIntersection < 0.1) {
      // Check for oncoming traffic
      const hasOncomingTraffic = checkForOncomingTraffic(car, allCars, streets, locations);
      if (hasOncomingTraffic) {
        waitingToTurnLeft = true;
        return true;
      }
    }

    return false;
  });

  if (shouldStopForLight) {
    targetSpeed = 0;
    shouldStop = true;
  }

  // Update car state
  const updatedCar = { ...car };
  updatedCar.waitingToTurnLeft = waitingToTurnLeft;
  updatedCar.lastSpeed = car.speed; // Store previous speed for tail light logic

  // Enhanced tracking of stops and time not moving
  const wasMoving = car.speed > 0.1;

  // Smooth acceleration and deceleration for realistic movement
  const ACCELERATION = 1.2; // Doubled acceleration (was 0.6)
  const DECELERATION = 2.4; // Doubled deceleration (was 1.2)
  const EMERGENCY_DECELERATION = 5.0; // Doubled emergency deceleration (was 2.5)
  const TURN_DECELERATION = 3.0; // Additional deceleration when approaching turns

  // Check if car is approaching a turn and should decelerate
  let isApproachingTurn = false;
  if (car.nextTurn && (car.nextTurn === 'left' || car.nextTurn === 'right')) {
    // Check if car is close to the end of the street (approaching turn)
    const distanceToEnd = car.direction === 'forward' ? (1 - car.progress) : car.progress;
    if (distanceToEnd < 0.2) { // Within 20% of street end
      isApproachingTurn = true;
      targetSpeed = Math.min(targetSpeed, car.preferredSpeed * 0.6); // Reduce speed for turn
    }
  }

  // Use emergency braking if very close to car ahead or obstacle
  const useEmergencyBraking = shouldStop && (updatedCar.speed > targetSpeed + 0.2);
  const useApproachingTurnDeceleration = isApproachingTurn && !shouldStop;

  let deceleration = DECELERATION;
  if (useEmergencyBraking) {
    deceleration = EMERGENCY_DECELERATION;
  } else if (useApproachingTurnDeceleration) {
    deceleration = TURN_DECELERATION;
  }

  if (updatedCar.speed < targetSpeed) {
    updatedCar.speed = Math.min(updatedCar.speed + ACCELERATION * deltaTime, targetSpeed);
  } else if (updatedCar.speed > targetSpeed) {
    updatedCar.speed = Math.max(updatedCar.speed - deceleration * deltaTime, Math.max(0, targetSpeed));
  }

  // FIXED: Track stops after speed is updated
  const isNowStopped = updatedCar.speed < 0.1;

  // Track stops more accurately - only count when car transitions from moving to stopped due to traffic conditions
  if (wasMoving && isNowStopped && shouldStop) {
    updatedCar.stops = (car.stops || 0) + 1;
    updatedCar.lastStopTime = Date.now();

    // Determine stop reason for logging
    const stopReason = relevantLights.some(light => light.state === 'red' || light.state === 'yellow') ? 'Traffic Light' : 'Car Ahead';
    console.log(`🛑 Car ${car.id} stopped (stop #${updatedCar.stops}) - Reason: ${stopReason}`);
  }

  // Track time not moving more precisely
  if (isNowStopped) {
    if (!car.timeNotMovingStart) {
      updatedCar.timeNotMovingStart = Date.now();
    }
    updatedCar.timeNotMoving = (car.timeNotMoving || 0) + deltaTime;
  } else {
    // Car is moving, reset the not moving timer
    updatedCar.timeNotMovingStart = null;
  }

  // Calculate progress change based on speed
  const progressChange = updatedCar.speed * deltaTime * 0.08; // Scale factor unchanged

  // Track total distance traveled (for speed calculation)
  const distanceTraveled = updatedCar.speed * deltaTime;
  updatedCar.totalDistance = (car.totalDistance || 0) + distanceTraveled;

  // Update progress based on direction
  if (updatedCar.direction === 'forward') {
    updatedCar.progress += progressChange;
  } else {
    updatedCar.progress -= progressChange;
  }

  // ENHANCED: Turn signal timing - start blinking 1 second before reaching intersection
  const distanceToEnd = updatedCar.direction === 'forward' ? (1 - updatedCar.progress) : updatedCar.progress;
  const timeToReachEnd = distanceToEnd / (updatedCar.speed || 0.1); // Avoid division by zero

  // Start turn signals 1 second before reaching the end (if we have a planned turn)
  if (timeToReachEnd <= 1.0 && timeToReachEnd > 0 && updatedCar.nextTurn && updatedCar.nextTurn !== 'straight') {
    if (!updatedCar.turnSignalStartTime) {
      updatedCar.turnSignalStartTime = Date.now();
      console.log(`Car ${updatedCar.id} started turn signal for ${updatedCar.nextTurn} turn`);
    }
  }

  // Check if car has reached the end of the street
  if ((updatedCar.progress >= 1 && updatedCar.direction === 'forward') ||
      (updatedCar.progress <= 0 && updatedCar.direction === 'backward')) {

    // Determine which location we've reached
    const nextLocationId = updatedCar.direction === 'forward' ? currentStreet.to : currentStreet.from;
    const nextLocation = locations.find(loc => loc.id === nextLocationId);

    if (!nextLocation) {
      console.log(`Car ${updatedCar.id} reached invalid location ${nextLocationId}`);
      return { ...updatedCar, reachedDestination: true };
    }

    // Check if this is a parking lot (cars start and end journeys at parking lots)
    const connectedStreets = streets.filter(s => s.from === nextLocationId || s.to === nextLocationId);
    const isParkingLot = connectedStreets.length === 1;

    if (isParkingLot) {
      // Car has reached a parking lot - immediately exit and start new journey
      updatedCar.locationsVisited = (car.locationsVisited || 0) + 1;
      console.log(`Car ${updatedCar.id} reached parking lot ${nextLocationId}, immediately exiting and starting new journey (visited ${updatedCar.locationsVisited} locations)`);

      // Find the street connected to this parking lot (there's only one)
      const exitStreet = connectedStreets[0];

      // Find all parking lots for new destination (excluding current one)
      const allParkingLots = locations.filter(loc => {
        const connectedToLoc = streets.filter(s => s.from === loc.id || s.to === loc.id);
        return connectedToLoc.length === 1 && loc.id !== nextLocationId;
      });

      if (allParkingLots.length > 0) {
        // Choose a random different parking lot as new destination
        const otherParkingLots = allParkingLots;
        if (otherParkingLots.length > 0) {
          const newDestination = otherParkingLots[Math.floor(Math.random() * otherParkingLots.length)];
          updatedCar.destinationId = newDestination.id;
          updatedCar.startLocationId = nextLocationId;
          console.log(`Car ${updatedCar.id} new journey: ${nextLocationId} -> ${newDestination.id}`);

          // FIXED: Immediately exit parking lot using the connected street
          // Determine direction to exit parking lot (opposite of how we entered)
          const exitDirection = exitStreet.from === nextLocationId ? 'forward' : 'backward';

          // Update car to immediately exit parking lot
          return {
            ...updatedCar,
            destinationId: newDestination.id,
            currentStreetId: exitStreet.id,
            direction: exitDirection,
            progress: exitDirection === 'forward' ? 0.05 : 0.95,
            nextTurn: null, // No turn needed when exiting parking lot
            path: [...(updatedCar.path || []), nextLocationId],
            speed: Math.max(updatedCar.speed, 0.1),
            waitingToTurnLeft: false,
            reachedDestination: false,
            streetsTraveled: (updatedCar.streetsTraveled || 0) + 1,
            totalTravelTime: (updatedCar.totalTravelTime || 0) + ((Date.now() - (updatedCar.currentStreetStartTime || Date.now())) / 1000),
            currentStreetStartTime: Date.now()
          };
        }
      }

      // If no other parking lots available, car reaches destination
      return { ...updatedCar, reachedDestination: true };
    }

    // Check if this is the destination (for non-parking lots)
    if (nextLocationId === updatedCar.destinationId && !isParkingLot) {
        console.log(`Car ${updatedCar.id} reached non-parking destination ${nextLocationId}, generating new destination`);
        // Generate a new destination since we reached a non-parking destination
        const newDestinationId = generateNewDestination(nextLocationId, locations, streets);

        // Find next street to travel on using streamlined routing logic for the new destination
        const newNextStreetInfo = findBestNextStreet(
          nextLocationId,
          newDestinationId,
          updatedCar.currentStreetId,
          streets,
          locations,
          updatedCar.originalId || updatedCar.id
        );

        if (!newNextStreetInfo || !newNextStreetInfo.street) {
          // No valid next street, make U-turn
          const newDirection = updatedCar.direction === 'forward' ? 'backward' : 'forward';
          const newProgress = updatedCar.direction === 'forward' ? 0.99 : 0.01;

          return {
            ...updatedCar,
            destinationId: newDestinationId,
            direction: newDirection,
            progress: newProgress,
            nextTurn: 'uturn',
            path: [...(updatedCar.path || []), nextLocationId],
            speed: 0.1,
            waitingToTurnLeft: false,
            reachedDestination: false
          };
        }

        // Update car with new destination and next street
        return {
          ...updatedCar,
          destinationId: newDestinationId,
          currentStreetId: newNextStreetInfo.street.id,
          direction: newNextStreetInfo.direction,
          progress: newNextStreetInfo.direction === 'forward' ? 0.05 : 0.95,
          nextTurn: newNextStreetInfo.turn,
          path: [...(updatedCar.path || []), nextLocationId],
          speed: Math.max(updatedCar.speed, 0.1),
          waitingToTurnLeft: false,
          reachedDestination: false,
          streetsTraveled: (updatedCar.streetsTraveled || 0) + 1,
          totalTravelTime: (updatedCar.totalTravelTime || 0) + ((Date.now() - (updatedCar.currentStreetStartTime || Date.now())) / 1000),
          currentStreetStartTime: Date.now()
        };
    }

    // Find next street to travel on using streamlined routing logic
    const nextStreetInfo = findBestNextStreet(
      nextLocationId,
      updatedCar.destinationId,
      updatedCar.currentStreetId,
      streets,
      locations,
      updatedCar.originalId || updatedCar.id // Pass original ID for twin synchronization
    );

    if (!nextStreetInfo || !nextStreetInfo.street) {
      // No valid next street, treat as dead end and make U-turn
      console.log(`Car ${updatedCar.id} found no valid next street at ${nextLocationId}, making U-turn`);

      // For a U-turn, we stay on the same street but reverse direction
      const newDirection = updatedCar.direction === 'forward' ? 'backward' : 'forward';

      // FIXED: For U-turns, set progress slightly away from the intersection
      // If car was going forward (progress = 1), start at 0.95 for backward direction
      // If car was going backward (progress = 0), start at 0.05 for forward direction
      const newProgress = updatedCar.direction === 'forward' ? 0.95 : 0.05;

      console.log(`🔄 Car ${updatedCar.id} making U-turn:`, {
        originalDirection: updatedCar.direction,
        newDirection: newDirection,
        originalProgress: updatedCar.progress,
        newProgress: newProgress,
        streetId: updatedCar.currentStreetId,
        locationId: nextLocationId
      });

      // Store this routing decision in the cache
      const routingKey = `${updatedCar.originalId || updatedCar.id}-${nextLocationId}-${updatedCar.currentStreetId}`;
      const routingDecision = {
        street: currentStreet,
        direction: newDirection,
        turn: 'uturn'
      };
      routingDecisions.set(routingKey, routingDecision);

      return {
        ...updatedCar,
        direction: newDirection,
        progress: newProgress,
        nextTurn: 'uturn',
        path: [...(updatedCar.path || []), nextLocationId],
        speed: 0.1, // Small initial speed to start movement
        waitingToTurnLeft: false,
        reachedDestination: false // Ensure the car continues its journey
      };
    }

    // Update car with new street, direction, and turn type
    console.log(`🚗 Car ${updatedCar.id} transitioning to street ${nextStreetInfo.street.id}, direction: ${nextStreetInfo.direction}, turn: ${nextStreetInfo.turn}`);
    return {
      ...updatedCar,
      currentStreetId: nextStreetInfo.street.id,
      direction: nextStreetInfo.direction,
      progress: nextStreetInfo.direction === 'forward' ? 0.05 : 0.95,
      nextTurn: nextStreetInfo.turn,
      path: [...(updatedCar.path || []), nextLocationId],
      speed: Math.max(updatedCar.speed, 0.1), // Ensure minimum speed for movement
      waitingToTurnLeft: false,
      turnSignalStartTime: null, // Reset turn signal timing
      streetsTraveled: (updatedCar.streetsTraveled || 0) + 1,
      totalTravelTime: (updatedCar.totalTravelTime || 0) + ((Date.now() - (updatedCar.currentStreetStartTime || Date.now())) / 1000),
      currentStreetStartTime: Date.now()
    };
  }

  // Car is still on the same street
  return updatedCar;
};

/**
 * Finds the car ahead on the same street
 * @param {Object} car - Current car
 * @param {Array} allCars - All cars
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {Object|null} Car ahead or null
 */
const findCarAhead = (car, allCars, streets, locations) => {
  // TODO: Use streets and locations for more sophisticated car ahead detection
  if (streets.length > 0 && locations.length > 0) {
    console.log(`Finding car ahead for ${car.id} on street ${car.currentStreetId}`);
  }

  const carsOnSameStreet = allCars.filter(otherCar =>
    otherCar.id !== car.id &&
    otherCar.currentStreetId === car.currentStreetId &&
    otherCar.direction === car.direction &&
    !otherCar.reachedDestination
  );

  let closestCar = null;
  let closestDistance = Infinity;

  carsOnSameStreet.forEach(otherCar => {
    let isAhead = false;

    if (car.direction === 'forward') {
      isAhead = otherCar.progress > car.progress;
    } else {
      isAhead = otherCar.progress < car.progress;
    }

    if (isAhead) {
      const distance = Math.abs(otherCar.progress - car.progress);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestCar = otherCar;
      }
    }
  });

  return closestCar;
};

/**
 * Generates a new destination for a car starting a new journey
 * @param {string} currentLocationId - Current location ID
 * @param {Array} locations - All locations
 * @param {Array} streets - All streets
 * @returns {string} New destination ID
 */
const generateNewDestination = (currentLocationId, locations, streets) => {
  // Find all reachable locations (excluding current location)
  // CHANGED: Now including parking lots as valid destinations
  const reachableLocations = locations.filter(loc =>
    loc.id !== currentLocationId &&
    // Check if location is reachable (has at least one connected street)
    streets.some(street => street.from === loc.id || street.to === loc.id)
  );

  if (reachableLocations.length === 0) {
    // If no reachable locations, just pick any location except current
    const otherLocations = locations.filter(loc =>
      loc.id !== currentLocationId
    );
    if (otherLocations.length > 0) {
      return otherLocations[Math.floor(Math.random() * otherLocations.length)].id;
    }
    // Fallback: return current location (car will just stay put)
    return currentLocationId;
  }

  // CRITICAL BUG FIX: Prioritize parking lots as destinations (70% chance for better continuous journeys)
  const parkingLots = reachableLocations.filter(loc => {
    const connectedStreets = streets.filter(s => s.from === loc.id || s.to === loc.id);
    return connectedStreets.length === 1; // Parking lots have exactly 1 street
  });

  if (parkingLots.length > 0 && Math.random() < 0.7) {
    const destination = parkingLots[Math.floor(Math.random() * parkingLots.length)];
    console.log(`Generated parking lot destination: ${destination.id}`);
    return destination.id;
  }

  // Otherwise pick a random reachable destination
  const destination = reachableLocations[Math.floor(Math.random() * reachableLocations.length)];
  console.log(`Generated general destination: ${destination.id}`);
  return destination.id;
};

/**
 * Calculates distance between two cars
 * @param {Object} car1 - First car
 * @param {Object} car2 - Second car
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {number} Distance in pixels
 */
const calculateDistanceBetweenCars = (car1, car2, streets, locations) => {
  const pos1 = calculateCarPosition(car1, streets, locations);
  const pos2 = calculateCarPosition(car2, streets, locations);

  if (!pos1 || !pos2) return Infinity;

  return Math.hypot(pos2.x - pos1.x, pos2.y - pos1.y);
};

/**
 * Checks for oncoming traffic when making a left turn
 * @param {Object} car - Car wanting to turn left
 * @param {Array} allCars - All cars
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {boolean} Whether there is oncoming traffic
 */
const checkForOncomingTraffic = (car, allCars, streets, locations) => {
  // TODO: Use streets and locations for more sophisticated oncoming traffic detection
  if (streets.length > 0 && locations.length > 0) {
    console.log(`Checking oncoming traffic for ${car.id}`);
  }

  // Find cars on the same street going in opposite direction
  const oncomingCars = allCars.filter(otherCar =>
    otherCar.id !== car.id &&
    otherCar.currentStreetId === car.currentStreetId &&
    otherCar.direction !== car.direction &&
    !otherCar.reachedDestination
  );

  // Check if any oncoming car is close enough to be a concern
  return oncomingCars.some(oncomingCar => {
    const distance = Math.abs(oncomingCar.progress - car.progress);
    return distance < 0.3; // Within 30% of street length
  });
};

/**
 * Simulates traffic for all cars
 * @param {Array} cars - All cars
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @param {Array} trafficLights - All traffic lights
 * @param {number} deltaTime - Time step in seconds
 * @param {boolean} isSmartControl - Whether to use smart traffic control
 * @returns {Array} Updated cars
 */
export const simulateTraffic = (cars, streets, locations, trafficLights, deltaTime, isSmartControl) => {
  // TODO: Use isSmartControl for different traffic simulation modes
  console.log(`Simulating traffic for ${cars.length} cars with smart control: ${isSmartControl}`);

  // Cap deltaTime to prevent large jumps
  const cappedDeltaTime = Math.min(deltaTime, 0.1);

  // Update each car with access to all cars for collision detection
  return cars.map(car => updateCar(car, streets, locations, trafficLights, cappedDeltaTime, cars));
};
