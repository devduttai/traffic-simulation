import { useState, useEffect, useRef } from 'react';
import Canvas from './components/Canvas';
import ErrorBoundary from './components/ErrorBoundary.jsx'; // Fixed import with .jsx extension
import { createCar, clearRoutingCache } from './utils/carManager';
import {
  createSimpleIntersectionScenario,
  createHeavyTrafficScenario,
  createUnbalancedTrafficScenario,
  createFourCarsOneDirectionScenario,
  applyTestScenario
} from './utils/testScenarios';
import './App.css';

function App() {
  // Core state
  const [locations, setLocations] = useState([]);
  const [streets, setStreets] = useState([]);
  const [cars, setCars] = useState([]);

  // Enhanced metrics state
  const [leftMetrics, setLeftMetrics] = useState({
    totalCars: 0,
    stopsPerCar: 0,
    timeSpentWaiting: 0,
    averageSpeed: 0, // in MPH
    averageTravelTime: 0 // across 10 locations
  });

  const [rightMetrics, setRightMetrics] = useState({
    totalCars: 0,
    stopsPerCar: 0,
    timeSpentWaiting: 0,
    averageSpeed: 0, // in MPH
    averageTravelTime: 0 // across 10 locations
  });

  const resetMetrics = () => {
    setLeftMetrics({
      totalCars: 0,
      stopsPerCar: 0,
      timeSpentWaiting: 0,
      averageSpeed: 0,
      averageTravelTime: 0
    });

    setRightMetrics({
      totalCars: 0,
      stopsPerCar: 0,
      timeSpentWaiting: 0,
      averageSpeed: 0,
      averageTravelTime: 0
    });
  };

  // Test scenario handlers
  const loadSimpleIntersection = () => {
    const scenario = createSimpleIntersectionScenario();
    applyTestScenario(setLocations, setStreets, scenario);
    clearRoutingCache(); // Clear routing cache for new scenario
    resetMetrics();
  };

  const loadHeavyTraffic = () => {
    const scenario = createHeavyTrafficScenario();
    applyTestScenario(setLocations, setStreets, scenario);
    clearRoutingCache(); // Clear routing cache for new scenario
    resetMetrics();
  };

  const loadUnbalancedTraffic = () => {
    const scenario = createUnbalancedTrafficScenario();
    applyTestScenario(setLocations, setStreets, scenario);
    clearRoutingCache(); // Clear routing cache for new scenario
    resetMetrics();
  };

  const loadFourCarsTest = () => {
    const scenario = createFourCarsOneDirectionScenario();
    applyTestScenario(setLocations, setStreets, scenario);
    clearRoutingCache(); // Clear routing cache for new scenario
    resetMetrics();
  };

  const clearScenario = () => {
    setLocations([]);
    setStreets([]);
    setCars([]);
    clearRoutingCache(); // Clear routing cache when clearing scenario
    resetMetrics();
  };

  // Remove test data initialization
  useEffect(() => {
    // No initial data loading - start with blank canvas
    console.log('Starting with blank canvas...');
  }, []);

  // This effect ensures that cars are properly shared between canvases
  // but prevents duplicate car creation when locations are added/modified
  const isInitialLoad = useRef(true);

  useEffect(() => {
    isInitialLoad.current = false;
  }, [locations, streets]);

  return (
    <div className="app-container">
      <div className="grid-container">
        {/* Top Row - Enhanced Metrics with Comparison */}
        <div className="grid-cell top-left">
          <div className="metrics-header-half">
            <h3 className="panel-title">Traditional Traffic Management</h3>
            <div className="metrics-row">
              <div className="metric-item">
                <div className="metric-value">
                  {leftMetrics.stopsPerCar.toFixed(1)}
                  <span className="metric-diff" style={{color: leftMetrics.stopsPerCar > rightMetrics.stopsPerCar ? 'red' : 'green'}}>
                    {leftMetrics.stopsPerCar > rightMetrics.stopsPerCar ?
                      `+${(leftMetrics.stopsPerCar - rightMetrics.stopsPerCar).toFixed(1)}` :
                      leftMetrics.stopsPerCar < rightMetrics.stopsPerCar ?
                      `-${(rightMetrics.stopsPerCar - leftMetrics.stopsPerCar).toFixed(1)}` : ''}
                  </span>
                </div>
                <div className="metric-label">Stops per Car</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">
                  {leftMetrics.timeSpentWaiting.toFixed(1)}s
                  <span className="metric-diff" style={{color: leftMetrics.timeSpentWaiting > rightMetrics.timeSpentWaiting ? 'red' : 'green'}}>
                    {leftMetrics.timeSpentWaiting > rightMetrics.timeSpentWaiting ?
                      `+${(leftMetrics.timeSpentWaiting - rightMetrics.timeSpentWaiting).toFixed(1)}s` :
                      leftMetrics.timeSpentWaiting < rightMetrics.timeSpentWaiting ?
                      `-${(rightMetrics.timeSpentWaiting - leftMetrics.timeSpentWaiting).toFixed(1)}s` : ''}
                  </span>
                </div>
                <div className="metric-label">Time Spent Waiting</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">
                  {leftMetrics.averageSpeed.toFixed(1)}
                  <span className="metric-diff" style={{color: leftMetrics.averageSpeed < rightMetrics.averageSpeed ? 'red' : 'green'}}>
                    {leftMetrics.averageSpeed < rightMetrics.averageSpeed ?
                      `-${(rightMetrics.averageSpeed - leftMetrics.averageSpeed).toFixed(1)}` :
                      leftMetrics.averageSpeed > rightMetrics.averageSpeed ?
                      `+${(leftMetrics.averageSpeed - rightMetrics.averageSpeed).toFixed(1)}` : ''}
                  </span>
                </div>
                <div className="metric-label">Average Speed (MPH)</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">
                  {leftMetrics.averageTravelTime.toFixed(1)}s
                  <span className="metric-diff" style={{color: leftMetrics.averageTravelTime > rightMetrics.averageTravelTime ? 'red' : 'green'}}>
                    {leftMetrics.averageTravelTime > rightMetrics.averageTravelTime ?
                      `+${(leftMetrics.averageTravelTime - rightMetrics.averageTravelTime).toFixed(1)}s` :
                      leftMetrics.averageTravelTime < rightMetrics.averageTravelTime ?
                      `-${(rightMetrics.averageTravelTime - leftMetrics.averageTravelTime).toFixed(1)}s` : ''}
                  </span>
                </div>
                <div className="metric-label">Avg Travel Time</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-cell top-right">
          <div className="metrics-header-half">
            <h3 className="panel-title">Smart Traffic Management</h3>
            <div className="metrics-row">
              <div className="metric-item">
                <div className="metric-value">
                  {rightMetrics.stopsPerCar.toFixed(1)}
                  <span className="metric-diff" style={{color: rightMetrics.stopsPerCar > leftMetrics.stopsPerCar ? 'red' : 'green'}}>
                    {rightMetrics.stopsPerCar > leftMetrics.stopsPerCar ?
                      `+${(rightMetrics.stopsPerCar - leftMetrics.stopsPerCar).toFixed(1)}` :
                      rightMetrics.stopsPerCar < leftMetrics.stopsPerCar ?
                      `-${(leftMetrics.stopsPerCar - rightMetrics.stopsPerCar).toFixed(1)}` : ''}
                  </span>
                </div>
                <div className="metric-label">Stops per Car</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">
                  {rightMetrics.timeSpentWaiting.toFixed(1)}s
                  <span className="metric-diff" style={{color: rightMetrics.timeSpentWaiting > leftMetrics.timeSpentWaiting ? 'red' : 'green'}}>
                    {rightMetrics.timeSpentWaiting > leftMetrics.timeSpentWaiting ?
                      `+${(rightMetrics.timeSpentWaiting - leftMetrics.timeSpentWaiting).toFixed(1)}s` :
                      rightMetrics.timeSpentWaiting < leftMetrics.timeSpentWaiting ?
                      `-${(leftMetrics.timeSpentWaiting - rightMetrics.timeSpentWaiting).toFixed(1)}s` : ''}
                  </span>
                </div>
                <div className="metric-label">Time Spent Waiting</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">
                  {rightMetrics.averageSpeed.toFixed(1)}
                  <span className="metric-diff" style={{color: rightMetrics.averageSpeed < leftMetrics.averageSpeed ? 'red' : 'green'}}>
                    {rightMetrics.averageSpeed < leftMetrics.averageSpeed ?
                      `-${(leftMetrics.averageSpeed - rightMetrics.averageSpeed).toFixed(1)}` :
                      rightMetrics.averageSpeed > leftMetrics.averageSpeed ?
                      `+${(rightMetrics.averageSpeed - leftMetrics.averageSpeed).toFixed(1)}` : ''}
                  </span>
                </div>
                <div className="metric-label">Average Speed (MPH)</div>
              </div>
              <div className="metric-item">
                <div className="metric-value">
                  {rightMetrics.averageTravelTime.toFixed(1)}s
                  <span className="metric-diff" style={{color: rightMetrics.averageTravelTime > leftMetrics.averageTravelTime ? 'red' : 'green'}}>
                    {rightMetrics.averageTravelTime > leftMetrics.averageTravelTime ?
                      `+${(rightMetrics.averageTravelTime - leftMetrics.averageTravelTime).toFixed(1)}s` :
                      rightMetrics.averageTravelTime < leftMetrics.averageTravelTime ?
                      `-${(leftMetrics.averageTravelTime - rightMetrics.averageTravelTime).toFixed(1)}s` : ''}
                  </span>
                </div>
                <div className="metric-label">Avg Travel Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row - Simulations */}
        <div className="grid-cell bottom-left">
          <div className="simulation-half">
            <ErrorBoundary>
              <Canvas
                side="left"
                locations={locations}
                setLocations={setLocations}
                streets={streets}
                setStreets={setStreets}
                cars={cars}
                setCars={setCars}
                setMetrics={setLeftMetrics}
                isSmartControl={false}
                isEditable={true}
              />
            </ErrorBoundary>
          </div>
        </div>

        <div className="grid-cell bottom-right">
          <div className="simulation-half">
            <ErrorBoundary>
              <Canvas
                side="right"
                locations={locations}
                setLocations={setLocations}
                streets={streets}
                setStreets={setStreets}
                cars={cars}
                setCars={setCars}
                setMetrics={setRightMetrics}
                isSmartControl={true}
                isEditable={false}
              />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
