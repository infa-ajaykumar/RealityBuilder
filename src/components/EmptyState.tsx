import React from 'react';
import { Search, MapPin } from 'lucide-react';

const EmptyState: React.FC = () => {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Search className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No properties found
      </h3>
      <p className="text-gray-600 mb-6 max-w-sm mx-auto">
        We couldn't find any properties matching your criteria. Try adjusting your filters or searching in a different area.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">
          <MapPin className="h-4 w-4 mr-2" />
          Expand Search Area
        </button>
        <button className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors">
          Clear All Filters
        </button>
      </div>
    </div>
  );
};

export default EmptyState;