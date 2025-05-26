import React from 'react';
import { getLocationLabelColor } from '../utils/helpers';

const Location = ({
  location,
  streets,
  isSelected,
  isEditable,
  onClick,
  onDelete,
  onAddCar,
  currentCarCount
}) => {
  const { id, name, x, y, type } = location;

  const handleContextMenu = (e) => {
    if (!isEditable) return;
    e.preventDefault();
    e.stopPropagation();

    // Determine available options based on location type
    const options = [];

    // Only Islands, Parking Lots, and Corners can be deleted
    if (type === 'island' || type === 'parking' || type === 'corner') {
      options.push('Delete');
    }

    // Only parking lots can have cars added
    if (type === 'parking') {
      options.push('Add A Car');
    }

    // If no options available, don't show menu
    if (options.length === 0) {
      return;
    }

    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.position = 'absolute';
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.backgroundColor = 'white';
    contextMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    contextMenu.style.borderRadius = '4px';
    contextMenu.style.zIndex = '1000';

    // Add menu items
    options.forEach((option, index) => {
      const item = document.createElement('div');
      item.textContent = option;
      item.style.padding = '8px 12px';
      item.style.cursor = 'pointer';
      item.style.hover = 'background-color: #f0f0f0';

      item.addEventListener('click', () => {
        handleMenuAction(option);
        document.body.removeChild(contextMenu);
      });

      contextMenu.appendChild(item);
    });

    // Add to DOM
    document.body.appendChild(contextMenu);

    // Close menu when clicking elsewhere
    const closeMenu = (e) => {
      if (!contextMenu.contains(e.target)) {
        document.body.removeChild(contextMenu);
        document.removeEventListener('click', closeMenu);
      }
    };

    // Small delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 100);

    // Handle menu actions
    const handleMenuAction = (action) => {
      switch (action) {
        case 'Delete':
          if (window.confirm(`Are you sure you want to delete ${name}?`)) {
            onDelete();
          }
          break;
        case 'Add A Car':
          onAddCar();
          break;
        default:
          break;
      }
    };
  };

  // All locations are dark grey as per requirement #15
  const fillColor = '#374151'; // Dark grey for all locations

  // Add a stroke if selected
  const strokeColor = isSelected ? '#f9ca24' : 'none';
  const strokeWidth = isSelected ? 3 : 0;

  // Get font color based on number of connected streets
  const labelColor = getLocationLabelColor(id, streets);

  return (
    <g
      onClick={onClick}
      onContextMenu={handleContextMenu}
      style={{ cursor: isEditable ? 'pointer' : 'default' }}
    >
      {/* Location circle */}
      <circle
        cx={x}
        cy={y}
        r={20}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />

      {/* Location label - center aligned in circle with big and bold font */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={labelColor}
        fontSize="16px"
        fontWeight="bold"
      >
        {name}
      </text>

      {/* Car count for parking lots */}
      {type === 'parking' && currentCarCount !== undefined && currentCarCount > 0 && (
        <text
          x={x}
          y={y + 30}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="10px"
          fontWeight="bold"
        >
          {currentCarCount}
        </text>
      )}
    </g>
  );
};

export default Location;
