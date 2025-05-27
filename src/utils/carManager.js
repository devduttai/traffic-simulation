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

  // VALIDATION: Ensure all required parameters are provided to prevent teleportation
  if (!startLocationId || !destinationId || !startStreetId || !direction) {
    console.error(`❌ Cannot create car: missing required parameters`, {
      startLocationId, destinationId, startStreetId, direction
    });
    return null;
  }

  // Random preferred speed between 1-4 car lengths per second (as per spec)
  // Doubled for faster simulation
  const preferredSpeed = Math.min((0.3 + Math.random() * 0.4) * 2, maxSpeed);

  console.log(`✅ Creating car ${id} at location ${startLocationId} -> ${destinationId} on street ${startStreetId} (${direction})`);

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
 * Calculates car position on a street with right-hand driving and smooth intersection transitions
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

  // ENHANCED: Check if car is in intersection transition for smooth curved motion
  const CURVE_TRANSITION_ZONE = 0.15; // 15% of street length for curve transition

  // Determine if we're in a curve transition zone
  const isNearIntersection = (car.direction === 'forward' && progress > (1 - CURVE_TRANSITION_ZONE)) ||
                            (car.direction === 'backward' && progress < CURVE_TRANSITION_ZONE);

  if (isNearIntersection && car.nextTurn && car.nextTurn !== 'straight' && car.nextTurn !== 'uturn') {
    // SMOOTH CURVED MOTION: Calculate curved path for turns
    const position = calculateCurvedTurnPosition(car, street, fromLocation, toLocation, progress, streets, locations);
    if (position) {
      return position;
    }
  }

  // Standard straight-line positioning
  let centerX, centerY;
  if (car.direction === 'forward') {
    // Forward: from 'from' location to 'to' location
    centerX = fromLocation.x + (toLocation.x - fromLocation.x) * progress;
    centerY = fromLocation.y + (toLocation.y - fromLocation.y) * progress;
  } else {
    // Backward: from 'to' location to 'from' location
    centerX = toLocation.x + (fromLocation.x - toLocation.x) * (1 - progress);
    centerY = toLocation.y + (fromLocation.y - toLocation.y) * (1 - progress);
  }

  // Calculate street angle
  const streetAngle = Math.atan2(toLocation.y - fromLocation.y, toLocation.x - fromLocation.x);

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

/**
 * Calculates smooth curved position for cars making turns at intersections
 * @param {Object} car - Car object
 * @param {Object} street - Current street
 * @param {Object} fromLocation - From location
 * @param {Object} toLocation - To location
 * @param {number} progress - Progress along street
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {Object|null} Curved position with smooth rotation
 */
const calculateCurvedTurnPosition = (car, street, fromLocation, toLocation, progress, streets, locations) => {
  // DISABLED: Curved turns are causing angle calculation issues
  // Return null to use standard straight-line positioning
  return null;

  /* COMMENTED OUT UNTIL ANGLE ISSUES ARE RESOLVED
  try {
    // Determine the intersection location
    const intersectionLocation = car.direction === 'forward' ? toLocation : fromLocation;

    // Find the next street for the turn
    const nextStreetInfo = findBestNextStreet(
      intersectionLocation.id,
      car.destinationId,
      car.currentStreetId,
      streets,
      locations,
      car.originalId || car.id
    );

    if (!nextStreetInfo || !nextStreetInfo.street) {
      return null;
    }

    const nextStreet = nextStreetInfo.street;
    const nextFromLocation = locations.find(loc => loc.id === nextStreet.from);
    const nextToLocation = locations.find(loc => loc.id === nextStreet.to);

    if (!nextFromLocation || !nextToLocation) {
      return null;
    }

    // Calculate curve parameters
    const CURVE_TRANSITION_ZONE = 0.15;

    // Determine curve progress (0 = start of curve, 1 = end of curve)
    let curveProgress;
    if (car.direction === 'forward') {
      curveProgress = Math.max(0, (progress - (1 - CURVE_TRANSITION_ZONE)) / CURVE_TRANSITION_ZONE);
    } else {
      curveProgress = Math.max(0, ((CURVE_TRANSITION_ZONE - progress) / CURVE_TRANSITION_ZONE));
    }

    // Current street direction
    const currentAngle = Math.atan2(toLocation.y - fromLocation.y, toLocation.x - fromLocation.x);

    // Next street direction
    const nextAngle = nextStreetInfo.direction === 'forward'
      ? Math.atan2(nextToLocation.y - nextFromLocation.y, nextToLocation.x - nextFromLocation.x)
      : Math.atan2(nextFromLocation.y - nextToLocation.y, nextToLocation.x - nextFromLocation.x);

    // Calculate smooth interpolated angle
    let angleDiff = nextAngle - currentAngle;

    // Normalize angle difference to [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Smooth curve interpolation using ease-in-out
    const smoothProgress = 0.5 - 0.5 * Math.cos(curveProgress * Math.PI);
    const interpolatedAngle = currentAngle + angleDiff * smoothProgress;

    // Calculate curved position
    const straightX = car.direction === 'forward'
      ? fromLocation.x + (toLocation.x - fromLocation.x) * progress
      : toLocation.x + (fromLocation.x - toLocation.x) * (1 - progress);
    const straightY = car.direction === 'forward'
      ? fromLocation.y + (toLocation.y - fromLocation.y) * progress
      : toLocation.y + (fromLocation.y - toLocation.y) * (1 - progress);

    // Apply curve offset towards intersection center for realistic turning
    const curveRadius = 15; // Curve radius for smooth turns
    const curveOffsetX = Math.cos(interpolatedAngle + Math.PI/2) * curveRadius * smoothProgress * 0.4;
    const curveOffsetY = Math.sin(interpolatedAngle + Math.PI/2) * curveRadius * smoothProgress * 0.4;

    // Lane offset for right-hand driving
    const laneOffset = 12;
    const perpAngle = interpolatedAngle + Math.PI / 2;
    const laneOffsetX = Math.cos(perpAngle) * laneOffset;
    const laneOffsetY = Math.sin(perpAngle) * laneOffset;

    return {
      x: straightX + curveOffsetX + laneOffsetX,
      y: straightY + curveOffsetY + laneOffsetY,
      angle: interpolatedAngle * 180 / Math.PI
    };

  } catch (error) {
    console.warn('Error calculating curved turn position:', error);
    return null;
  }
  */
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

  // ENHANCED COLLISION DETECTION: Check for cars ahead and cross-traffic
  const carAhead = findCarAhead(car, allCars, streets, locations);
  const crossTrafficAnalysis = findCrossTrafficCar(car, allCars, streets, locations);

  // Handle car following behavior with enhanced collision detection
  if (carAhead) {
    const collisionAnalysis = analyzeCarCollision(car, carAhead, streets, locations);
    const CAR_LENGTH = 28; // Updated to match actual car width from Car.jsx
    const SAFE_FOLLOWING_DISTANCE = CAR_LENGTH * 2.0; // Reduced for more realistic following
    const MINIMUM_DISTANCE = CAR_LENGTH * 1.1; // Tighter minimum distance

    if (collisionAnalysis.distance < SAFE_FOLLOWING_DISTANCE) {
      // Only slow down if we're moving toward the car ahead
      if (collisionAnalysis.car1MovingToward) {
        // Gradual speed reduction based on distance
        const speedReduction = Math.max(0, (SAFE_FOLLOWING_DISTANCE - collisionAnalysis.distance) / SAFE_FOLLOWING_DISTANCE);
        targetSpeed = Math.min(targetSpeed, carAhead.speed * (1 - speedReduction * 0.5));

        if (collisionAnalysis.distance < MINIMUM_DISTANCE) {
          targetSpeed = 0; // Stop if too close to prevent overlap
          shouldStop = true;
        }
      }
    }
  }

  // ENHANCED: Handle cross-traffic collision avoidance with smart deadlock prevention
  let crossTrafficBlocking = false;
  if (crossTrafficAnalysis && crossTrafficAnalysis.shouldStop) {
    // Only stop if we're moving toward the collision and it's necessary
    if (crossTrafficAnalysis.analysis.car1MovingToward) {
      targetSpeed = 0;
      shouldStop = true;
      crossTrafficBlocking = true;
      console.log(`🚨 Car ${car.id} stopping for cross-traffic car ${crossTrafficAnalysis.car.id} (priority: ${crossTrafficAnalysis.priority})`);
    } else {
      console.log(`🚗 Car ${car.id} continuing - moving away from cross-traffic car ${crossTrafficAnalysis.car.id}`);
    }
  }

  // DEADLOCK DETECTION AND RESOLUTION: Check if car is stuck and resolve deadlocks
  if (shouldStop || car.speed < 0.01) {
    const deadlockAnalysis = detectAndResolveDeadlock(car, allCars, streets, locations);

    // Debug deadlock detection occasionally
    if (deadlockAnalysis.hasDeadlock && Math.random() < 0.1) {
      console.log(`🔍 DEADLOCK DETECTED: Car ${car.id}`, {
        timeNotMoving: (car.timeNotMoving || 0).toFixed(1),
        shouldProceed: deadlockAnalysis.shouldProceed,
        reason: deadlockAnalysis.reason,
        blockedBy: deadlockAnalysis.blockedBy
      });
    }

    if (deadlockAnalysis.hasDeadlock && deadlockAnalysis.shouldProceed) {
      // Override collision avoidance to break deadlock
      targetSpeed = car.preferredSpeed || car.maxSpeed;
      shouldStop = false;
      crossTrafficBlocking = false;
      console.log(`🔓 DEADLOCK OVERRIDE: Car ${car.id} proceeding despite collision risk - ${deadlockAnalysis.reason}`);
    }
  }

  // Check for traffic lights
  const relevantLights = trafficLights.filter(light => {
    // A light is relevant if it controls this street and is at the end the car is approaching
    const isAtEnd = (car.direction === 'forward' && light.locationId === currentStreet.to) ||
                   (car.direction === 'backward' && light.locationId === currentStreet.from);
    return light.streetId === car.currentStreetId && isAtEnd;
  });

  // ENHANCED: Check if car should stop for traffic lights with improved intersection logic
  // But allow deadlock override to supersede traffic lights when cross-traffic is blocking
  const shouldStopForLight = !crossTrafficBlocking && relevantLights.some(light => {
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

    // ENHANCED: Once in intersection, continue through regardless of light changes
    if (hasEnteredIntersection) {
      return false; // Never stop once in intersection
    }

    // ENHANCED: Improved stopping logic - stop closer to intersection
    const DECELERATION_ZONE = 0.3; // Reduced from 0.4 to 0.3 for closer stopping
    const STOP_LINE_DISTANCE = (LOCATION_RADIUS * 0.8) / streetLength; // Stop closer to intersection edge

    // For red lights: stop at intersection edge
    if (light.state === 'red' && distanceToIntersection < DECELERATION_ZONE) {
      // Stop if we're not too close to the intersection edge
      if (distanceToIntersection > STOP_LINE_DISTANCE) {
        return true;
      }
    }

    // For yellow lights: stop only if safe to do so and not too close to intersection
    if (light.state === 'yellow' && distanceToIntersection < DECELERATION_ZONE) {
      // Only stop if we have enough distance to stop safely
      if (distanceToIntersection > STOP_LINE_DISTANCE * 1.5) {
        return true;
      }
    }

    // ENHANCED: Left turn yielding logic
    if (light.state === 'green' && car.nextTurn === 'left' && distanceToIntersection < 0.2) {
      // Check for oncoming traffic with predictive judgment
      const hasOncomingTraffic = checkForOncomingTrafficAdvanced(car, allCars, streets, locations);
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

  // ENHANCED: Turn signal timing - start at halfway point of street for early indication
  const distanceToEnd = updatedCar.direction === 'forward' ? (1 - updatedCar.progress) : updatedCar.progress;
  const progressFromStart = updatedCar.direction === 'forward' ? updatedCar.progress : (1 - updatedCar.progress);

  // Start turn signals when car reaches halfway point of the street (if we have a planned turn)
  if (progressFromStart >= 0.5 && updatedCar.nextTurn && updatedCar.nextTurn !== 'straight' && updatedCar.nextTurn !== 'uturn') {
    if (!updatedCar.turnSignalStartTime) {
      updatedCar.turnSignalStartTime = Date.now();
      console.log(`Car ${updatedCar.id} started turn signal for ${updatedCar.nextTurn} turn at halfway point`);
    }
  }

  // CRITICAL FIX: Only process end-of-street logic if car is actually moving
  // This prevents collision-stopped cars from being teleported
  const isActuallyAtEnd = (updatedCar.progress >= 1 && updatedCar.direction === 'forward') ||
                         (updatedCar.progress <= 0 && updatedCar.direction === 'backward');

  const isMoving = updatedCar.speed > 0.01; // Car must be moving to be considered at end
  const isStoppedForCollision = shouldStop && (crossTrafficAnalysis || carAhead); // Check if stopped for collision

  // Only process end-of-street if car is moving AND not stopped for collision avoidance
  if (isActuallyAtEnd && isMoving && !isStoppedForCollision) {

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

          // FIXED: Smooth exit from parking lot to prevent teleportation
          // Determine direction to exit parking lot (opposite of how we entered)
          const exitDirection = exitStreet.from === nextLocationId ? 'forward' : 'backward';

          console.log(`🚗 Car ${updatedCar.id} smoothly exiting parking lot ${nextLocationId} via street ${exitStreet.id} in direction ${exitDirection}`);

          // Update car to smoothly exit parking lot
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

        // CRITICAL: Only move to new street if car is actually moving
        // This prevents teleportation of stopped cars
        console.log(`🚗 Car ${updatedCar.id} transitioning to new street ${newNextStreetInfo.street.id} after reaching destination (speed: ${updatedCar.speed})`);
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
      // FIXED: Prevent car teleportation by being more conservative
      console.log(`🚨 Car ${updatedCar.id} found no valid next street at ${nextLocationId}`);
      console.log(`Available streets at location:`, connectedStreets.map(s => s.id));
      console.log(`Current street: ${updatedCar.currentStreetId}, Destination: ${updatedCar.destinationId}`);

      // Check if we have any streets at all at this location
      if (connectedStreets.length === 0) {
        console.log(`❌ No streets at location ${nextLocationId}, marking car as reached destination`);
        return { ...updatedCar, reachedDestination: true };
      }

      // CONSERVATIVE APPROACH: Only do U-turn on current street to prevent teleportation
      // Do NOT move car to a different street as this causes the teleportation issue
      const newDirection = updatedCar.direction === 'forward' ? 'backward' : 'forward';
      const newProgress = updatedCar.direction === 'forward' ? 0.95 : 0.05;

      console.log(`🔄 Conservative U-turn on current street ${updatedCar.currentStreetId} to prevent teleportation`);

      return {
        ...updatedCar,
        direction: newDirection,
        progress: newProgress,
        nextTurn: 'uturn',
        path: [...(updatedCar.path || []), nextLocationId],
        speed: 0.1,
        waitingToTurnLeft: false,
        reachedDestination: false
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
 * Calculates distance between two cars using center points
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
 * Enhanced collision detection using car boundaries instead of center points
 * @param {Object} car1 - First car
 * @param {Object} car2 - Second car
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {Object} Collision analysis with distance, isColliding, and movement direction
 */
const analyzeCarCollision = (car1, car2, streets, locations) => {
  const pos1 = calculateCarPosition(car1, streets, locations);
  const pos2 = calculateCarPosition(car2, streets, locations);

  if (!pos1 || !pos2) return { distance: Infinity, isColliding: false, car1MovingToward: false, car2MovingToward: false };

  // Car dimensions (matching Car.jsx)
  const CAR_WIDTH = 28;
  const CAR_HEIGHT = 14;
  const SAFETY_MARGIN = 5; // Reduced safety margin for more realistic collision detection

  // Calculate car boundaries (simplified rectangular collision detection)
  const car1Bounds = getCarBounds(pos1, CAR_WIDTH, CAR_HEIGHT);
  const car2Bounds = getCarBounds(pos2, CAR_WIDTH, CAR_HEIGHT);

  // Check for actual collision
  const isColliding = checkBoundsCollision(car1Bounds, car2Bounds, SAFETY_MARGIN);

  // Calculate center-to-center distance for reference
  const centerDistance = Math.hypot(pos2.x - pos1.x, pos2.y - pos1.y);

  // Analyze movement direction relative to collision point
  const car1MovingToward = isCarMovingTowardPoint(car1, pos2, streets, locations);
  const car2MovingToward = isCarMovingTowardPoint(car2, pos1, streets, locations);

  return {
    distance: centerDistance,
    isColliding,
    car1MovingToward,
    car2MovingToward,
    car1Bounds,
    car2Bounds
  };
};

/**
 * Gets car boundary rectangle
 * @param {Object} position - Car position with x, y, angle
 * @param {number} width - Car width
 * @param {number} height - Car height
 * @returns {Object} Bounds with min/max x/y coordinates
 */
const getCarBounds = (position, width, height) => {
  const { x, y, angle } = position;
  const angleRad = angle * Math.PI / 180;

  // Calculate car corners relative to center
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ];

  // Rotate corners based on car angle
  const rotatedCorners = corners.map(corner => ({
    x: x + corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad),
    y: y + corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad)
  }));

  // Find bounding box
  const xs = rotatedCorners.map(c => c.x);
  const ys = rotatedCorners.map(c => c.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
};

/**
 * Checks if two bounding boxes collide with safety margin
 * @param {Object} bounds1 - First car bounds
 * @param {Object} bounds2 - Second car bounds
 * @param {number} margin - Safety margin in pixels
 * @returns {boolean} Whether collision is detected
 */
const checkBoundsCollision = (bounds1, bounds2, margin) => {
  return !(bounds1.maxX + margin < bounds2.minX ||
           bounds2.maxX + margin < bounds1.minX ||
           bounds1.maxY + margin < bounds2.minY ||
           bounds2.maxY + margin < bounds1.minY);
};

/**
 * Determines if a car is moving toward a specific point
 * @param {Object} car - Car object
 * @param {Object} targetPoint - Point with x, y coordinates
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {boolean} Whether car is moving toward the point
 */
const isCarMovingTowardPoint = (car, targetPoint, streets, locations) => {
  if (car.speed < 0.01) return false; // Stopped cars aren't moving toward anything

  const currentPos = calculateCarPosition(car, streets, locations);
  if (!currentPos) return false;

  // Calculate car's movement vector based on its direction and street
  const currentStreet = streets.find(s => s.id === car.currentStreetId);
  if (!currentStreet) return false;

  const fromLocation = locations.find(loc => loc.id === currentStreet.from);
  const toLocation = locations.find(loc => loc.id === currentStreet.to);
  if (!fromLocation || !toLocation) return false;

  // Calculate movement direction vector
  let movementVector;
  if (car.direction === 'forward') {
    movementVector = {
      x: toLocation.x - fromLocation.x,
      y: toLocation.y - fromLocation.y
    };
  } else {
    movementVector = {
      x: fromLocation.x - toLocation.x,
      y: fromLocation.y - toLocation.y
    };
  }

  // Normalize movement vector
  const movementMagnitude = Math.hypot(movementVector.x, movementVector.y);
  if (movementMagnitude === 0) return false;

  movementVector.x /= movementMagnitude;
  movementVector.y /= movementMagnitude;

  // Calculate vector from car to target point
  const toTargetVector = {
    x: targetPoint.x - currentPos.x,
    y: targetPoint.y - currentPos.y
  };

  // Normalize to-target vector
  const toTargetMagnitude = Math.hypot(toTargetVector.x, toTargetVector.y);
  if (toTargetMagnitude === 0) return false;

  toTargetVector.x /= toTargetMagnitude;
  toTargetVector.y /= toTargetMagnitude;

  // Calculate dot product to determine if moving toward target
  const dotProduct = movementVector.x * toTargetVector.x + movementVector.y * toTargetVector.y;

  // If dot product > 0.5, car is moving toward the target (within ~60 degrees)
  return dotProduct > 0.5;
};

/**
 * ENHANCED: Finds cars that might cross the current car's path at intersections with smart collision analysis
 * @param {Object} car - Current car
 * @param {Array} allCars - All cars
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {Object|null} Cross-traffic car analysis or null
 */
const findCrossTrafficCar = (car, allCars, streets, locations) => {
  // Only check for cross-traffic when approaching an intersection
  const currentStreet = streets.find(s => s.id === car.currentStreetId);
  if (!currentStreet) return null;

  // Calculate distance to intersection
  const distanceToIntersection = car.direction === 'forward' ? (1 - car.progress) : car.progress;

  // Only check when very close to intersection to reduce false positives
  if (distanceToIntersection > 0.25) return null;

  // Find the intersection location
  const intersectionLocationId = car.direction === 'forward' ? currentStreet.to : currentStreet.from;

  // Find all streets connected to this intersection
  const intersectionStreets = streets.filter(s =>
    s.from === intersectionLocationId || s.to === intersectionLocationId
  );

  let mostCriticalCollision = null;
  let highestPriority = 0;

  // Check for cars on perpendicular streets that might cross our path
  for (const otherCar of allCars) {
    if (otherCar.id === car.id || otherCar.reachedDestination) continue;

    // Check if the other car is on a different street connected to the same intersection
    const otherStreet = streets.find(s => s.id === otherCar.currentStreetId);
    if (!otherStreet) continue;

    const isOnIntersectionStreet = intersectionStreets.some(s => s.id === otherCar.currentStreetId);
    if (!isOnIntersectionStreet || otherCar.currentStreetId === car.currentStreetId) continue;

    // Check if the other car is also approaching the same intersection
    const otherIntersectionLocationId = otherCar.direction === 'forward' ? otherStreet.to : otherStreet.from;
    if (otherIntersectionLocationId !== intersectionLocationId) continue;

    // Calculate other car's distance to intersection
    const otherDistanceToIntersection = otherCar.direction === 'forward' ? (1 - otherCar.progress) : otherCar.progress;

    // Enhanced collision analysis using new boundary detection
    const collisionAnalysis = analyzeCarCollision(car, otherCar, streets, locations);

    // Check if both cars will arrive at intersection around the same time
    const COLLISION_TIME_WINDOW = 0.3; // Reduced for more precise collision detection
    const bothApproaching = distanceToIntersection < COLLISION_TIME_WINDOW &&
                           otherDistanceToIntersection < COLLISION_TIME_WINDOW;

    if (bothApproaching && collisionAnalysis.isColliding) {
      // Calculate priority based on movement direction and right-of-way
      let priority = 1;

      // Higher priority if other car is moving toward us
      if (collisionAnalysis.car2MovingToward) priority += 3;

      // Lower priority if we're moving away from collision
      if (!collisionAnalysis.car1MovingToward) priority -= 2;

      // Consider speed - faster cars get higher priority for deadlock resolution
      if (otherCar.speed > car.speed) priority += 1;

      // Consider distance - closer cars get higher priority
      const distanceFactor = Math.max(0, 1 - collisionAnalysis.distance / 100);
      priority += distanceFactor;

      // Debug collision detection occasionally
      if (Math.random() < 0.05) { // 5% chance to log
        console.log(`🔍 COLLISION ANALYSIS: Car ${car.id} vs Car ${otherCar.id}`, {
          distance: collisionAnalysis.distance.toFixed(1),
          car1MovingToward: collisionAnalysis.car1MovingToward,
          car2MovingToward: collisionAnalysis.car2MovingToward,
          priority: priority.toFixed(2),
          bothApproaching,
          car1Speed: car.speed.toFixed(2),
          car2Speed: otherCar.speed.toFixed(2)
        });
      }

      if (priority > highestPriority) {
        highestPriority = priority;
        mostCriticalCollision = {
          car: otherCar,
          analysis: collisionAnalysis,
          priority,
          shouldStop: collisionAnalysis.car1MovingToward && collisionAnalysis.car2MovingToward
        };
      }
    }
  }

  return mostCriticalCollision;
};

/**
 * Detects and resolves deadlock situations between cars
 * @param {Object} car - Current car
 * @param {Array} allCars - All cars
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {Object} Deadlock resolution decision
 */
const detectAndResolveDeadlock = (car, allCars, streets, locations) => {
  // Only check for deadlock if car has been stopped for a while
  const timeNotMoving = car.timeNotMoving || 0;
  if (timeNotMoving < 3) { // Wait 3 seconds before considering deadlock
    return { hasDeadlock: false, shouldProceed: false };
  }

  // Find cars that might be in deadlock with this car
  const nearbyStoppedCars = allCars.filter(otherCar => {
    if (otherCar.id === car.id || otherCar.reachedDestination) return false;
    if (otherCar.speed > 0.01) return false; // Other car is moving
    if ((otherCar.timeNotMoving || 0) < 2) return false; // Other car hasn't been stopped long enough

    // Check if cars are close enough to be in potential deadlock
    const distance = calculateDistanceBetweenCars(car, otherCar, streets, locations);
    return distance < 80; // Within 80 pixels
  });

  if (nearbyStoppedCars.length === 0) {
    return { hasDeadlock: false, shouldProceed: false };
  }

  // Analyze each potential deadlock situation
  for (const otherCar of nearbyStoppedCars) {
    const collisionAnalysis = analyzeCarCollision(car, otherCar, streets, locations);

    // Check if this is a true deadlock (both cars stopped, facing each other)
    if (collisionAnalysis.isColliding) {
      // Determine which car should proceed based on priority rules
      const carPriority = calculateDeadlockPriority(car, streets, locations);
      const otherCarPriority = calculateDeadlockPriority(otherCar, streets, locations);

      // If this car has higher priority, it should proceed
      if (carPriority > otherCarPriority) {
        console.log(`🚨 DEADLOCK RESOLVED: Car ${car.id} proceeding (priority ${carPriority} vs ${otherCarPriority})`);
        return {
          hasDeadlock: true,
          shouldProceed: true,
          reason: `Higher priority (${carPriority} vs ${otherCarPriority})`,
          blockedBy: otherCar.id
        };
      }

      // If other car has higher priority, this car should wait
      if (otherCarPriority > carPriority) {
        return {
          hasDeadlock: true,
          shouldProceed: false,
          reason: `Lower priority (${carPriority} vs ${otherCarPriority})`,
          blockedBy: otherCar.id
        };
      }

      // If priorities are equal, use car ID as tiebreaker (deterministic)
      const shouldProceed = car.id < otherCar.id;
      console.log(`🚨 DEADLOCK RESOLVED: Car ${car.id} ${shouldProceed ? 'proceeding' : 'waiting'} (ID tiebreaker)`);
      return {
        hasDeadlock: true,
        shouldProceed,
        reason: `ID tiebreaker (${car.id} vs ${otherCar.id})`,
        blockedBy: otherCar.id
      };
    }
  }

  return { hasDeadlock: false, shouldProceed: false };
};

/**
 * Calculates priority for deadlock resolution
 * @param {Object} car - Car to calculate priority for
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {number} Priority score (higher = more priority)
 */
const calculateDeadlockPriority = (car, streets, locations) => {
  let priority = 0;

  // Base priority from car speed (faster cars get slight priority)
  priority += car.speed * 10;

  // Priority based on progress (cars closer to intersection get priority)
  const currentStreet = streets.find(s => s.id === car.currentStreetId);
  if (currentStreet) {
    const distanceToIntersection = car.direction === 'forward' ? (1 - car.progress) : car.progress;
    priority += (1 - distanceToIntersection) * 5; // Closer to intersection = higher priority
  }

  // Priority based on turn type (straight > right > left for traffic flow)
  switch (car.nextTurn) {
    case 'straight': priority += 3; break;
    case 'right': priority += 2; break;
    case 'left': priority += 1; break;
    case 'uturn': priority += 0; break;
    default: priority += 1; break;
  }

  // Small random factor to prevent infinite ties
  priority += Math.random() * 0.1;

  return priority;
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
 * ENHANCED: Advanced oncoming traffic check with predictive judgment for left turns
 * @param {Object} car - Car wanting to turn left
 * @param {Array} allCars - All cars
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {boolean} Whether there is oncoming traffic that requires yielding
 */
const checkForOncomingTrafficAdvanced = (car, allCars, streets, locations) => {
  // Find cars on the same street going in opposite direction
  const oncomingCars = allCars.filter(otherCar =>
    otherCar.id !== car.id &&
    otherCar.currentStreetId === car.currentStreetId &&
    otherCar.direction !== car.direction &&
    !otherCar.reachedDestination
  );

  // Check each oncoming car with predictive judgment
  return oncomingCars.some(oncomingCar => {
    const distance = Math.abs(oncomingCar.progress - car.progress);

    // If oncoming car is going straight or turning right, they have right of way
    if (oncomingCar.nextTurn === 'straight' || oncomingCar.nextTurn === 'right' || !oncomingCar.nextTurn) {
      // Use predictive judgment: consider speed and distance
      const timeToIntersection = distance / (oncomingCar.speed || 0.1);
      const SAFE_GAP_TIME = 3.0; // 3 seconds safe gap

      return timeToIntersection < SAFE_GAP_TIME && distance < 0.5;
    }

    // If both cars are turning left, they can proceed simultaneously (no yield needed)
    if (oncomingCar.nextTurn === 'left') {
      return false;
    }

    // Default: yield if car is close
    return distance < 0.3;
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
