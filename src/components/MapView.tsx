import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Property } from '../types';

interface MapViewProps {
  properties: Property[];
  selectedProperty?: Property;
  onPropertySelect: (property: Property) => void;
}

const MapView: React.FC<MapViewProps> = ({ properties, selectedProperty, onPropertySelect }) => {
  return (
    <div className="h-96 bg-gray-100 rounded-lg relative overflow-hidden">
      {/* Mock Map Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 opacity-50"></div>
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
        <button className="bg-white p-2 rounded-md shadow-md hover:bg-gray-50">
          <Navigation className="h-4 w-4 text-gray-600" />
        </button>
        <div className="bg-white p-2 rounded-md shadow-md">
          <div className="text-xs text-gray-600 mb-1">Zoom</div>
          <div className="flex flex-col space-y-1">
            <button className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded text-xs">+</button>
            <button className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded text-xs">-</button>
          </div>
        </div>
      </div>

      {/* Property Pins */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full max-w-2xl">
          {properties.slice(0, 6).map((property, index) => (
            <button
              key={property.id}
              onClick={() => onPropertySelect(property)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                selectedProperty?.id === property.id ? 'z-20' : 'z-10'
              }`}
              style={{
                left: `${20 + (index % 3) * 30}%`,
                top: `${30 + Math.floor(index / 3) * 40}%`,
              }}
            >
              <div className={`relative ${
                selectedProperty?.id === property.id ? 'scale-110' : 'hover:scale-105'
              } transition-transform`}>
                <MapPin className={`h-8 w-8 ${
                  selectedProperty?.id === property.id ? 'text-red-600' : 'text-blue-600'
                } drop-shadow-lg`} />
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow-lg text-xs font-medium whitespace-nowrap">
                  ${property.price.toLocaleString()}/mo
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Property Info */}
      {selectedProperty && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-20">
          <div className="flex items-start space-x-4">
            <img
              src={selectedProperty.imageUrl}
              alt={selectedProperty.title}
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {selectedProperty.title}
              </h3>
              <p className="text-sm text-gray-600 truncate">
                {selectedProperty.address}, {selectedProperty.city}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-blue-600">
                  ${selectedProperty.price.toLocaleString()}/mo
                </span>
                <div className="text-sm text-gray-600">
                  {selectedProperty.bedrooms}bd • {selectedProperty.bathrooms}ba
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mock Streets/Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
};

export default MapView;