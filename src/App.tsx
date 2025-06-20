import React, { useState } from 'react';
import { Filter, Grid, Map } from 'lucide-react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import FiltersPanel from './components/FiltersPanel';
import PropertyGrid from './components/PropertyGrid';
import MapView from './components/MapView';
import Pagination from './components/Pagination';
import SortDropdown from './components/SortDropdown';
import { SearchFilters, Property } from './types';
import { useProperties } from './hooks/useProperties';

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('relevance');
  const [selectedProperty, setSelectedProperty] = useState<Property | undefined>();
  
  const [filters, setFilters] = useState<SearchFilters>({
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

  const { properties, loading, error } = useProperties(filters, sortBy);

  // Pagination
  const itemsPerPage = 9;
  const totalPages = Math.ceil(properties.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProperties = properties.slice(startIndex, startIndex + itemsPerPage);

  const handleSearch = (location: string) => {
    setFilters(prev => ({ ...prev, location }));
    setCurrentPage(1);
  };

  const handleLocationSelect = (location: string) => {
    setFilters(prev => ({ ...prev, location }));
    setCurrentPage(1);
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <SearchBar
        onSearch={handleSearch}
        onLocationSelect={handleLocationSelect}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Panel */}
          <div className="lg:w-80 flex-shrink-0">
            <FiltersPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              isOpen={isFiltersOpen}
              onToggle={() => setIsFiltersOpen(!isFiltersOpen)}
              resultsCount={properties.length}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsFiltersOpen(true)}
                  className="lg:hidden flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </button>
                
                <div className="hidden sm:block">
                  <p className="text-gray-600">
                    {loading ? 'Loading...' : `${properties.length} properties found`}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <SortDropdown currentSort={sortBy} onSortChange={handleSortChange} />
                
                <div className="flex border border-gray-300 rounded-md overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${
                      viewMode === 'grid'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    } transition-colors`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`p-2 ${
                      viewMode === 'map'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    } transition-colors`}
                  >
                    <Map className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Area */}
            {viewMode === 'grid' ? (
              <>
                <PropertyGrid
                  properties={currentProperties}
                  loading={loading}
                  error={error || undefined}
                />
                {!loading && properties.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                )}
              </>
            ) : (
              <MapView
                properties={currentProperties}
                selectedProperty={selectedProperty}
                onPropertySelect={setSelectedProperty}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;