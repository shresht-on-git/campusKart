import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HostelToggle from '../components/HostelToggle';
import ReputationBadge from '../components/ReputationBadge';
import { AuthContext } from '../context/AuthContext';
import { useHostelMode } from '../context/HostelModeContext';

const Marketplace = () => {
  const { user } = useContext(AuthContext);
  const { hostelMode, userHostel } = useHostelMode();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [status, setStatus] = useState('available');
  const [sortBy, setSortBy] = useState('reputation');

  const categories = [
    'Electronics', 'Books', 'Notes', 'Cycles', 
    'Hostel Essentials', 'Study Materials', 'Sports', 'Accessories', 'Other'
  ];

  const conditions = ['New', 'Like New', 'Good', 'Fair'];

  const fetchListings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (condition) params.append('condition', condition);
      if (status) params.append('status', status);
      if (sortBy) params.append('sortBy', sortBy);
      if (hostelMode) params.append('hostelMode', 'true');

      const res = await axios.get(`http://localhost:5000/api/listings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setListings(res.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch listings. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchListings();
    }
  }, [category, condition, status, sortBy, hostelMode, user]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchListings();
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setCondition('');
    setStatus('available');
    setSortBy('reputation');
  };

  const currentUserHostel = userHostel || user?.hostel;

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container">
          <div className="page-header">
            <div>
              <h2>Campus Marketplace</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                Buy and sell within Thapar campus {currentUserHostel ? `• Hostel ${currentUserHostel}` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <HostelToggle />
              <Link to="/listings/create" className="btn btn-primary">
                + Create Listing
              </Link>
            </div>
          </div>

          {hostelMode && (
            <div className="hostel-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>🌙</span>
                <div>
                  <strong>Hostel Mode Active:</strong> Listings from{' '}
                  <span style={{ color: '#f59e0b', fontWeight: '700' }}>Hostel {currentUserHostel}</span>{' '}
                  are prioritized and displayed first!
                </div>
              </div>
              <span className="badge badge-hostel">Night Mode Active</span>
            </div>
          )}

          <form onSubmit={handleSearch} className="filters-bar">
            <div className="filter-group search-group">
              <label className="form-label">Search Listings</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="What are you looking for?"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary">Search</button>
              </div>
            </div>

            <div className="filter-group">
              <label className="form-label">Category</label>
              <select 
                className="form-control" 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="form-label">Condition</label>
              <select 
                className="form-control" 
                value={condition} 
                onChange={(e) => setCondition(e.target.value)}
              >
                <option value="">Any Condition</option>
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="form-label">Status</label>
              <select 
                className="form-control" 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Any Status</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="form-label">Sort By</label>
              <select 
                className="form-control" 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="reputation">Seller Rating (Highest First)</option>
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={clearFilters}
              style={{ padding: '12px 16px', height: 'max-content' }}
            >
              Clear
            </button>
          </form>

          {error && <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading marketplace...</div>
          ) : listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
              <h3>No listings found</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Try adjusting your filters or search term.</p>
            </div>
          ) : (
            <div className="grid">
              {listings.map(listing => {
                const listingHostel = listing.hostel || listing.seller?.hostel;
                const isSameHostel = currentUserHostel && listingHostel === currentUserHostel;

                return (
                  <Link to={`/listings/${listing._id}`} key={listing._id} className="card">
                    <img 
                      src={listing.images?.length > 0 ? listing.images[0] : 'https://placehold.co/400x300?text=No+Image'} 
                      alt={listing.title} 
                      className="card-img" 
                    />
                    <div className="card-body">
                      <div className="card-meta">
                        <span className="badge badge-primary">{listing.category}</span>
                        <span>Condition: {listing.condition}</span>
                        {hostelMode && isSameHostel && (
                          <span className="badge badge-hostel">★ Hostel {currentUserHostel}</span>
                        )}
                      </div>
                      <h3 className="card-title">{listing.title}</h3>
                      <div className="card-price">₹{listing.price}</div>
                      
                      <div className="card-footer">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span>Seller: {listing.seller?.name || 'N/A'}</span>
                          <ReputationBadge
                            rating={listing.seller?.sellerRating}
                            reviewCount={listing.seller?.sellerReviewCount}
                            completedTransactions={listing.seller?.sellerCompletedTransactions}
                          />
                          <span 
                            style={{ 
                              fontSize: '0.8rem', 
                              color: hostelMode && isSameHostel ? '#f59e0b' : 'var(--text-muted)',
                              fontWeight: hostelMode && isSameHostel ? 600 : 400
                            }}
                          >
                            Hostel: {listingHostel || 'N/A'} {hostelMode && isSameHostel ? '(Your Hostel)' : ''}
                          </span>
                        </div>
                        <span className={`badge ${listing.status === 'available' ? 'badge-success' : ''}`}>
                          {listing.status === 'available' ? 'Available' : 'Sold'}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Marketplace;
