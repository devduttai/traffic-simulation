/**
 * Test scenarios for traffic simulation
 * These scenarios help verify that smart traffic lights work better than traditional ones
 */

/**
 * Creates a simple 4-way intersection test scenario
 * @returns {Object} Test scenario with locations and streets
 */
export const createSimpleIntersectionScenario = () => {
  const locations = [
    // Main intersection
    { id: 'center', name: 'Main Intersection', x: 500, y: 500, type: 'intersection' },

    // North-South road
    { id: 'north', name: 'North End', x: 500, y: 300, type: 'intersection' },
    { id: 'south', name: 'South End', x: 500, y: 700, type: 'intersection' },

    // East-West road
    { id: 'east', name: 'East End', x: 700, y: 500, type: 'intersection' },
    { id: 'west', name: 'West End', x: 300, y: 500, type: 'intersection' },

    // Parking lots for car generation
    { id: 'parking-north', name: 'North Parking', x: 500, y: 200, type: 'parking' },
    { id: 'parking-south', name: 'South Parking', x: 500, y: 800, type: 'parking' },
    { id: 'parking-east', name: 'East Parking', x: 800, y: 500, type: 'parking' },
    { id: 'parking-west', name: 'West Parking', x: 200, y: 500, type: 'parking' }
  ];

  const streets = [
    // North-South streets
    { id: 'street-north-center', name: 'North to Center', from: 'north', to: 'center' },
    { id: 'street-center-south', name: 'Center to South', from: 'center', to: 'south' },

    // East-West streets
    { id: 'street-east-center', name: 'East to Center', from: 'east', to: 'center' },
    { id: 'street-center-west', name: 'Center to West', from: 'center', to: 'west' },

    // Parking lot connections
    { id: 'street-parking-north', name: 'Parking North', from: 'parking-north', to: 'north' },
    { id: 'street-parking-south', name: 'Parking South', from: 'parking-south', to: 'south' },
    { id: 'street-parking-east', name: 'Parking East', from: 'parking-east', to: 'east' },
    { id: 'street-parking-west', name: 'Parking West', from: 'parking-west', to: 'west' }
  ];

  return { locations, streets };
};

/**
 * Creates a heavy traffic test scenario with multiple intersections
 * @returns {Object} Test scenario with locations and streets
 */
export const createHeavyTrafficScenario = () => {
  const locations = [
    // Main grid intersections
    { id: 'center', name: 'Main Intersection', x: 500, y: 500, type: 'intersection' },
    { id: 'north-center', name: 'North Center', x: 500, y: 300, type: 'intersection' },
    { id: 'south-center', name: 'South Center', x: 500, y: 700, type: 'intersection' },
    { id: 'east-center', name: 'East Center', x: 700, y: 500, type: 'intersection' },
    { id: 'west-center', name: 'West Center', x: 300, y: 500, type: 'intersection' },

    // Corner intersections
    { id: 'northeast', name: 'Northeast', x: 700, y: 300, type: 'intersection' },
    { id: 'northwest', name: 'Northwest', x: 300, y: 300, type: 'intersection' },
    { id: 'southeast', name: 'Southeast', x: 700, y: 700, type: 'intersection' },
    { id: 'southwest', name: 'Southwest', x: 300, y: 700, type: 'intersection' },

    // Multiple parking lots for heavy traffic generation
    { id: 'parking-n1', name: 'North Parking 1', x: 400, y: 150, type: 'parking' },
    { id: 'parking-n2', name: 'North Parking 2', x: 600, y: 150, type: 'parking' },
    { id: 'parking-s1', name: 'South Parking 1', x: 400, y: 850, type: 'parking' },
    { id: 'parking-s2', name: 'South Parking 2', x: 600, y: 850, type: 'parking' },
    { id: 'parking-e1', name: 'East Parking 1', x: 850, y: 400, type: 'parking' },
    { id: 'parking-e2', name: 'East Parking 2', x: 850, y: 600, type: 'parking' },
    { id: 'parking-w1', name: 'West Parking 1', x: 150, y: 400, type: 'parking' },
    { id: 'parking-w2', name: 'West Parking 2', x: 150, y: 600, type: 'parking' }
  ];

  const streets = [
    // Main grid streets
    { id: 'center-north', name: 'Center to North', from: 'center', to: 'north-center' },
    { id: 'center-south', name: 'Center to South', from: 'center', to: 'south-center' },
    { id: 'center-east', name: 'Center to East', from: 'center', to: 'east-center' },
    { id: 'center-west', name: 'Center to West', from: 'center', to: 'west-center' },

    // Cross connections
    { id: 'north-northeast', name: 'North to Northeast', from: 'north-center', to: 'northeast' },
    { id: 'north-northwest', name: 'North to Northwest', from: 'north-center', to: 'northwest' },
    { id: 'south-southeast', name: 'South to Southeast', from: 'south-center', to: 'southeast' },
    { id: 'south-southwest', name: 'South to Southwest', from: 'south-center', to: 'southwest' },
    { id: 'east-northeast', name: 'East to Northeast', from: 'east-center', to: 'northeast' },
    { id: 'east-southeast', name: 'East to Southeast', from: 'east-center', to: 'southeast' },
    { id: 'west-northwest', name: 'West to Northwest', from: 'west-center', to: 'northwest' },
    { id: 'west-southwest', name: 'West to Southwest', from: 'west-center', to: 'southwest' },

    // Parking connections
    { id: 'parking-n1-nw', name: 'North Parking 1', from: 'parking-n1', to: 'northwest' },
    { id: 'parking-n2-ne', name: 'North Parking 2', from: 'parking-n2', to: 'northeast' },
    { id: 'parking-s1-sw', name: 'South Parking 1', from: 'parking-s1', to: 'southwest' },
    { id: 'parking-s2-se', name: 'South Parking 2', from: 'parking-s2', to: 'southeast' },
    { id: 'parking-e1-ne', name: 'East Parking 1', from: 'parking-e1', to: 'northeast' },
    { id: 'parking-e2-se', name: 'East Parking 2', from: 'parking-e2', to: 'southeast' },
    { id: 'parking-w1-nw', name: 'West Parking 1', from: 'parking-w1', to: 'northwest' },
    { id: 'parking-w2-sw', name: 'West Parking 2', from: 'parking-w2', to: 'southwest' }
  ];

  return { locations, streets };
};

/**
 * Creates an unbalanced traffic scenario to test smart light prioritization
 * @returns {Object} Test scenario with locations and streets
 */
export const createUnbalancedTrafficScenario = () => {
  const locations = [
    // Main intersection
    { id: 'center', name: 'Main Intersection', x: 500, y: 500, type: 'intersection' },

    // Heavy traffic direction (North-South)
    { id: 'north', name: 'North End', x: 500, y: 300, type: 'intersection' },
    { id: 'south', name: 'South End', x: 500, y: 700, type: 'intersection' },

    // Light traffic direction (East-West)
    { id: 'east', name: 'East End', x: 700, y: 500, type: 'intersection' },
    { id: 'west', name: 'West End', x: 300, y: 500, type: 'intersection' },

    // Heavy traffic parking lots (North-South)
    { id: 'heavy-north-1', name: 'Heavy North 1', x: 450, y: 200, type: 'parking' },
    { id: 'heavy-north-2', name: 'Heavy North 2', x: 550, y: 200, type: 'parking' },
    { id: 'heavy-south-1', name: 'Heavy South 1', x: 450, y: 800, type: 'parking' },
    { id: 'heavy-south-2', name: 'Heavy South 2', x: 550, y: 800, type: 'parking' },

    // Light traffic parking lots (East-West)
    { id: 'light-east', name: 'Light East', x: 800, y: 500, type: 'parking' },
    { id: 'light-west', name: 'Light West', x: 200, y: 500, type: 'parking' }
  ];

  const streets = [
    // Main intersection connections
    { id: 'north-center', name: 'North to Center', from: 'north', to: 'center' },
    { id: 'center-south', name: 'Center to South', from: 'center', to: 'south' },
    { id: 'east-center', name: 'East to Center', from: 'east', to: 'center' },
    { id: 'center-west', name: 'Center to West', from: 'center', to: 'west' },

    // Heavy traffic connections
    { id: 'heavy-north-1-north', name: 'Heavy North 1', from: 'heavy-north-1', to: 'north' },
    { id: 'heavy-north-2-north', name: 'Heavy North 2', from: 'heavy-north-2', to: 'north' },
    { id: 'heavy-south-1-south', name: 'Heavy South 1', from: 'heavy-south-1', to: 'south' },
    { id: 'heavy-south-2-south', name: 'Heavy South 2', from: 'heavy-south-2', to: 'south' },

    // Light traffic connections
    { id: 'light-east-east', name: 'Light East', from: 'light-east', to: 'east' },
    { id: 'light-west-west', name: 'Light West', from: 'light-west', to: 'west' }
  ];

  return { locations, streets };
};

/**
 * Creates a specific test scenario for the 4-cars-from-one-direction issue
 * @returns {Object} Test scenario with locations and streets
 */
export const createFourCarsOneDirectionScenario = () => {
  const locations = [
    // Main intersection
    { id: 'center', name: 'Main Intersection', x: 500, y: 500, type: 'intersection' },

    // Four directions
    { id: 'north', name: 'North End', x: 500, y: 300, type: 'intersection' },
    { id: 'south', name: 'South End', x: 500, y: 700, type: 'intersection' },
    { id: 'east', name: 'East End', x: 700, y: 500, type: 'intersection' },
    { id: 'west', name: 'West End', x: 300, y: 500, type: 'intersection' },

    // Heavy traffic from north only
    { id: 'heavy-north', name: 'Heavy North Traffic', x: 500, y: 150, type: 'parking' },

    // Light/no traffic from other directions
    { id: 'light-south', name: 'Light South', x: 500, y: 850, type: 'parking' },
    { id: 'light-east', name: 'Light East', x: 850, y: 500, type: 'parking' },
    { id: 'light-west', name: 'Light West', x: 150, y: 500, type: 'parking' }
  ];

  const streets = [
    // Main intersection connections
    { id: 'north-center', name: 'North to Center', from: 'north', to: 'center' },
    { id: 'center-south', name: 'Center to South', from: 'center', to: 'south' },
    { id: 'east-center', name: 'East to Center', from: 'east', to: 'center' },
    { id: 'center-west', name: 'Center to West', from: 'center', to: 'west' },

    // Heavy traffic connection (north)
    { id: 'heavy-north-north', name: 'Heavy North Traffic', from: 'heavy-north', to: 'north' },

    // Light traffic connections (minimal)
    { id: 'light-south-south', name: 'Light South', from: 'light-south', to: 'south' },
    { id: 'light-east-east', name: 'Light East', from: 'light-east', to: 'east' },
    { id: 'light-west-west', name: 'Light West', from: 'light-west', to: 'west' }
  ];

  return { locations, streets };
};

/**
 * Applies a test scenario to the simulation
 * @param {Function} setLocations - Function to set locations
 * @param {Function} setStreets - Function to set streets
 * @param {Object} scenario - Scenario object with locations and streets
 */
export const applyTestScenario = (setLocations, setStreets, scenario) => {
  setLocations(scenario.locations);
  setStreets(scenario.streets);
  console.log(`Applied test scenario with ${scenario.locations.length} locations and ${scenario.streets.length} streets`);
};
