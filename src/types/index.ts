export interface Property {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  propertyType: 'house' | 'apartment' | 'condo' | 'townhouse';
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
  description: string;
  amenities: string[];
  latitude: number;
  longitude: number;
  listedDate: string;
  isNew: boolean;
}

export interface SearchFilters {
  location: string;
  priceMin: number;
  priceMax: number;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string;
  minSquareFeet: number | null;
  maxSquareFeet: number | null;
  amenities: string[];
}

export interface SortOption {
  value: string;
  label: string;
}