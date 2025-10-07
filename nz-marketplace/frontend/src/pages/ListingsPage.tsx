import { useEffect, useState } from 'react';
import ListingCard from '../components/ListingCard';

const ListingsPage = () => {
  const [listings, setListings] = useState([]);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/listings/');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setListings(data.results);
      } catch (error) {
        console.error('Failed to fetch listings:', error);
      }
    };

    fetchListings();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Listings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
};

export default ListingsPage;