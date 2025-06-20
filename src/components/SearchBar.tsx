import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin } from 'lucide-react';
import { cities } from '../data/mockData';

interface SearchBarProps {
  onSearch: (location: string) => void;
  onLocationSelect: (location: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onLocationSelect }) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (value.length > 0) {
      const filtered = cities.filter(city =>
        city.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCities(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (city: string) => {
    setQuery(city);
    onLocationSelect(city);
    setShowSuggestions(false);
  };

  return (
    <div className="bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Find Your Perfect Home
          </h1>
          <p className="text-lg text-gray-600">
            Search thousands of listings from multiple sources
          </p>
        </div>

        <div ref={searchRef} className="relative">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative flex items-center">
              <MapPin className="absolute left-4 h-5 w-5 text-gray-400 z-10" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Enter city, neighborhood, or address..."
                className="w-full pl-12 pr-16 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
              <button
                type="submit"
                className="absolute right-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md transition-colors"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </form>

          {showSuggestions && filteredCities.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-20">
              {filteredCities.slice(0, 6).map((city, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(city)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center transition-colors"
                >
                  <MapPin className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-gray-900">{city}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;