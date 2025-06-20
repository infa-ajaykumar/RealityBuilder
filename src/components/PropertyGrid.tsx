import React from 'react';
import { Property } from '../types';
import PropertyCard from './PropertyCard';
import LoadingCard from './LoadingCard';
import EmptyState from './EmptyState';

interface PropertyGridProps {
  properties: Property[];
  loading: boolean;
  error?: string;
}

const PropertyGrid: React.FC<PropertyGridProps> = ({ properties, loading, error }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <LoadingCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (properties.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
};

export default PropertyGrid;