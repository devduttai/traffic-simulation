/**
 * Calculates the distance between two points
 * @param {Object} point1 - First point with x, y coordinates
 * @param {Object} point2 - Second point with x, y coordinates
 * @returns {number} Distance between the points
 */
export const calculateDistance = (point1, point2) => {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2)
  );
};

/**
 * Calculates the angle between two points in degrees
 * @param {Object} point1 - First point with x, y coordinates
 * @param {Object} point2 - Second point with x, y coordinates
 * @returns {number} Angle in degrees
 */
export const calculateAngle = (point1, point2) => {
  return Math.atan2(
    point2.y - point1.y,
    point2.x - point1.x
  ) * (180 / Math.PI);
};

/**
 * Calculates the intersection point of two line segments
 * @param {Object} p1 - Start point of first line segment
 * @param {Object} p2 - End point of first line segment
 * @param {Object} p3 - Start point of second line segment
 * @param {Object} p4 - End point of second line segment
 * @returns {Object|null} Intersection point or null if no intersection
 */
export const getLineIntersection = (p1, p2, p3, p4) => {
  // Line 1 represented as a1x + b1y = c1
  const a1 = p2.y - p1.y;
  const b1 = p1.x - p2.x;
  const c1 = a1 * p1.x + b1 * p1.y;

  // Line 2 represented as a2x + b2y = c2
  const a2 = p4.y - p3.y;
  const b2 = p3.x - p4.x;
  const c2 = a2 * p3.x + b2 * p3.y;

  const determinant = a1 * b2 - a2 * b1;

  if (determinant === 0) {
    // Lines are parallel
    return null;
  }

  const x = (b2 * c1 - b1 * c2) / determinant;
  const y = (a1 * c2 - a2 * c1) / determinant;

  // Check if intersection point is within both line segments
  const onSegment1 =
    Math.min(p1.x, p2.x) <= x && x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= y && y <= Math.max(p1.y, p2.y);

  const onSegment2 =
    Math.min(p3.x, p4.x) <= x && x <= Math.max(p3.x, p4.x) &&
    Math.min(p3.y, p4.y) <= y && y <= Math.max(p3.y, p4.y);

  if (onSegment1 && onSegment2) {
    return { x, y };
  }

  return null;
};

/**
 * Generates a unique name by appending a number to the base name
 * @param {string} baseName - Base name to use
 * @param {Array} existingNames - Array of existing names to avoid duplicates
 * @returns {string} Unique name
 */
export const generateUniqueName = (baseName, existingNames) => {
  let counter = 1;
  let newName = `${baseName} ${counter}`;

  while (existingNames.includes(newName)) {
    counter++;
    newName = `${baseName} ${counter}`;
  }

  return newName;
};

/**
 * Generates a unique random location label in format A0-Z9 (260 total combinations)
 * @param {Array} existingNames - Array of existing location names to avoid duplicates
 * @returns {string|null} Unique location label or null if all 260 combinations are used
 */
export const generateUniqueLocationLabel = (existingNames) => {
  // Generate all possible combinations A0-Z9
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';

  // Create array of all possible combinations
  const allCombinations = [];
  for (let letter of letters) {
    for (let digit of digits) {
      allCombinations.push(letter + digit);
    }
  }

  // Filter out existing names
  const availableCombinations = allCombinations.filter(label => !existingNames.includes(label));

  if (availableCombinations.length === 0) {
    return null; // All 260 combinations are used
  }

  // Return a random available combination
  const randomIndex = Math.floor(Math.random() * availableCombinations.length);
  return availableCombinations[randomIndex];
};

/**
 * Determines location type based on number of connected streets
 * @param {string} locationId - Location ID
 * @param {Array} streets - All streets
 * @returns {string} Location type: 'island', 'parking', 'corner', '3way', '4way'
 */
export const determineLocationTypeByStreets = (locationId, streets) => {
  const connectedStreets = streets.filter(
    s => s.from === locationId || s.to === locationId
  );

  const streetCount = connectedStreets.length;

  switch (streetCount) {
    case 0: return 'island';
    case 1: return 'parking';
    case 2: return 'corner';
    case 3: return '3way';
    case 4: return '4way';
    default: return 'intersection'; // 5+ streets
  }
};

/**
 * Gets the appropriate font color for location label based on street count
 * @param {string} locationId - Location ID
 * @param {Array} streets - All streets
 * @returns {string} Font color: 'white', '#888888', or 'black'
 */
export const getLocationLabelColor = (locationId, streets) => {
  const connectedStreets = streets.filter(
    s => s.from === locationId || s.to === locationId
  );

  const streetCount = connectedStreets.length;

  if (streetCount <= 1) return 'white';
  if (streetCount === 2) return '#888888';
  return 'black';
};

/**
 * Formats a time value in seconds to a readable string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export const formatTime = (seconds) => {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
};
