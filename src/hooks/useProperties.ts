import { useState, useEffect, useMemo } from 'react';
import { Property, SearchFilters } from '../types';
import { mockProperties } from '../data/mockData';

export const useProperties = (filters: SearchFilters, sortBy: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate API loading delay
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [filters, sortBy]);

  const filteredProperties = useMemo(() => {
    let filtered = [...mockProperties];

    // Filter by location
    if (filters.location.trim()) {
      filtered = filtered.filter(property =>
        property.city.toLowerCase().includes(filters.location.toLowerCase()) ||
        property.state.toLowerCase().includes(filters.location.toLowerCase()) ||
        property.address.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    // Filter by price range
    filtered = filtered.filter(property =>
      property.price >= filters.priceMin && property.price <= filters.priceMax
    );

    // Filter by bedrooms
    if (filters.bedrooms !== null) {
      filtered = filtered.filter(property => property.bedrooms >= filters.bedrooms!);
    }

    // Filter by bathrooms
    if (filters.bathrooms !== null) {
      filtered = filtered.filter(property => property.bathrooms >= filters.bathrooms!);
    }

    // Filter by property type
    if (filters.propertyType) {
      filtered = filtered.filter(property => property.propertyType === filters.propertyType);
    }

    // Filter by square footage
    if (filters.minSquareFeet !== null) {
      filtered = filtered.filter(property => property.squareFeet >= filters.minSquareFeet!);
    }
    if (filters.maxSquareFeet !== null) {
      filtered = filtered.filter(property => property.squareFeet <= filters.maxSquareFeet!);
    }

    // Filter by amenities
    if (filters.amenities.length > 0) {
      filtered = filtered.filter(property =>
        filters.amenities.every(amenity => property.amenities.includes(amenity))
      );
    }

    // Sort properties
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.listedDate).getTime() - new Date(a.listedDate).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.listedDate).getTime() - new Date(b.listedDate).getTime());
        break;
      default:
        // relevance - keep default order
        break;
    }

    return filtered;
  }, [filters, sortBy]);

  return {
    properties: filteredProperties,
    loading,
    error
  };
};