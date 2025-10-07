import { Link } from 'react-router-dom';

const ListingCard = ({ listing }) => {
  return (
    <div className="border rounded-lg p-4 shadow-lg">
      <img src={listing.images[0]?.image || 'https://via.placeholder.com/150'} alt={listing.title} className="w-full h-48 object-cover rounded-md mb-4" />
      <h2 className="text-xl font-bold">{listing.title}</h2>
      <p className="text-gray-700">${listing.price}</p>
      <p className="text-sm text-gray-500">{listing.location}</p>
      <Link to={`/listings/${listing.id}`} className="text-blue-500 hover:underline">
        View Details
      </Link>
    </div>
  );
};

export default ListingCard;