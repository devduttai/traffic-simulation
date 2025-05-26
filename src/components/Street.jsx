import React from 'react';

const Street = ({
  street,
  fromLocation,
  toLocation,
  width = 60, // Default width increased to match location diameter
  isEditable,
  onRename,
  onDelete
}) => {
  const { id, name } = street;

  // Calculate street path
  const x1 = fromLocation.x;
  const y1 = fromLocation.y;
  const x2 = toLocation.x;
  const y2 = toLocation.y;

  // Calculate street length for label positioning
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

  // Calculate midpoint for label
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Calculate angle for label rotation
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

  // Handle right-click context menu
  const handleContextMenu = (e) => {
    if (!isEditable) return;
    e.preventDefault();
    e.stopPropagation();

    const options = ['Rename', 'Delete'];

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
        handleMenuAction(index + 1);
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
    const handleMenuAction = (actionNumber) => {
      switch (actionNumber) {
        case 1: // Rename
          const newName = window.prompt("Enter new name:", name);
          if (newName && newName.trim() !== '') onRename(newName);
          break;
        case 2: // Delete
          if (window.confirm(`Are you sure you want to delete ${name}?`)) {
            onDelete();
          }
          break;
        default:
          break;
      }
    };
  };

  // Calculate perpendicular offset for lane markings
  const streetAngle = Math.atan2(y2 - y1, x2 - x1);
  const perpAngle = streetAngle + Math.PI / 2;

  // Calculate double yellow line positions (center of street)
  const yellowOffset1 = 1.5;
  const yellowOffset2 = -1.5;

  const yellow1X1 = x1 + Math.cos(perpAngle) * yellowOffset1;
  const yellow1Y1 = y1 + Math.sin(perpAngle) * yellowOffset1;
  const yellow1X2 = x2 + Math.cos(perpAngle) * yellowOffset1;
  const yellow1Y2 = y2 + Math.sin(perpAngle) * yellowOffset1;

  const yellow2X1 = x1 + Math.cos(perpAngle) * yellowOffset2;
  const yellow2Y1 = y1 + Math.sin(perpAngle) * yellowOffset2;
  const yellow2X2 = x2 + Math.cos(perpAngle) * yellowOffset2;
  const yellow2Y2 = y2 + Math.sin(perpAngle) * yellowOffset2;

  // Calculate perpendicular offset for label (outside the street)
  const labelGap = 1; // 1px gap
  const labelOffset = width / 2 + labelGap + 8; // 8px for label height/rect

  const labelX = midX + Math.cos(perpAngle) * labelOffset;
  const labelY = midY + Math.sin(perpAngle) * labelOffset;


  return (
    <g onContextMenu={handleContextMenu}>
      {/* Street base (asphalt) */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#374151"
        strokeWidth={width}
        strokeLinecap="round"
      />

      {/* Lane edges (white lines) */}
      
      {/*
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="none"
        transform={`translate(${Math.cos(perpAngle) * (width/2 - 1)}, ${Math.sin(perpAngle) * (width/2 - 1)})`}
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="none"
        transform={`translate(${Math.cos(perpAngle) * -(width/2 - 1)}, ${Math.sin(perpAngle) * -(width/2 - 1)})`}
      />
      /*}

      {/* Double yellow center lines */}
      <line
        x1={yellow1X1}
        y1={yellow1Y1}
        x2={yellow1X2}
        y2={yellow1Y2}
        stroke="yellow"
        strokeWidth={1}
        strokeDasharray="35,10"
        strokeLinecap="round"
      />
      <line
        x1={yellow2X1}
        y1={yellow2Y1}
        x2={yellow2X2}
        y2={yellow2Y2}
        stroke="yellow"
        strokeDasharray="35,10"
        strokeWidth={1}
        strokeLinecap="round"
      />
      
      {/* Street name label - outside the street, parallel, with 1px gap */}
      {/*
      <g transform={`translate(${labelX}, ${labelY}) rotate(${angle})`}>
        <rect
          x={-30}
          y={-8}
          width={60}
          height={16}
          fill="white"
          fillOpacity={0.8}
          rx={3}
          ry={3}
          stroke="#ccc"
          strokeWidth={1}
        />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#333"
          transform={angle > 90 || angle < -90 ? "rotate(180)" : ""}
        >
          {name}
        </text>
      </g> 
      */}
    </g>
  );
};

export default Street;
