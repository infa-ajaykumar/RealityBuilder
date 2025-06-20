import React from 'react';
import { Filter, X } from 'lucide-react';
import { SearchFilters } from '../types';
import { propertyTypes, amenityOptions } from '../data/mockData';

interface FiltersPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  isOpen: boolean;
  onToggle: () => void;
  resultsCount: number;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
  filters,
  onFiltersChange,
  isOpen,
  onToggle,
  resultsCount
}) => {
  const updateFilter = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleAmenity = (amenity: string) => {
    const newAmenities = filters.amenities.includes(amenity)
      ? filters.amenities.filter(a => a !== amenity)
      : [...filters.amenities, amenity];
    updateFilter('amenities', newAmenities);
  };

  const clearFilters = () => {
    onFiltersChange({
      location: '',
      priceMin: 0,
      priceMax: 10000,
      bedrooms: null,
      bathrooms: null,
      propertyType: '',
      minSquareFeet: null,
      maxSquareFeet: null,
      amenities: []
    });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Filters Panel */}
      <div className={`
        fixed lg:sticky top-0 left-0 h-full lg:h-auto w-80 bg-white shadow-lg lg:shadow-none
        transform transition-transform duration-300 ease-in-out z-50 lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        overflow-y-auto
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Filter className="h-5 w-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{resultsCount} results</span>
              <button
                onClick={onToggle}
                className="lg:hidden p-1 rounded-md hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Price Range */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Price Range
            </label>
            <div className="space-y-3">
              <div>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  value={filters.priceMin}
                  onChange={(e) => updateFilter('priceMin', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>${filters.priceMin}</span>
                  <span>Min</span>
                </div>
              </div>
              <div>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  value={filters.priceMax}
                  onChange={(e) => updateFilter('priceMax', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>${filters.priceMax}</span>
                  <span>Max</span>
                </div>
              </div>
            </div>
          </div>

          {/* Property Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Property Type
            </label>
            <select
              value={filters.propertyType}
              onChange={(e) => updateFilter('propertyType', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {propertyTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bedrooms */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Bedrooms
            </label>
            <div className="flex space-x-2">
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => updateFilter('bedrooms', num === filters.bedrooms ? null : num)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    filters.bedrooms === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {num === 0 ? 'Studio' : `${num}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Bathrooms */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Bathrooms
            </label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => updateFilter('bathrooms', num === filters.bathrooms ? null : num)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    filters.bathrooms === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {num}+
                </button>
              ))}
            </div>
          </div>

          {/* Square Footage */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Square Footage
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  placeholder="Min sq ft"
                  value={filters.minSquareFeet || ''}
                  onChange={(e) => updateFilter('minSquareFeet', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Max sq ft" 
                  value={filters.maxSquareFeet || ''}
                  onChange={(e) => updateFilter('maxSquareFeet', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Amenities
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {amenityOptions.map((amenity) => (
                <label key={amenity} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.amenities.includes(amenity)}
                    onChange={() => toggleAmenity(amenity)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{amenity}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </>
  );
};

export default FiltersPanel;