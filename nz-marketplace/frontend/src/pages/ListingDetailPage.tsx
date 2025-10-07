import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const ListingDetailPage = () => {
  const { id } = useParams();
  const [listing, setListing] = useState(null);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/listings/${id}/`);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setListing(data);
      } catch (error) {
        console.error(`Failed to fetch listing with id ${id}:`, error);
      }
    };

    fetchListing();
  }, [id]);

  if (!listing) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">{listing.title}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {listing.images && listing.images.length > 0 ? (
            <img src={listing.images[0].image} alt={listing.title} className="w-full h-auto rounded-lg" />
          ) : (
            <img src="https://via.placeholder.com/300" alt="Placeholder" className="w-full h-auto rounded-lg" />
          )}
        </div>
        <div>
          <p className="text-xl mb-4">{listing.description}</p>
          <p className="text-2xl font-bold text-green-600 mb-2">Price: ${listing.price}</p>
          <p className="text-gray-600">Location: {listing.location}</p>
        </div>
      </div>
    </div>
  );
};

export default ListingDetailPage;