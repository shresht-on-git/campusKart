import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReputationBadge from '../components/ReputationBadge';
import { AuthContext } from '../context/AuthContext';

const ListingDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/listings/${id}`, {
          headers: { Authorization: `Bearer ${user?.token}` }
        });
        setListing(res.data);
        
        if (user && user._id !== res.data.seller?._id) {
          const statusRes = await axios.get(`http://localhost:5000/api/purchases/check/${id}`, {
            headers: { Authorization: `Bearer ${user?.token}` }
          });
          if (statusRes.data.exists) {
            setPurchaseStatus(statusRes.data.status);
            if (statusRes.data.conversationId) {
              setConversationId(statusRes.data.conversationId);
            }
          }
        }
      } catch (err) {
        setError('Failed to load listing. It may have been removed.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.token) {
      fetchListing();
    }
  }, [id, user]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      try {
        await axios.delete(`http://localhost:5000/api/listings/${id}`, {
          headers: { Authorization: `Bearer ${user?.token}` }
        });
        navigate('/marketplace');
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete listing');
      }
    }
  };

  const handlePurchaseRequest = async () => {
    try {
      await axios.post(`http://localhost:5000/api/purchases/${id}`, {}, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setPurchaseStatus('pending');
      alert('Purchase request sent to the seller!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request');
    }
  };

  if (loading) return <><Navbar /><div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div></>;
  if (error || !listing) return <><Navbar /><div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{error}</div></>;

  const isOwner = user && user._id === listing.seller?._id;

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container">
          <div className="page-header" style={{ marginBottom: '20px' }}>
            <Link to="/marketplace" className="btn btn-secondary">
              &larr; Back to Marketplace
            </Link>
            
            {isOwner && listing.status === 'available' && !listing.isDeleted && (
              <div className="action-buttons">
                <Link to={`/listings/${listing._id}/edit`} className="btn btn-secondary">
                  Edit
                </Link>
                <button onClick={handleDelete} className="btn btn-danger">
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="detail-grid">
            <div>
              <img 
                src={listing.images?.length > 0 ? listing.images[0] : 'https://placehold.co/800x600?text=No+Image'} 
                alt={listing.title} 
                className="detail-image"
              />
            </div>
            
            <div className="detail-info">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <span className="badge badge-primary">{listing.category}</span>
                <span className="badge">Condition: {listing.condition}</span>
                <span className={`badge ${listing.isDeleted ? 'badge-danger' : listing.status === 'available' ? 'badge-success' : 'badge-secondary'}`}>
                  {listing.isDeleted ? 'Deleted' : listing.status === 'available' ? 'Available' : 'Sold'}
                </span>
              </div>
              
              <h1 className="detail-title">{listing.title}</h1>
              <div className="detail-price">₹{listing.price}</div>
              
              {!isOwner && listing.status === 'available' && (
                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                  {listing.hasPendingSellerDecision && (!purchaseStatus || purchaseStatus === 'cancelled' || purchaseStatus === 'rejected') ? (
                    <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', textAlign: 'center', fontSize: '0.9rem' }}>
                      ⏳ This listing is temporarily unavailable pending seller decision.
                    </div>
                  ) : !purchaseStatus || purchaseStatus === 'cancelled' || purchaseStatus === 'rejected' ? (
                    <button onClick={handlePurchaseRequest} className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                      Interested in Buying
                    </button>
                  ) : purchaseStatus === 'pending' ? (
                    <button className="btn btn-secondary" style={{ width: '100%', padding: '12px', cursor: 'not-allowed' }} disabled>
                      Request Pending
                    </button>
                  ) : purchaseStatus === 'negotiating' ? (
                    conversationId ? (
                      <Link to={`/chat/${conversationId}`} className="btn btn-primary" style={{ width: '100%', padding: '12px', textAlign: 'center', display: 'block', backgroundColor: '#0284c7' }}>
                        Negotiating with Seller — Open Chat
                      </Link>
                    ) : (
                      <div className="badge badge-primary" style={{ display: 'block', textAlign: 'center', padding: '12px', fontSize: '1rem' }}>
                        Negotiating with Seller
                      </div>
                    )
                  ) : purchaseStatus === 'accepted' ? (
                    <div className="badge badge-success" style={{ display: 'block', textAlign: 'center', padding: '12px', fontSize: '1rem' }}>
                      Request Accepted!
                    </div>
                  ) : null}
                </div>
              )}

              {!isOwner && listing.status === 'sold' && purchaseStatus !== 'accepted' && (
                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <button className="btn btn-secondary" style={{ width: '100%', padding: '12px', cursor: 'not-allowed' }} disabled>
                    Sold
                  </button>
                </div>
              )}

              <div className="seller-card">
                <div className="seller-avatar">
                  {listing.seller?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="seller-info">
                  <h4>{listing.seller?.name}</h4>
                  <p>Hostel {listing.seller?.hostel}</p>
                  <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <ReputationBadge
                      rating={listing.seller?.sellerRating}
                      reviewCount={listing.seller?.sellerReviewCount}
                      completedTransactions={listing.seller?.sellerCompletedTransactions}
                      showRole={true}
                      role="Seller"
                    />
                  </div>
                  <p style={{ marginTop: '4px' }}>{listing.seller?.email}</p>
                </div>
              </div>

              <h3>Description</h3>
              <p className="detail-description">
                {listing.description}
              </p>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Posted on {new Date(listing.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ListingDetail;
