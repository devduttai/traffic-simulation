import { useEffect, useRef, useState } from 'react';
import Location from './Location';
import Street from './Street';
import Car from './Car';
import TrafficLight from './TrafficLight';
import MotionSensor from './MotionSensor';
import {
  generateUniqueName,
  getLineIntersection,
  generateUniqueLocationLabel,
  determineLocationTypeByStreets
} from '../utils/helpers';
import {
  createCar,
  simulateTraffic
} from '../utils/carManager';
import {
  createIntersectionTrafficLights,
  updateTrafficLights
} from '../utils/trafficLightManager';
import './Canvas.css';

// Constants - Realistic proportions
const MIN_LOCATION_DISTANCE = 80;
const STREET_WIDTH = 40; // Match location diameter (2 * radius)

const Canvas = ({
  side,
  locations,
  setLocations,
  streets,
  setStreets,
  cars,
  setCars,
  setMetrics,
  isSmartControl,
  isEditable
}) => {
  // Local state
  const [localCars, setLocalCars] = useState([]);
  const [trafficLights, setTrafficLights] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [parkingLotCars, setParkingLotCars] = useState({});

  // Refs
  const canvasRef = useRef(null);
  const parkingLotLastCarTime = useRef({});
  const lastFrameTimeRef = useRef(Date.now());
  const initializedRef = useRef(false);

  // Initialize local cars based on the shared cars - only once
  useEffect(() => {
    if (!initializedRef.current) {
      console.log(`Initializing canvas for ${side} side.`);
      initializedRef.current = true;
    }
  }, [side]);

  // Update local cars when global cars change (but only new ones)
  useEffect(() => {
    if (initializedRef.current) {
      // Get IDs of existing local cars
      const existingCarIds = new Set(localCars.map(car => car.originalId || car.id.replace(`${side}-`, '')));

      // Find new cars that don't exist locally yet
      const newCars = cars.filter(car => !existingCarIds.has(car.id));

      if (newCars.length > 0) {
        console.log(`Adding ${newCars.length} new cars to ${side} side`);

        // Add new cars to local state with truly unique IDs
        setLocalCars(prev => [
          ...prev,
          ...newCars.map(car => ({
            ...car,
            id: `${side}-${car.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            originalId: car.id
          }))
        ]);
      }
    }
  }, [cars, side, localCars]);

  // Initialize parking lot car counts and traffic lights
  useEffect(() => {
    if (locations.length > 0) {
      const parkingLots = locations.filter(loc => loc.type === 'parking');

      // Create an object to track cars in each parking lot
      const initialParkingLotCars = {};

      parkingLots.forEach(parkingLot => {
        // Only initialize if not already set
        if (parkingLotCars[parkingLot.id] === undefined) {
          initialParkingLotCars[parkingLot.id] = parkingLot.carCount || 5;
        } else {
          initialParkingLotCars[parkingLot.id] = parkingLotCars[parkingLot.id];
        }
      });

      if (Object.keys(initialParkingLotCars).length > 0) {
        setParkingLotCars(prev => ({...prev, ...initialParkingLotCars}));
      }

      // ENHANCED: Check for 4-way intersections and reinitialize traffic lights for BOTH sides
      const intersections = locations.filter(loc => {
        const connectedStreets = streets.filter(
          s => s.from === loc.id || s.to === loc.id
        );
        return connectedStreets.length > 2;
      });

      // Check each intersection to see if it needs traffic light reinitialization
      intersections.forEach(intersection => {
        const connectedStreets = streets.filter(
          s => s.from === intersection.id || s.to === intersection.id
        );

        const existingLights = trafficLights.filter(
          light => light.locationId === intersection.id
        );

        // CRITICAL FIX: If we have a 4-way intersection but wrong number of lights, reinitialize
        if (connectedStreets.length === 4 && existingLights.length !== 4) {
          console.log(`🚦 ${side} side: 4-way intersection ${intersection.id} has ${existingLights.length} lights, should have 4 - reinitializing`);

          // Small delay to ensure street data is fully propagated
          setTimeout(() => {
            setTrafficLights(prevLights => {
              // Double-check the lights count in case it was updated by another process
              const currentLights = prevLights.filter(light => light.locationId === intersection.id);
              if (currentLights.length === 4) {
                console.log(`${side} side: Traffic lights already correct for ${intersection.id}`);
                return prevLights;
              }

              // Remove existing lights at this location
              const remainingLights = prevLights.filter(light => light.locationId !== intersection.id);

              // Create 4 brand new traffic lights
              const newLights = createIntersectionTrafficLights(
                intersection,
                connectedStreets,
                locations
              );

              console.log(`✅ ${side} side: Created ${newLights.length} new traffic lights for 4-way intersection ${intersection.id}`);
              return [...remainingLights, ...newLights];
            });
          }, 100); // Small delay for synchronization
        }
        // Create traffic lights for new intersections
        else if (existingLights.length === 0 && connectedStreets.length > 2) {
          const lights = createIntersectionTrafficLights(
            intersection,
            connectedStreets,
            locations
          );

          setTrafficLights(prev => {
            console.log(`✅ ${side} side: Created ${lights.length} traffic lights for new intersection ${intersection.id}`);
            return [...prev, ...lights];
          });
        }
      });
    }
  }, [locations, streets, side]); // Added 'side' to dependencies

  // Animation loop for simulation
  useEffect(() => {
    let animationFrameId;

    const runSimulation = () => {
      const now = Date.now();
      const deltaTime = (now - lastFrameTimeRef.current) / 1000; // Convert to seconds
      lastFrameTimeRef.current = now;

      // Update traffic lights
      setTrafficLights(prevLights => {
        if (prevLights.length === 0) return prevLights;

        return updateTrafficLights(
          prevLights,
          deltaTime,
          isSmartControl,
          localCars,
          streets,
          locations
        );
      });

      // Update car positions
      setLocalCars(prevCars => {
        // Skip update if no cars
        if (prevCars.length === 0) return prevCars;

        // Simulate traffic for all cars
        const updatedCars = simulateTraffic(
          prevCars,
          streets,
          locations,
          trafficLights,
          deltaTime,
          isSmartControl
        );

        // Calculate enhanced metrics continuously
        const completedCars = updatedCars.filter(car => car.reachedDestination && !car.counted);

        // Mark completed cars as counted
        if (completedCars.length > 0) {
          completedCars.forEach(car => {
            car.counted = true;
          });
        }

        // ENHANCED: Detect and handle stuck cars (but only remove them, don't replace)
        const stuckCars = updatedCars.filter(car => {
          if (car.reachedDestination) return false;

          // Check if car has been not moving for too long
          const timeNotMoving = car.timeNotMoving || 0;
          const STUCK_THRESHOLD = 30; // Increased to 30 seconds to give new collision detection time to resolve deadlocks

          return timeNotMoving > STUCK_THRESHOLD && car.speed < 0.01;
        });

        // Remove stuck cars (but don't automatically replace them to prevent car explosion)
        let carsAfterStuckRemoval = updatedCars;
        if (stuckCars.length > 0) {
          console.log(`🚨 Detected ${stuckCars.length} stuck cars, removing them...`);

          stuckCars.forEach(stuckCar => {
            console.log(`Removing stuck car ${stuckCar.id} at street ${stuckCar.currentStreetId}`);
          });

          // Remove stuck cars from the list
          carsAfterStuckRemoval = carsAfterStuckRemoval.filter(car =>
            !stuckCars.some(stuckCar => stuckCar.id === car.id)
          );
        }

        // Calculate metrics for all cars (active + completed)
        const allCars = carsAfterStuckRemoval;

        if (allCars.length > 0) {
          // Metric 1: Stops per car
          const totalStops = allCars.reduce((sum, car) => sum + (car.stops || 0), 0);
          const stopsPerCar = totalStops / allCars.length;

          // Debug logging for stops tracking (only log occasionally to avoid spam)
          if (Math.random() < 0.01) { // 1% chance to log
            console.log(`📊 Stops Metric Debug:`, {
              totalCars: allCars.length,
              totalStops: totalStops,
              stopsPerCar: stopsPerCar.toFixed(2),
              carsWithStops: allCars.filter(car => (car.stops || 0) > 0).length,
              maxStops: Math.max(...allCars.map(car => car.stops || 0))
            });
          }

          // Metric 2: Time spent waiting (summation of all waiting time)
          const timeSpentWaiting = allCars.reduce((sum, car) => sum + (car.timeNotMoving || 0), 0);

          // Metric 3: Average speed with real-world extrapolation (multiply by 10)
          const totalDistance = allCars.reduce((sum, car) => sum + (car.totalDistance || 0), 0);
          const totalTime = allCars.reduce((sum, car) => sum + ((Date.now() - car.createdAt) / 1000), 0);
          const baseAverageSpeed = totalTime > 0 ? (totalDistance / 10) / (totalTime / 60) : 0;
          const averageSpeed = baseAverageSpeed * 10; // Real-world extrapolation

          // Metric 4: Average travel time per street traveled (not per journey)
          const totalStreetsTraveled = allCars.reduce((sum, car) => sum + (car.streetsTraveled || 0), 0);
          const totalTravelTime = allCars.reduce((sum, car) => sum + (car.totalTravelTime || 0), 0);
          const averageTravelTime = totalStreetsTraveled > 0 ? totalTravelTime / totalStreetsTraveled : 0;

          // Update metrics
          setMetrics({
            totalCars: allCars.length,
            stopsPerCar: stopsPerCar,
            timeSpentWaiting: timeSpentWaiting,
            averageSpeed: averageSpeed,
            averageTravelTime: averageTravelTime
          });
        }

        // MEMORY LEAK FIX: Remove cars that have been at destination too long
        const MAX_CAR_LIFETIME = 300000; // 5 minutes in milliseconds
        const cleanedCars = carsAfterStuckRemoval.filter(car => {
          const age = Date.now() - car.createdAt;
          if (age > MAX_CAR_LIFETIME) {
            console.log(`🗑️ Removing old car ${car.id} (age: ${(age/1000).toFixed(1)}s)`);
            return false;
          }
          return true;
        });

        return cleanedCars;
      });

      // Generate cars from parking lots - only on the left side
      if (side === 'left') {
        // Find all parking lots
        const parkingLots = locations.filter(loc => loc.type === 'parking');

        parkingLots.forEach(parkingLot => {
          const lastCarTime = parkingLotLastCarTime.current[parkingLot.id] || 0;
          const frequency = parkingLot.frequency || 5; // Default to 5 seconds if not specified
          const carsRemaining = parkingLotCars[parkingLot.id] || 0;

          // Only log when we're about to spawn a car
          if (now - lastCarTime > frequency * 1000 && carsRemaining > 0) {
            console.log(`Parking lot ${parkingLot.id}: Ready to spawn car. Cars remaining: ${carsRemaining}`);
          }

          // Check if it's time to generate a new car and if there are cars left in this parking lot
          if (now - lastCarTime > frequency * 1000 && carsRemaining > 0 && localCars.length < 50) {
            // Find streets connected to this parking lot
            const connectedStreets = streets.filter(
              street => street.from === parkingLot.id || street.to === parkingLot.id
            );

            if (connectedStreets.length > 0) {
              // Choose a random street
              const startStreet = connectedStreets[Math.floor(Math.random() * connectedStreets.length)];

              // Choose a random destination (any location except this parking lot and intersections)
              const possibleDestinations = locations.filter(loc =>
                loc.id !== parkingLot.id && loc.type !== 'intersection'
              );

              if (possibleDestinations.length > 0) {
                const destination = possibleDestinations[Math.floor(Math.random() * possibleDestinations.length)];

                // Determine direction based on street endpoints
                // If parking lot is the 'from' location, car goes forward (from -> to)
                // If parking lot is the 'to' location, car goes backward (to -> from)
                const direction = startStreet.from === parkingLot.id ? 'forward' : 'backward';

                // Note: Car initial progress is handled correctly in createCar function

                // Create a new car with validation
                const newCar = createCar(
                  parkingLot.id,
                  destination.id,
                  startStreet.id,
                  direction
                );

                // VALIDATION: Only proceed if car creation was successful
                if (!newCar) {
                  console.error(`❌ Failed to create car at parking lot ${parkingLot.id}`);
                  return;
                }

                // Create local copy with truly unique side prefix
                const localCar = {
                  ...newCar,
                  id: `${side}-${newCar.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                  originalId: newCar.id
                };

                // Add to local cars
                setLocalCars(prev => {
                  console.log(`Adding car to local cars. Previous count: ${prev.length}`);
                  return [...prev, localCar];
                });

                // Add to global cars
                setCars(prev => [...prev, newCar]);

                // Update the last car time for this parking lot
                parkingLotLastCarTime.current[parkingLot.id] = now;

                // Decrease the car count for this parking lot
                setParkingLotCars(prev => ({
                  ...prev,
                  [parkingLot.id]: Math.max(0, (prev[parkingLot.id] || 0) - 1)
                }));

                console.log(`✅ Created new car from ${parkingLot.id} to ${destination.id} on street ${startStreet.id}`, {
                  carId: localCar.id,
                  direction: localCar.direction,
                  progress: localCar.progress,
                  streetFrom: startStreet.from,
                  streetTo: startStreet.to,
                  parkingLotId: parkingLot.id
                });
              }
            }
          }
        });
      }

      animationFrameId = requestAnimationFrame(runSimulation);
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(runSimulation);

    // Clean up on unmount
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [streets, locations, trafficLights, isSmartControl, side, setMetrics, setCars, parkingLotCars, localCars.length]);

  // Handle right-click to create a new location
  const handleContextMenu = (e) => {
    console.log('Right-click detected, isEditable:', isEditable);
    if (!isEditable) return;
    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    console.log('Mouse position:', { mouseX, mouseY });

    // Check if too close to existing location
    const isTooClose = locations.some(
      loc => Math.hypot(loc.x - mouseX, loc.y - mouseY) < MIN_LOCATION_DISTANCE
    );

    console.log('Too close to existing location:', isTooClose);

    if (!isTooClose) {
      // Check if we've reached the 260 location limit
      if (locations.length >= 260) {
        alert('Maximum number of locations (260) reached. Please delete existing locations to create new ones.');
        return;
      }

      // Generate unique label in A0-Z9 format
      const existingNames = locations.map(l => l.name);
      const uniqueLabel = generateUniqueLocationLabel(existingNames);

      if (!uniqueLabel) {
        alert('All location labels (A0-Z9) are in use. Please delete existing locations to create new ones.');
        return;
      }

      const newLocation = {
        id: `location-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name: uniqueLabel,
        x: mouseX,
        y: mouseY,
        type: 'island' // Will be updated automatically based on connected streets
      };

      setLocations(prev => [...prev, newLocation]);
      console.log('Created new location:', newLocation);
    } else {
      alert('New location cannot be so close to existing locations.');
    }
  };

  // Simplified intersection detection - for now, intersections are created manually
  // Future enhancement: automatic intersection detection when streets cross

  // Handle location selection
  const handleLocationSelect = (locationId) => {
    if (!isEditable) return;

    if (selectedLocation === locationId) {
      // Deselect if already selected
      setSelectedLocation(null);
    } else if (selectedLocation) {
      // If another location was already selected, create a street between them
      const fromLocation = locations.find(loc => loc.id === selectedLocation);
      const toLocation = locations.find(loc => loc.id === locationId);

      if (fromLocation && toLocation) {
        // Check if street already exists
        const streetExists = streets.some(
          s => (s.from === fromLocation.id && s.to === toLocation.id) ||
               (s.from === toLocation.id && s.to === fromLocation.id)
        );

        // Count connected streets for both locations
        const fromLocationStreets = streets.filter(
          s => s.from === fromLocation.id || s.to === fromLocation.id
        );

        const toLocationStreets = streets.filter(
          s => s.from === toLocation.id || s.to === toLocation.id
        );

        // Check if either location is a parking lot and already has a street
        const isParkingLotWithStreet =
          (fromLocation.type === 'parking' && fromLocationStreets.length > 0) ||
          (toLocation.type === 'parking' && toLocationStreets.length > 0);

        if (streetExists) {
          alert('A street already exists between these locations.');
        } else if (isParkingLotWithStreet) {
          alert('A parking lot can only connect to one street.');
        } else if (fromLocationStreets.length >= 4) {
          alert(`${fromLocation.name} already has the maximum of 4 connected streets.`);
        } else if (toLocationStreets.length >= 4) {
          alert(`${toLocation.name} already has the maximum of 4 connected streets.`);
        } else {
          // Create the street normally (without intersection detection)
          const createNormalStreet = () => {
            const newStreet = {
              id: `street-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              name: generateUniqueName('Street', streets.map(s => s.name)),
              from: fromLocation.id,
              to: toLocation.id,
              width: STREET_WIDTH
            };

            setStreets(prev => [...prev, newStreet]);
            console.log('Created new street:', newStreet);
          };

          // Check for intersections with existing streets
          let foundIntersection = false;
          const newStreetLine = {
            p1: { x: fromLocation.x, y: fromLocation.y },
            p2: { x: toLocation.x, y: toLocation.y }
          };

          // First, check if we can create a normal street
          for (const street of streets) {
            const streetFromLoc = locations.find(loc => loc.id === street.from);
            const streetToLoc = locations.find(loc => loc.id === street.to);

            if (!streetFromLoc || !streetToLoc) continue;

            // Skip streets that share an endpoint with the new street
            if (street.from === fromLocation.id || street.from === toLocation.id ||
                street.to === fromLocation.id || street.to === toLocation.id) {
              continue;
            }

            const existingStreetLine = {
              p1: { x: streetFromLoc.x, y: streetFromLoc.y },
              p2: { x: streetToLoc.x, y: streetToLoc.y }
            };

            // Find intersection point
            const intersectionPoint = getLineIntersection(
              newStreetLine.p1,
              newStreetLine.p2,
              existingStreetLine.p1,
              existingStreetLine.p2
            );

            if (intersectionPoint) {
              // Check if intersection is far enough from all existing locations
              let tooCloseToLocation = false;

              for (const loc of locations) {
                const distance = Math.hypot(
                  loc.x - intersectionPoint.x,
                  loc.y - intersectionPoint.y
                );

                if (distance < MIN_LOCATION_DISTANCE) {
                  tooCloseToLocation = true;
                  break;
                }
              }

              if (!tooCloseToLocation) {
                // Valid intersection found - create a new intersection
                foundIntersection = true;

                // Create new intersection location with unique label
                const existingNames = locations.map(l => l.name);
                const uniqueLabel = generateUniqueLocationLabel(existingNames);

                if (!uniqueLabel) {
                  alert('All location labels (A0-Z9) are in use. Cannot create intersection.');
                  return;
                }

                const newLocation = {
                  id: `location-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                  name: uniqueLabel,
                  x: intersectionPoint.x,
                  y: intersectionPoint.y,
                  type: '4way' // Will be updated automatically based on connected streets
                };

                // ENHANCED: Create 4 new streets with unique names
                const baseTimestamp = Date.now();
                const existingStreetNames = streets.map(s => s.name);

                // Generate 4 unique street names sequentially
                const streetName1 = generateUniqueName('Street', existingStreetNames);
                const streetName2 = generateUniqueName('Street', [...existingStreetNames, streetName1]);
                const streetName3 = generateUniqueName('Street', [...existingStreetNames, streetName1, streetName2]);
                const streetName4 = generateUniqueName('Street', [...existingStreetNames, streetName1, streetName2, streetName3]);

                const newStreets = [
                  {
                    id: `street-${baseTimestamp}-1`,
                    name: streetName1,
                    from: fromLocation.id,
                    to: newLocation.id,
                    width: STREET_WIDTH
                  },
                  {
                    id: `street-${baseTimestamp}-2`,
                    name: streetName2,
                    from: newLocation.id,
                    to: toLocation.id,
                    width: STREET_WIDTH
                  },
                  {
                    id: `street-${baseTimestamp}-3`,
                    name: streetName3,
                    from: streetFromLoc.id,
                    to: newLocation.id,
                    width: STREET_WIDTH
                  },
                  {
                    id: `street-${baseTimestamp}-4`,
                    name: streetName4,
                    from: newLocation.id,
                    to: streetToLoc.id,
                    width: STREET_WIDTH
                  }
                ];

                // Add the new location
                setLocations(prev => [...prev, newLocation]);

                // Remove the intersecting street and add the 4 new streets
                setStreets(prev => [
                  ...prev.filter(s => s.id !== street.id),
                  ...newStreets
                ]);

                // FIXED: Initialize traffic lights for the new 4-way intersection
                setTimeout(() => {
                  setTrafficLights(prev => {
                    // Remove any existing lights at this location
                    const filteredLights = prev.filter(light => light.locationId !== newLocation.id);

                    // Create new traffic lights for the 4-way intersection
                    const newLights = createIntersectionTrafficLights(
                      newLocation,
                      newStreets,
                      [...locations, newLocation]
                    );

                    console.log(`Created ${newLights.length} traffic lights for new 4-way intersection ${newLocation.id}`);
                    return [...filteredLights, ...newLights];
                  });
                }, 100); // Small delay to ensure locations are updated

                console.log('Created new intersection:', newLocation);
                console.log('Created 4 new streets:', newStreets);
                break;
              }
            }
          }

          // If no valid intersection was found, create a normal street
          if (!foundIntersection) {
            createNormalStreet();

            // REBUILT: Simple and reliable traffic light re-initialization for 3-way to 4-way conversion
            setTimeout(() => {
              // Check both endpoints to see if they became 4-way intersections
              [fromLocation, toLocation].forEach(location => {
                setStreets(currentStreets => {
                  const connectedStreets = currentStreets.filter(
                    s => s.from === location.id || s.to === location.id
                  );

                  // If this location now has exactly 4 streets, completely rebuild traffic lights
                  if (connectedStreets.length === 4) {
                    console.log(`🚦 Location ${location.id} became 4-way intersection - rebuilding traffic lights`);

                    // STEP 1: Delete all existing traffic lights at this location
                    setTrafficLights(prevLights => {
                      const lightsToRemove = prevLights.filter(light => light.locationId === location.id);
                      console.log(`🗑️ Removing ${lightsToRemove.length} existing traffic lights at ${location.id}`);

                      const remainingLights = prevLights.filter(light => light.locationId !== location.id);

                      // STEP 2: Create 4 brand new traffic lights in 2 opposite pairs
                      const newLights = createIntersectionTrafficLights(
                        location,
                        connectedStreets,
                        locations
                      );

                      console.log(`✅ Created ${newLights.length} new traffic lights for 4-way intersection ${location.id} on ${side} side`);
                      console.log(`Traffic light pairs:`, newLights.map(l => ({ id: l.id, groupId: l.oppositeGroupId, state: l.state })));

                      return [...remainingLights, ...newLights];
                    });
                  }

                  return currentStreets; // Return unchanged streets
                });
              });
            }, 300); // Sufficient delay to ensure street is fully added
          }
        }
      }

      setSelectedLocation(null);
    } else {
      // Select this location
      setSelectedLocation(locationId);
    }
  };

  // Location renaming is no longer allowed - locations have automatic unique labels

  // Handle adding a single car to a parking lot
  const handleAddSingleCar = (locationId) => {
    if (!isEditable) return;

    // Check if location is a parking lot (has exactly one connected street)
    const connectedStreets = streets.filter(
      s => s.from === locationId || s.to === locationId
    );

    if (connectedStreets.length !== 1) {
      alert('Cars can only be added to parking lots (locations with exactly one connected street).');
      return;
    }

    // CRITICAL FIX: Immediately spawn the car instead of just incrementing counter
    const startStreet = connectedStreets[0];

    // Choose a random destination (any location except this parking lot and intersections)
    const possibleDestinations = locations.filter(loc =>
      loc.id !== locationId && loc.type !== 'intersection'
    );

    if (possibleDestinations.length === 0) {
      alert('No valid destinations available for the car. Please create more locations.');
      return;
    }

    const destination = possibleDestinations[Math.floor(Math.random() * possibleDestinations.length)];

    // Determine direction based on street endpoints
    const direction = startStreet.from === locationId ? 'forward' : 'backward';

    // Create a new car immediately with validation
    const newCar = createCar(
      locationId,
      destination.id,
      startStreet.id,
      direction
    );

    // VALIDATION: Only proceed if car creation was successful
    if (!newCar) {
      console.error(`❌ Failed to create car at location ${locationId}`);
      alert('Failed to create car. Please check the console for details.');
      return;
    }

    // Create local copy with truly unique side prefix
    const localCar = {
      ...newCar,
      id: `${side}-${newCar.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      originalId: newCar.id
    };

    // Add to local cars immediately
    setLocalCars(prev => {
      console.log(`🚗 Manually adding car to local cars. Previous count: ${prev.length}`);
      return [...prev, localCar];
    });

    // Add to global cars
    setCars(prev => [...prev, newCar]);

    console.log(`✅ Manually created car from ${locationId} to ${destination.id} on street ${startStreet.id}`, {
      carId: localCar.id,
      direction: localCar.direction,
      progress: localCar.progress,
      streetFrom: startStreet.from,
      streetTo: startStreet.to,
      parkingLotId: locationId
    });
  };

  // Handle location delete
  const handleLocationDelete = (locationId) => {
    if (!isEditable) return;

    // Delete connected streets first
    setStreets(prev =>
      prev.filter(s => s.from !== locationId && s.to !== locationId)
    );

    // Then delete the location
    setLocations(prev => prev.filter(loc => loc.id !== locationId));

    if (selectedLocation === locationId) {
      setSelectedLocation(null);
    }
  };

  // Handle street rename
  const handleStreetRename = (streetId, newName) => {
    if (!isEditable) return;

    setStreets(prev =>
      prev.map(s =>
        s.id === streetId ? { ...s, name: newName } : s
      )
    );
  };

  // Handle street delete
  const handleStreetDelete = (streetId) => {
    if (!isEditable) return;

    setStreets(prev => prev.filter(s => s.id !== streetId));
  };

  // Location conversion to parking lot is now automatic based on connected streets

  // Handle traffic light configuration
  const handleConfigureTrafficLight = (lightId, greenDuration) => {
    if (!isEditable) return;

    setTrafficLights(prev =>
      prev.map(light =>
        light.id === lightId
          ? { ...light, config: { ...light.config, green: greenDuration * 1000 } }
          : light
      )
    );
  };

  // Generate motion sensors for smart side
  const generateMotionSensors = () => {
    if (!isSmartControl) return [];

    const sensors = [];
    const CAR_LENGTH = 20; // Approximate car length
    const SENSOR_SPACING = CAR_LENGTH * 3; // 3 car lengths apart

    streets.forEach(street => {
      const fromLocation = locations.find(loc => loc.id === street.from);
      const toLocation = locations.find(loc => loc.id === street.to);

      if (!fromLocation || !toLocation) return;

      const streetLength = Math.hypot(
        toLocation.x - fromLocation.x,
        toLocation.y - fromLocation.y
      );

      const streetAngle = Math.atan2(
        toLocation.y - fromLocation.y,
        toLocation.x - fromLocation.x
      );

      // Calculate number of sensors along this street
      const numSensors = Math.floor(streetLength / SENSOR_SPACING);

      for (let i = 1; i <= numSensors; i++) {
        const progress = i / (numSensors + 1);

        // Position along the street
        const centerX = fromLocation.x + (toLocation.x - fromLocation.x) * progress;
        const centerY = fromLocation.y + (toLocation.y - fromLocation.y) * progress;

        // Offset to the side of the street
        const sideOffset = STREET_WIDTH / 2 + 10;
        const perpAngle = streetAngle + Math.PI / 2;

        // Sensors on both sides of the street
        sensors.push({
          id: `sensor-${street.id}-${i}-left`,
          x: centerX + Math.cos(perpAngle) * sideOffset,
          y: centerY + Math.sin(perpAngle) * sideOffset,
          angle: (streetAngle * 180 / Math.PI) - 90,
          streetId: street.id
        });

        sensors.push({
          id: `sensor-${street.id}-${i}-right`,
          x: centerX - Math.cos(perpAngle) * sideOffset,
          y: centerY - Math.sin(perpAngle) * sideOffset,
          angle: (streetAngle * 180 / Math.PI) + 90,
          streetId: street.id
        });
      }
    });

    return sensors;
  };

  const motionSensors = generateMotionSensors();

  return (
    <div
      className="canvas-container"
      onContextMenu={handleContextMenu}
    >
      <svg
        ref={canvasRef}
        width="1000"
        height="1000"
        className="canvas"
      >
        {/* Subtle grid background */}
        <defs>
          <pattern id={`grid-${side}`} width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="2000" height="2000" fill={`url(#grid-${side})`} x="-500" y="-500" />

      {/* Motion Sensors (Smart side only) */}
        {motionSensors.map(sensor => (
          <MotionSensor
            key={sensor.id}
            x={sensor.x}
            y={sensor.y}
            angle={sensor.angle}
            cars={localCars}
            streets={streets}
            locations={locations}
          />
        ))}

        {/* Streets */}
        {streets.map(street => {
          const fromLocation = locations.find(loc => loc.id === street.from);
          const toLocation = locations.find(loc => loc.id === street.to);

          if (!fromLocation || !toLocation) return null;

          return (
            <Street
              key={`${side}-${street.id}`}
              street={street}
              side={side}
              fromLocation={fromLocation}
              toLocation={toLocation}
              width={street.width}
              isEditable={isEditable}
              onRename={(newName) => handleStreetRename(street.id, newName)}
              onDelete={() => handleStreetDelete(street.id)}
            />
          );
        })}

        {/* Traffic Lights */}
        {trafficLights.map(light => {
          // Calculate position and angle for each traffic light
          const location = locations.find(loc => loc.id === light.locationId);
          if (!location) return null;

          return (
            <TrafficLight
              key={`${side}-${light.id}`}
              x={light.x}
              y={light.y}
              angle={light.angle || 0}
              state={light.state || 'red'}
              isSmartControl={isSmartControl}
              isEditable={isEditable}
              onConfigure={(duration) => handleConfigureTrafficLight(light.id, duration)}
            />
          );
        })}

        {/* Locations */}
        {locations.map(location => {
          // Update location type based on connected streets
          const updatedLocation = {
            ...location,
            type: determineLocationTypeByStreets(location.id, streets)
          };

          return (
            <Location
              key={`${side}-${location.id}`}
              location={updatedLocation}
              streets={streets}
              isSelected={selectedLocation === location.id}
              isEditable={isEditable}
              onClick={() => handleLocationSelect(location.id)}
              onDelete={() => handleLocationDelete(location.id)}
              onAddCar={() => handleAddSingleCar(location.id)}
              currentCarCount={parkingLotCars[location.id]}
            />
          );
        })}



        {/* Cars - render on top */}
        <g className="cars-layer">
          {localCars.map(car => (
            <Car
              key={`${car.id}-${car.streetId || ''}`}
              car={car}
              streets={streets}
              locations={locations}
            />
          ))}
        </g>
      </svg>

      {/* Instructions */}

      {/*{isEditable && (
        <div className="canvas-instructions">
          <h3>Build Your Traffic Network</h3>
          <p>Right-click: Add location</p>
          <p>Click two locations: Create street</p>
          <p>Right-click on objects: Edit/Delete</p>
          <p>Create parking lots to generate cars</p>
          <button
            onClick={() => {
              console.log('Current state:', {
                locations: locations.length,
                streets: streets.length,
                parkingLotCars,
                localCars: localCars.length,
                trafficLights: trafficLights.length
              });
            }}
            style={{ marginTop: '10px', padding: '5px 10px' }}
          >
            Debug Info
          </button>
          <button
            onClick={() => {
              console.log('Traffic Light States:');
              trafficLights.forEach(light => {
                console.log(`Light ${light.id} at intersection ${light.locationId}:`, {
                  state: light.state,
                  group: light.oppositeGroupId,
                  timer: light.timer?.toFixed(2),
                  streetId: light.streetId,
                  angle: light.angle?.toFixed(1)
                });
              });

              // Group by intersection
              const byIntersection = {};
              trafficLights.forEach(light => {
                if (!byIntersection[light.locationId]) {
                  byIntersection[light.locationId] = [];
                }
                byIntersection[light.locationId].push(light);
              });

              console.log('Grouped by intersection:', byIntersection);
            }}
            style={{ marginTop: '5px', padding: '5px 10px' }}
          >
            Debug Traffic Lights
          </button>
        </div>
      )}*/}
    </div>
  );
};

export default Canvas;
