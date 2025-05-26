/**
 * Traffic Light Manager - Handles all traffic light operations
 */

/**
 * Creates a new traffic light
 * @param {string} locationId - Location ID where the traffic light is placed
 * @param {string} streetId - Street ID the traffic light controls
 * @param {number} angle - Angle of the street approach
 * @param {Object} position - Position of the traffic light
 * @returns {Object} New traffic light object
 */
export const createTrafficLight = (locationId, streetId, angle = 0, position = { x: 0, y: 0 }) => {
  return {
    id: `light-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    locationId,
    streetId,
    state: 'red', // Initial state
    timer: 0,
    greenDuration: 9, // Default 9 seconds green
    yellowDuration: 1, // Always 1 second yellow
    redDuration: 10, // Default 10 seconds red
    angle,
    x: position.x,
    y: position.y,
    lastStateChange: Date.now(),
    oppositeGroupId: null, // For synchronizing opposite lights
    crossingGroupId: null // For managing crossing lights
  };
};

/**
 * Creates traffic lights for an intersection
 * @param {Object} location - Intersection location
 * @param {Array} connectedStreets - Streets connected to this intersection
 * @param {Array} locations - All locations
 * @returns {Array} Array of traffic light objects
 */
export const createIntersectionTrafficLights = (location, connectedStreets, locations) => {
  if (connectedStreets.length <= 2) {
    return []; // No traffic lights needed for 2 or fewer streets
  }

  const lights = [];
  const LIGHT_DISTANCE_FROM_THE_STREET = 30; // Closer to intersection, less intrusive
  const LIGHT_DISTANCE_FROM_THE_INTERSECTION = 40; // Closer to intersection, less intrusive

  // First, create all the lights
  connectedStreets.forEach((street) => {
    // Determine which end of the street connects to this intersection
    const isFromEnd = street.from === location.id;
    const otherEndId = isFromEnd ? street.to : street.from;
    const otherLocation = locations.find(loc => loc.id === otherEndId);

    if (!otherLocation) return;

    // Calculate angle from intersection to the other end
    const angle = Math.atan2(
      otherLocation.y - location.y,
      otherLocation.x - location.x
    );

    // Position traffic light on the right side of the street approach, outside the street
    const lightAngle = angle + Math.PI / 2; // Rotate 90 degrees from street direction
    const rightSideAngle = angle - Math.PI / 2; // 90 degrees to the right

    // Position further out to avoid overlap with street/location
    const lightX = location.x - Math.sin(rightSideAngle) * LIGHT_DISTANCE_FROM_THE_INTERSECTION + Math.cos(rightSideAngle) * (LIGHT_DISTANCE_FROM_THE_STREET);
    const lightY = location.y + Math.cos(rightSideAngle) * LIGHT_DISTANCE_FROM_THE_INTERSECTION + Math.sin(rightSideAngle) * (LIGHT_DISTANCE_FROM_THE_STREET);

    // Create light with initial state (will be set properly later)
    const light = createTrafficLight(
      location.id,
      street.id,
      lightAngle * 180 / Math.PI,
      { x: lightX, y: lightY }
    );

    // Calculate normalized angle for grouping
    const normalizedAngle = ((angle * 180 / Math.PI) + 360) % 360;
    // North-South: angles around 90° (north) and 270° (south)
    // East-West: angles around 0°/360° (east) and 180° (west)
    const isNorthSouth = (normalizedAngle >= 45 && normalizedAngle <= 135) || (normalizedAngle >= 225 && normalizedAngle <= 315);

    // Store the direction for grouping, but don't set state yet
    light.oppositeGroupId = isNorthSouth ? 'north-south' : 'east-west';
    light.normalizedAngle = normalizedAngle; // Store for debugging

    lights.push(light);
  });

  // Now set up synchronization groups
  if (lights.length >= 2) {
    assignTrafficLightGroups(lights, connectedStreets, location, locations);
  }

  // IMPORTANT FIX: Ensure one group is always green initially
  // Get all unique group IDs
  const groupIds = [...new Set(lights.map(light => light.oppositeGroupId))];

  if (groupIds.length > 0) {
    // Always start with the first group as green
    const greenGroupId = groupIds[0];

    // Set states based on group
    lights.forEach(light => {
      if (light.oppositeGroupId === greenGroupId) {
        light.state = 'green';
        light.timer = Math.random() * 2; // Small random offset
      } else {
        light.state = 'red';
        light.timer = Math.random() * 2; // Small random offset
      }
    });

    console.log(`Initialized traffic lights at intersection ${location.id}: Group ${greenGroupId} is green`);
  }

  return lights;
};

/**
 * Assigns traffic lights to synchronization groups
 * @param {Array} lights - Traffic lights at an intersection
 * @param {Array} streets - Connected streets
 * @param {Object} intersection - Intersection location
 * @param {Array} locations - All locations
 */
const assignTrafficLightGroups = (lights, streets, intersection, locations) => {
  // Calculate angles for each street from the intersection
  const streetAngles = streets.map(street => {
    const otherEndId = street.from === intersection.id ? street.to : street.from;
    const otherLocation = locations.find(loc => loc.id === otherEndId);
    if (!otherLocation) return 0;

    return Math.atan2(
      otherLocation.y - intersection.y,
      otherLocation.x - intersection.x
    );
  });

  // Create all possible pairs and calculate their angle differences
  const pairs = [];
  for (let i = 0; i < streetAngles.length; i++) {
    for (let j = i + 1; j < streetAngles.length; j++) {
      const angle1 = streetAngles[i];
      const angle2 = streetAngles[j];
      const angleDiff = Math.abs(angle1 - angle2);
      // Normalize to get the smaller angle between the two directions
      const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
      // Calculate how close this pair is to being opposite (180 degrees)
      const oppositeScore = Math.abs(normalizedDiff - Math.PI);

      pairs.push({
        i, j, oppositeScore
      });
    }
  }

  // Sort pairs by how close they are to being opposite (lowest score first)
  pairs.sort((a, b) => a.oppositeScore - b.oppositeScore);

  // Group opposite streets by selecting best pairs
  const oppositeGroups = [];
  const usedIndices = new Set();

  // Take pairs in order of best oppositeScore until all streets are assigned
  for (const pair of pairs) {
    if (usedIndices.has(pair.i) || usedIndices.has(pair.j)) continue;

    // Add this pair as a group
    oppositeGroups.push([pair.i, pair.j]);
    usedIndices.add(pair.i);
    usedIndices.add(pair.j);

    // If all streets are assigned to groups, we're done
    if (usedIndices.size >= streetAngles.length) break;
  }

  // Assign group IDs
  oppositeGroups.forEach((group, groupIndex) => {
    const groupId = `opposite-${intersection.id}-${groupIndex}`;
    group.forEach(streetIndex => {
      if (streetIndex < lights.length && lights[streetIndex]) {
        lights[streetIndex].oppositeGroupId = groupId;
      }
    });
  });

  // Set crossing groups (all lights not in the same opposite group are crossing)
  lights.forEach((light, index) => {
    const crossingLights = lights.filter((otherLight, otherIndex) =>
      otherIndex !== index && otherLight.oppositeGroupId !== light.oppositeGroupId
    );

    if (crossingLights.length > 0) {
      light.crossingGroupId = `crossing-${intersection.id}-${light.oppositeGroupId}`;
    }
  });
};

/**
 * Updates a traffic light's state based on time and synchronization rules
 * @param {Object} light - Traffic light object
 * @param {number} deltaTime - Time step in seconds
 * @param {boolean} isSmartControl - Whether to use smart traffic control
 * @param {Array} cars - All cars (for smart control)
 * @param {Array} streets - All streets (for smart control)
 * @param {Array} locations - All locations (for position calculations)
 * @param {Array} allLights - All traffic lights (for synchronization)
 * @returns {Object} Updated traffic light
 */
export const updateTrafficLight = (light, deltaTime, isSmartControl, cars, streets, locations, allLights = []) => {
  // Increment timer
  light.timer += deltaTime;

  // Get all lights at this intersection
  const intersectionLights = allLights.filter(l => l.locationId === light.locationId);

  // Ensure proper grouping if not set
  if (!light.oppositeGroupId && intersectionLights.length > 0) {
    // Calculate angle from intersection center to determine direction
    const normalizedAngle = ((light.angle + 360) % 360);
    // North-South: angles around 90° (north) and 270° (south) - vertical movement
    // East-West: angles around 0°/360° (east) and 180° (west) - horizontal movement
    const isNorthSouth = (normalizedAngle >= 45 && normalizedAngle <= 135) || (normalizedAngle >= 225 && normalizedAngle <= 315);
    light.oppositeGroupId = isNorthSouth ? 'north-south' : 'east-west';

    // Debug logging for grouping
    if (Math.random() < 0.2) {
      console.log(`Assigning group to light ${light.id}: angle=${normalizedAngle.toFixed(1)}°, group=${light.oppositeGroupId}`);
    }
  }

  // New Smart control logic - runs once per second per intersection
  if (isSmartControl && cars && streets && locations) {
    // Get all lights at this intersection for coordination
    const intersectionLights = allLights.filter(l => l.locationId === light.locationId);

    // Only run smart logic once per second per intersection (not every frame)
    if (!light.lastSmartUpdate || (Date.now() - light.lastSmartUpdate) >= 1000) {
      // DEBUG: Confirm smart control is running
      if (Math.random() < 0.1) {
        console.log(`🚦 SMART CONTROL RUNNING for intersection ${light.locationId} with ${cars.length} cars`);
      }

      // Mark this intersection as updated
      intersectionLights.forEach(l => l.lastSmartUpdate = Date.now());

      // Run the new smart traffic analysis and decision logic
      const smartDecision = analyzeAndDecideSmartTraffic(light.locationId, cars, streets, locations, intersectionLights);

      // Apply the smart decision
      applySmartDecision(smartDecision, intersectionLights);
    }
  }

  // Determine cycle duration based on current state
  let cycleDuration;
  if (isSmartControl) {
    // SMART CONTROL: Only change lights when smart logic decides to
    switch (light.state) {
      case 'green':
        // For smart control, green lights stay green indefinitely until smart logic decides to switch
        cycleDuration = Infinity; // Never timeout automatically
        break;
      case 'yellow':
        cycleDuration = 0.5; // Always 0.5 yellow (safety transition)
        break;
      case 'red':
        cycleDuration = Infinity; // Stay red until smart logic decides to switch
        break;
      case 'waiting': // 0.5 second delay before turning green
        cycleDuration = 0.5;
        break;
      default:
        cycleDuration = Infinity;
    }
  } else {
    // TRADITIONAL CONTROL: Use fixed timers
    switch (light.state) {
      case 'green':
        cycleDuration = 10; // Traditional timing
        break;
      case 'yellow':
        cycleDuration = 2; // Always 2 seconds yellow
        break;
      case 'red':
        cycleDuration = 12; // Traditional red timing
        break;
      case 'waiting':
        cycleDuration = 0.5; // 0.5 second waiting period
        break;
      default:
        cycleDuration = 10;
    }
  }

  // Check if it's time to change state
  if (light.timer >= cycleDuration) {
    // Reset timer
    light.timer = 0;
    light.lastStateChange = Date.now();

    // Debug logging for traffic light state changes
    if (Math.random() < 0.1) { // Log 10% of state changes to avoid spam
      console.log(`Traffic Light ${light.id} at intersection ${light.locationId}: ${light.state} -> `, {
        group: light.oppositeGroupId,
        intersectionLights: intersectionLights.length,
        timer: light.timer.toFixed(2)
      });
    }

    // Change state with proper intersection synchronization
    switch (light.state) {
      case 'green':
        light.state = 'yellow';
        // Synchronize all lights in the same direction to yellow
        intersectionLights.forEach(otherLight => {
          if (otherLight.oppositeGroupId === light.oppositeGroupId && otherLight.id !== light.id) {
            if (otherLight.state === 'green') {
              otherLight.state = 'yellow';
              otherLight.timer = 0;
              otherLight.lastStateChange = Date.now();
            }
          }
        });
        break;

      case 'yellow':
        light.state = 'red';
        // Synchronize all lights in the same direction to red
        intersectionLights.forEach(otherLight => {
          if (otherLight.oppositeGroupId === light.oppositeGroupId && otherLight.id !== light.id) {
            if (otherLight.state === 'yellow') {
              otherLight.state = 'red';
              otherLight.timer = 0;
              otherLight.lastStateChange = Date.now();
            }
          }
        });

        // For smart control, only set the target group to waiting
        if (isSmartControl) {
          // Check if there's a pending smart switch target
          const targetGroup = light.smartSwitchTarget;
          if (targetGroup) {
            // Only set the target group to waiting
            const targetLights = intersectionLights.filter(l => l.oppositeGroupId === targetGroup);
            targetLights.forEach(targetLight => {
              if (targetLight.state === 'red') {
                targetLight.state = 'waiting';
                targetLight.timer = 0;
                targetLight.lastStateChange = Date.now();
              }
            });
            // FIXED: Only clear the target after ALL lights in this group have transitioned
            // Check if all lights in the current group have finished transitioning
            const currentGroupLights = intersectionLights.filter(l => l.oppositeGroupId === light.oppositeGroupId);
            const allCurrentGroupRed = currentGroupLights.every(l => l.state === 'red');
            if (allCurrentGroupRed) {
              // Clear the target after use
              intersectionLights.forEach(l => delete l.smartSwitchTarget);
            }
          }
        } else {
          // Traditional control: set all perpendicular lights to waiting
          const perpendicularLights = intersectionLights.filter(l => l.oppositeGroupId !== light.oppositeGroupId);
          perpendicularLights.forEach(perpendicularLight => {
            if (perpendicularLight.state === 'red') {
              perpendicularLight.state = 'waiting';
              perpendicularLight.timer = 0;
              perpendicularLight.lastStateChange = Date.now();
            }
          });
        }
        break;

      case 'waiting':
        light.state = 'green';
        // Synchronize all lights in the same direction to green
        intersectionLights.forEach(otherLight => {
          if (otherLight.oppositeGroupId === light.oppositeGroupId && otherLight.id !== light.id) {
            if (otherLight.state === 'waiting') {
              otherLight.state = 'green';
              otherLight.timer = 0;
              otherLight.lastStateChange = Date.now();
            }
          }
        });
        break;

      case 'red':
        // Don't change state here - wait for the crossing lights to trigger the waiting state
        break;

      default:
        light.state = 'red';
    }
  }

  return light;
};

/**
 * ENHANCED SMART TRAFFIC LOGIC: Analyzes and decides traffic light control for an intersection
 * This function implements the user's specified algorithm with enhancements:
 * 1. Collect data for all approaching cars (including cars that might slow down others)
 * 2. Rank cars by estimated arrival time with penalties for stopped cars and right turns
 * 3. Score streets based on car rankings (100 - rank points per car)
 * 4. Combine opposite street scores as pairs
 * 5. Make switching decisions with deadlock prevention
 *
 * @param {string} intersectionId - ID of the intersection
 * @param {Array} cars - All cars
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @param {Array} intersectionLights - Traffic lights at this intersection
 * @returns {Object} Smart traffic decision
 */
const analyzeAndDecideSmartTraffic = (intersectionId, cars, streets, locations, intersectionLights) => {
  // Safety check: ensure we have valid intersection lights
  if (!intersectionLights || intersectionLights.length === 0) {
    return { action: 'NONE', targetGroup: null, reason: 'NO_LIGHTS' };
  }

  // Step 1: Collect data for all cars approaching this intersection
  const approachingCarsData = collectApproachingCarsData(intersectionId, cars, streets, locations, intersectionLights);

  // Step 2: Rank all cars by estimated arrival time (1 = first to arrive)
  const rankedCars = rankCarsByArrivalTime(approachingCarsData);

  // Step 3: Score streets based on car rankings
  const streetScores = calculateStreetScores(rankedCars, intersectionLights);

  // Step 4: Combine opposite street scores as pairs
  const pairScores = combineOppositeStreetScores(streetScores, intersectionLights);

  // Step 5: Make switching decision based on highest scoring pair with deadlock prevention
  const decision = makeTrafficLightDecision(pairScores, intersectionLights);

  // Enhanced debug output - ALWAYS log when there are cars to debug the issue
  if (approachingCarsData.length > 0) {
    const currentGreenLights = intersectionLights.filter(l => l.state === 'green');
    const currentGreenGroup = currentGreenLights.length > 0 ? currentGreenLights[0].oppositeGroupId : 'none';

    console.log(`🚦 ENHANCED Smart Traffic Analysis for intersection ${intersectionId}:`, {
      approachingCars: approachingCarsData.length,
      currentGreenGroup,
      carDetails: rankedCars.map(car => ({
        id: car.car.id.substring(0, 8),
        street: car.streetId.substring(0, 8),
        rank: car.rank,
        arrivalTime: car.estimatedArrivalTime.toFixed(1) + 's',
        speed: car.speed.toFixed(2),
        stopped: car.isStopped,
        slowingCars: car.slowingCars.length
      })),
      streetScores,
      pairScores,
      decision: decision.action,
      targetGroup: decision.targetGroup,
      reason: decision.reason,
      shouldSwitch: decision.action === 'SWITCH'
    });
  } else {
    // Debug when no cars are detected - ALWAYS log this to debug the issue
    console.log(`🚦 ❌ NO CARS DETECTED for intersection ${intersectionId} - This might be the bug!`, {
      totalCars: cars.length,
      intersectionStreets: intersectionLights.map(l => l.streetId),
      carsOnIntersectionStreets: cars.filter(car =>
        intersectionLights.some(light => light.streetId === car.currentStreetId)
      ).map(car => ({
        id: car.id.substring(0, 8),
        street: car.currentStreetId.substring(0, 8),
        reachedDestination: car.reachedDestination,
        direction: car.direction,
        progress: car.progress.toFixed(3)
      }))
    });
  }

  return decision;
};

/**
 * Step 1: Collect data for all cars approaching the intersection
 * @param {string} intersectionId - ID of the intersection
 * @param {Array} cars - All cars
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @param {Array} intersectionLights - Traffic lights at this intersection
 * @returns {Array} Array of car data objects
 */
const collectApproachingCarsData = (intersectionId, cars, streets, locations, intersectionLights) => {
  const approachingCars = [];

  // Get all streets that connect to this intersection
  const intersectionStreets = intersectionLights.map(light => light.streetId);

  // DEBUG: Log intersection details occasionally
  if (Math.random() < 0.1) {
    console.log(`🔍 DEBUG: Collecting cars for intersection ${intersectionId}:`, {
      totalCars: cars.length,
      intersectionStreets: intersectionStreets.map(s => s.substring(0, 8)),
      lightGroups: intersectionLights.map(light => ({
        street: light.streetId.substring(0, 8),
        group: light.oppositeGroupId,
        state: light.state
      })),
      carsOnRelevantStreets: cars.filter(car =>
        !car.reachedDestination && intersectionStreets.includes(car.currentStreetId)
      ).length
    });
  }

  cars.forEach(car => {
    // Skip cars that have reached their destination
    if (car.reachedDestination) return;

    // Check if car is on a street connected to this intersection
    if (!intersectionStreets.includes(car.currentStreetId)) return;

    // Check if car is approaching this intersection (not driving away)
    const approach = isCarApproachingIntersection(car, streets, locations);

    if (!approach.approaching || approach.locationId !== intersectionId) {
      return;
    }

    // Get the street the car is on
    const street = streets.find(s => s.id === car.currentStreetId);
    if (!street) return;

    // Find cars between this car and intersection that might slow it down
    const slowingCars = findSlowingCars(car, cars, street, approach);

    // Calculate estimated time to reach traffic light decision point
    // This now considers cars ahead that might slow down this car
    let estimatedArrivalTime = calculateEnhancedEstimatedArrivalTime(car, approach, streets, locations, slowingCars);

    // Add penalties as specified by user
    // Penalty for stopped cars: +1 second to favor moving cars
    if (car.speed < 0.1) {
      estimatedArrivalTime += 1;
    }

    // Penalty for right turns: +1 second to favor straight/left turns
    if (car.nextTurn === 'right') {
      estimatedArrivalTime += 1;
    }

    // Determine intended direction of travel
    let intendedDirection = 'straight';
    if (car.nextTurn) {
      intendedDirection = car.nextTurn;
    } else if (car.speed < 0.1) {
      // For stopped cars, determine intended direction from which side of street they're on
      intendedDirection = determineIntendedDirectionFromPosition(car, street, locations);
    }

    const carData = {
      car,
      streetId: car.currentStreetId,
      speed: car.speed,
      intendedDirection,
      estimatedArrivalTime,
      distanceToIntersection: approach.distanceToIntersection,
      slowingCars,
      isStopped: car.speed < 0.1,
      timeNotMoving: car.timeNotMoving || 0
    };

    approachingCars.push(carData);
  });

  return approachingCars;
};

/**
 * Step 2: Rank cars by estimated arrival time (1 = first to arrive)
 * @param {Array} approachingCarsData - Array of car data objects
 * @returns {Array} Array of car data with ranks assigned
 */
const rankCarsByArrivalTime = (approachingCarsData) => {
  // Sort cars by estimated arrival time
  const sortedCars = [...approachingCarsData].sort((a, b) => a.estimatedArrivalTime - b.estimatedArrivalTime);

  // Assign ranks (1 = first to arrive)
  let currentRank = 1;
  for (let i = 0; i < sortedCars.length; i++) {
    if (i > 0 && sortedCars[i].estimatedArrivalTime > sortedCars[i-1].estimatedArrivalTime) {
      currentRank = i + 1; // New rank for different arrival time
    }
    sortedCars[i].rank = currentRank;
  }

  return sortedCars;
};

/**
 * Step 3: Calculate street scores based on car rankings
 * @param {Array} rankedCars - Array of ranked car data
 * @param {Array} intersectionLights - Traffic lights at this intersection
 * @returns {Object} Street scores by street ID
 */
const calculateStreetScores = (rankedCars, intersectionLights) => {
  const streetScores = {};

  // Initialize scores for all streets at this intersection
  intersectionLights.forEach(light => {
    streetScores[light.streetId] = 0;
  });

  // Calculate scores: each car contributes (100 - rank) points to its street
  rankedCars.forEach(carData => {
    const score = 100 - carData.rank;
    streetScores[carData.streetId] += score;
  });

  return streetScores;
};

/**
 * Step 4: Combine opposite street scores as pairs
 * @param {Object} streetScores - Street scores by street ID
 * @param {Array} intersectionLights - Traffic lights at this intersection
 * @returns {Object} Pair scores by group ID
 */
const combineOppositeStreetScores = (streetScores, intersectionLights) => {
  const pairScores = {};

  // Group lights by their opposite group ID
  const groupedLights = {};
  intersectionLights.forEach(light => {
    if (!groupedLights[light.oppositeGroupId]) {
      groupedLights[light.oppositeGroupId] = [];
    }
    groupedLights[light.oppositeGroupId].push(light);
  });

  // Calculate combined scores for each group (opposite street pairs)
  Object.entries(groupedLights).forEach(([groupId, lights]) => {
    let totalScore = 0;
    lights.forEach(light => {
      totalScore += streetScores[light.streetId] || 0;
    });
    pairScores[groupId] = totalScore;
  });

  return pairScores;
};

/**
 * Step 5: Make traffic light switching decision with deadlock prevention
 * @param {Object} pairScores - Pair scores by group ID
 * @param {Array} intersectionLights - Traffic lights at this intersection
 * @returns {Object} Decision object
 */
const makeTrafficLightDecision = (pairScores, intersectionLights) => {
  // Find the group with the highest score
  let highestScore = 0;
  let highestScoringGroup = null;

  Object.entries(pairScores).forEach(([groupId, score]) => {
    if (score > highestScore) {
      highestScore = score;
      highestScoringGroup = groupId;
    }
  });

  // Get current green lights and their group
  const currentGreenLights = intersectionLights.filter(l => l.state === 'green');
  const currentGreenGroup = currentGreenLights.length > 0 ? currentGreenLights[0].oppositeGroupId : null;

  // DEBUG: Log decision details
  console.log(`🚦 DECISION DEBUG:`, {
    pairScores,
    highestScore,
    highestScoringGroup,
    currentGreenGroup,
    allGroups: Object.keys(pairScores)
  });

  // DEADLOCK PREVENTION: Check for problematic states

  // 1. If all lights are red for too long, force one direction to green
  const allRed = intersectionLights.every(l => l.state === 'red');
  if (allRed) {
    const maxRedTime = Math.max(...intersectionLights.map(l => l.timer));
    if (maxRedTime > 2) { // If all red for more than 2 seconds
      // Choose the group with highest score, or first group if no scores
      const targetGroup = highestScoringGroup || intersectionLights[0]?.oppositeGroupId;
      if (targetGroup) {
        return { action: 'SWITCH', targetGroup, reason: 'DEADLOCK_PREVENTION_ALL_RED' };
      }
    }
  }

  // 2. If no cars approaching and no green lights, initialize one direction
  if ((!highestScoringGroup || highestScore === 0) && !currentGreenGroup) {
    const firstGroup = intersectionLights[0]?.oppositeGroupId;
    if (firstGroup) {
      return { action: 'SWITCH', targetGroup: firstGroup, reason: 'INITIALIZE_GREEN' };
    }
  }

  // 3. If no cars approaching but we have green lights, keep current state
  if (!highestScoringGroup || highestScore === 0) {
    return { action: 'NONE', targetGroup: currentGreenGroup, reason: 'NO_CARS_KEEP_CURRENT' };
  }

  // 4. Normal operation: check if highest scoring group already has green
  if (currentGreenGroup === highestScoringGroup) {
    // Highest scoring group already has green light - do nothing
    return { action: 'NONE', targetGroup: highestScoringGroup, reason: 'ALREADY_OPTIMAL' };
  } else {
    // Switch to the highest scoring group
    return { action: 'SWITCH', targetGroup: highestScoringGroup, reason: 'SWITCH_TO_HIGHER_SCORE' };
  }
};

/**
 * Apply the smart traffic decision
 * @param {Object} decision - Decision object from makeTrafficLightDecision
 * @param {Array} intersectionLights - Traffic lights at this intersection
 */
const applySmartDecision = (decision, intersectionLights) => {
  if (decision.action === 'SWITCH') {
    // Find current green lights
    const currentGreenLights = intersectionLights.filter(l => l.state === 'green');

    // Set the target group for the state machine to use
    intersectionLights.forEach(light => {
      light.smartSwitchTarget = decision.targetGroup;
    });

    // Change current green lights to yellow (amber) then red
    currentGreenLights.forEach(light => {
      light.state = 'yellow';
      light.timer = 0;
      light.lastStateChange = Date.now();
    });

    console.log(`🚦 ENHANCED Smart switch initiated (${decision.reason}): switching away from group ${currentGreenLights[0]?.oppositeGroupId} to group ${decision.targetGroup}`);

    // The yellow->red->waiting->green transition will be handled by the existing state machine
  } else if (decision.action === 'NONE' && decision.targetGroup) {
    // The highest scoring group already has green light - keep it green
    const targetLights = intersectionLights.filter(l => l.oppositeGroupId === decision.targetGroup);
    targetLights.forEach(light => {
      if (light.state === 'green') {
        // Reset timer to keep green light active
        light.timer = 0;
        light.lastStateChange = Date.now();
      }
    });

    if (Math.random() < 0.05) { // Debug output occasionally
      console.log(`🚦 ENHANCED Smart keep green (${decision.reason}): group ${decision.targetGroup} continues optimal`);
    }
  }
};

/**
 * Calculate enhanced estimated arrival time for a car at the intersection
 * This considers cars ahead that might slow down the current car
 * @param {Object} car - Car object
 * @param {Object} approach - Approach information
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @param {Array} slowingCars - Cars ahead that might slow down this car
 * @returns {number} Estimated arrival time in seconds
 */
const calculateEnhancedEstimatedArrivalTime = (car, approach, streets, locations, slowingCars) => {
  if (approach.distanceToIntersection <= 0) return 0;

  const street = streets.find(s => s.id === car.currentStreetId);
  if (!street) return Infinity;

  const fromLocation = locations.find(loc => loc.id === street.from);
  const toLocation = locations.find(loc => loc.id === street.to);
  if (!fromLocation || !toLocation) return Infinity;

  // Calculate actual distance in pixels
  const streetLength = Math.hypot(toLocation.x - fromLocation.x, toLocation.y - fromLocation.y);
  const distanceInPixels = approach.distanceToIntersection * streetLength;

  // Base calculation: time based on current speed
  let effectiveSpeed = Math.max(car.speed, 0.1); // Assume minimum speed if stopped
  let estimatedTime = distanceInPixels / (effectiveSpeed * 20); // Convert to seconds

  // Factor in slower cars ahead that will cause delays
  if (slowingCars.length > 0) {
    // Find the slowest car ahead
    const slowestCarSpeed = Math.min(...slowingCars.map(c => Math.max(c.speed, 0.05)));

    // If there are slower cars ahead, this car will be limited by their speed
    if (slowestCarSpeed < effectiveSpeed) {
      // Recalculate time assuming we'll be slowed down by the slowest car
      const delayedSpeed = Math.max(slowestCarSpeed, 0.05);
      estimatedTime = distanceInPixels / (delayedSpeed * 20);

      // Add additional delay for having to follow slower traffic
      estimatedTime += slowingCars.length * 0.5; // 0.5 second delay per car ahead
    }
  }

  return estimatedTime;
};

/**
 * Determine intended direction from car position on street (for stopped cars)
 * @param {Object} car - Car object
 * @param {Object} street - Street object
 * @param {Array} locations - All locations
 * @returns {string} Intended direction ('left', 'right', 'straight')
 */
const determineIntendedDirectionFromPosition = (car, street, locations) => {
  // For now, assume straight unless we have more specific data
  // This could be enhanced with lane position analysis
  // TODO: Use car, street, and locations data for more accurate direction detection
  console.log(`Determining direction for car ${car.id} on street ${street.id} with ${locations.length} locations`);
  return 'straight';
};

/**
 * Find cars between current car and intersection that might slow it down
 * @param {Object} car - Current car
 * @param {Array} allCars - All cars
 * @param {Object} street - Street object
 * @param {Object} approach - Approach information
 * @returns {Array} Array of cars that might slow down the current car
 */
const findSlowingCars = (car, allCars, street, approach) => {
  const slowingCars = [];

  // Find other cars on the same street moving in the same direction
  const carsOnSameStreet = allCars.filter(otherCar =>
    otherCar.id !== car.id &&
    otherCar.currentStreetId === car.currentStreetId &&
    otherCar.direction === car.direction &&
    !otherCar.reachedDestination
  );

  // Find cars that are between this car and the intersection
  carsOnSameStreet.forEach(otherCar => {
    const isCarBetween = car.direction === 'forward' ?
      (otherCar.progress > car.progress && otherCar.progress < 1) :
      (otherCar.progress < car.progress && otherCar.progress > 0);

    // If the other car is between this car and intersection
    if (isCarBetween) {
      // Include cars that are slower OR stopped (even if they were faster before)
      if (otherCar.speed < car.speed || otherCar.speed < 0.1) {
        slowingCars.push(otherCar);
      }
    }
  });

  // Sort by distance to intersection (closest first) to prioritize immediate obstacles
  slowingCars.sort((a, b) => {
    const aDistanceToIntersection = car.direction === 'forward' ? (1 - a.progress) : a.progress;
    const bDistanceToIntersection = car.direction === 'forward' ? (1 - b.progress) : b.progress;
    return aDistanceToIntersection - bDistanceToIntersection;
  });

  // TODO: Use street and approach data for more sophisticated analysis
  if (street && approach) {
    console.log(`Analyzed slowing cars for car ${car.id} on street ${street.id} approach ${approach.streetId || 'unknown'}`);
  }

  return slowingCars;
};

// OLD FUNCTIONS REMOVED - Using new smart traffic logic above

// OLD PROACTIVE FUNCTIONS REMOVED - Using new smart traffic logic above

/**
 * Checks if a car is approaching an intersection
 * @param {Object} car - Car object
 * @param {Array} streets - All streets
 * @param {Object} location - The intersection location
 * @returns {Object} Information about the approach
 */
const isCarApproachingIntersection = (car, streets, locations) => {
  const street = streets.find(s => s.id === car.currentStreetId);
  if (!street) return { approaching: false };

  // Determine which location the car is approaching
  const approachingLocationId = car.direction === 'forward' ? street.to : street.from;
  const approachingLocation = locations.find(loc => loc.id === approachingLocationId);
  if (!approachingLocation) return { approaching: false };

  // Get the other end of the street
  const otherEndId = car.direction === 'forward' ? street.from : street.to;
  const otherLocation = locations.find(loc => loc.id === otherEndId);
  if (!otherLocation) return { approaching: false };

  // Calculate distance to intersection as a percentage of street length
  const distanceToIntersection = car.direction === 'forward' ?
    (1 - car.progress) : car.progress;

  // Calculate actual distance in pixels
  const streetLength = Math.hypot(
    approachingLocation.x - otherLocation.x,
    approachingLocation.y - otherLocation.y
  );
  const distanceInPixels = distanceToIntersection * streetLength;

  // Location circle radius (typical value)
  const LOCATION_RADIUS = 20;

  // Determine if car has entered the intersection
  const hasEnteredIntersection = distanceInPixels < LOCATION_RADIUS;

  // Car is approaching if within 90% of street length from intersection (increased for better detection)
  const isApproaching = distanceToIntersection < 0.9;

  // DEBUG: Log car approach details occasionally for debugging
  if (Math.random() < 0.02) { // Log 2% of checks to reduce spam
    console.log(`🚗 Car ${car.id.substring(0, 8)} approach check:`, {
      street: car.currentStreetId.substring(0, 8),
      direction: car.direction,
      progress: car.progress.toFixed(3),
      approachingLocationId: approachingLocationId.substring(0, 8),
      distanceToIntersection: distanceToIntersection.toFixed(3),
      isApproaching,
      threshold: 0.9
    });
  }

  return {
    approaching: isApproaching,
    hasEnteredIntersection,
    distanceToIntersection,
    distanceInPixels,
    locationId: approachingLocationId
  };
};

/**
 * Validates traffic light states at intersections to ensure safety
 * @param {Array} lights - All traffic lights
 */
const validateIntersectionSafety = (lights) => {
  // Group lights by intersection
  const byIntersection = {};
  lights.forEach(light => {
    if (!byIntersection[light.locationId]) {
      byIntersection[light.locationId] = [];
    }
    byIntersection[light.locationId].push(light);
  });

  // Check each intersection
  Object.entries(byIntersection).forEach(([intersectionId, intersectionLights]) => {
    if (intersectionLights.length < 4) return; // Skip non-4-way intersections

    const greenLights = intersectionLights.filter(l => l.state === 'green');
    const redLights = intersectionLights.filter(l => l.state === 'red');

    // Safety check: ensure we don't have conflicting green lights
    if (greenLights.length > 2) {
      console.warn(`SAFETY VIOLATION: Intersection ${intersectionId} has ${greenLights.length} green lights!`);
      // Force all but the first two to red
      greenLights.slice(2).forEach(light => {
        light.state = 'red';
        light.timer = 0;
      });
    }

    // Check for all-red situation (should be temporary)
    if (redLights.length === intersectionLights.length) {
      const timeSinceAllRed = Math.min(...intersectionLights.map(l => l.timer));
      if (timeSinceAllRed > 3) { // If all red for more than 3 seconds
        // Turn one direction green
        const northSouthLights = intersectionLights.filter(l => l.oppositeGroupId === 'north-south');
        if (northSouthLights.length > 0) {
          northSouthLights.forEach(light => {
            light.state = 'green';
            light.timer = 0;
          });
        }
      }
    }
  });
};

/**
 * Updates all traffic lights
 * @param {Array} lights - All traffic lights
 * @param {number} deltaTime - Time step in seconds
 * @param {boolean} isSmartControl - Whether to use smart traffic control
 * @param {Array} cars - All cars (for smart control)
 * @param {Array} streets - All streets (for smart control)
 * @param {Array} locations - All locations (for position calculations)
 * @returns {Array} Updated traffic lights
 */
export const updateTrafficLights = (lights, deltaTime, isSmartControl, cars, streets, locations) => {
  const updatedLights = lights.map(light => updateTrafficLight(light, deltaTime, isSmartControl, cars, streets, locations, lights));

  // Validate intersection safety
  validateIntersectionSafety(updatedLights);

  return updatedLights;
};

/**
 * Checks if a car should stop at a traffic light
 * @param {Object} car - Car object
 * @param {Array} trafficLights - All traffic lights
 * @param {Array} streets - All streets
 * @param {Array} locations - All locations
 * @returns {boolean} Whether the car should stop
 */
export const shouldStopAtLight = (car, trafficLights, streets, locations) => {
  // Find traffic lights controlling the car's current street
  const relevantLights = trafficLights.filter(light => light.streetId === car.currentStreetId);

  // If no lights control this street, car can proceed
  if (relevantLights.length === 0) return false;

  // Get approach information
  const approach = isCarApproachingIntersection(car, streets, locations);
  if (!approach.approaching) return false;

  // Check if any relevant light is red or yellow
  return relevantLights.some(light => {
    // Only consider lights at the location the car is approaching
    if (light.locationId !== approach.locationId) return false;

    // For red lights: always stop unless already in the intersection
    if (light.state === 'red') {
      return !approach.hasEnteredIntersection;
    }

    // For yellow lights: stop only if not already in the intersection
    if (light.state === 'yellow') {
      return !approach.hasEnteredIntersection;
    }

    // For green lights: proceed
    return false;
  });
};
