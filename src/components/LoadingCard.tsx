import React from 'react';

const LoadingCard: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-300"></div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="h-6 bg-gray-300 rounded w-3/4"></div>
          <div className="h-6 bg-gray-300 rounded w-20"></div>
        </div>
        <div className="h-4 bg-gray-300 rounded w-2/3 mb-3"></div>
        <div className="flex space-x-4 mb-3">
          <div className="h-4 bg-gray-300 rounded w-16"></div>
          <div className="h-4 bg-gray-300 rounded w-16"></div>
          <div className="h-4 bg-gray-300 rounded w-20"></div>
        </div>
        <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-300 rounded w-4/5 mb-3"></div>
        <div className="flex justify-between items-center">
          <div className="h-4 bg-gray-300 rounded w-24"></div>
          <div className="h-8 bg-gray-300 rounded w-32"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingCard;