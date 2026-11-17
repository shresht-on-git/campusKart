import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import ReputationBadge from '../components/ReputationBadge';
import ReviewModal from '../components/ReviewModal';
import { API_URL, getImageUrl } from '../config';

const MyPurchases = () => {
  const { user } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeReviewConvId, setActiveReviewConvId] = useState(null);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/purchases/my`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setRequests(res.data);
    } catch (err) {
      setError('Failed to load your purchases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) fetchRequests();
  }, [user]);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      await axios.put(`${API_URL}/purchases/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setRequests(requests.map(req => req._id === id ? { ...req, status: 'cancelled' } : req));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  const getStatusDisplay = (req) => {
    if (req.pendingSellerDecision) {
      return {
        text: 'You ended this negotiation. Waiting for seller to confirm transaction outcome.',
        badgeClass: 'badge-primary',
        badgeText: 'AWAITING SELLER DECISION'
      };
    }

    switch (req.status) {
      case 'pending':
        return {
          text: 'Waiting for seller response.',
          badgeClass: 'badge-primary',
          badgeText: 'WAITING FOR SELLER'
        };
      case 'negotiating':
        return {
          text: 'Seller accepted your request. Start negotiating.',
          badgeClass: 'badge-primary',
          badgeText: 'NEGOTIATING'
        };
      case 'accepted':
        return {
          text: 'Sale confirmed.',
          badgeClass: 'badge-success',
          badgeText: 'SALE CONFIRMED'
        };
      case 'rejected':
        return {
          text: 'Your purchase request was rejected.',
          badgeClass: 'badge-danger',
          badgeText: 'REQUEST REJECTED'
        };
      case 'cancelled':
        return {
          text: req.sellerMessage ? req.sellerMessage : (req.conversationId ? 'Negotiation ended.' : 'Request cancelled.'),
          badgeClass: 'badge-secondary',
          badgeText: 'CANCELLED'
        };
      default:
        return {
          text: '',
          badgeClass: 'badge-secondary',
          badgeText: req.status?.toUpperCase() || ''
        };
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container">
          <div className="page-header">
            <h2>My Purchases</h2>
          </div>
          {loading && <div>Loading your purchases...</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
          {!loading && !error && requests.length === 0 && (
            <div className="empty-state">You have not made any purchase requests yet.</div>
          )}
          <div className="requests-list" style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
            {requests.map(req => {
              const statusInfo = getStatusDisplay(req);

              return (
                <div key={req._id} className="card" style={{ display: 'flex', padding: '16px', gap: '16px', alignItems: 'center' }}>
                  {req.listing?.images?.[0] ? (
                    <img
                      src={getImageUrl(req.listing.images[0])}
                      alt="listing"
                      style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
                      onError={(e) => { e.target.src = 'https://placehold.co/800x600?text=No+Image'; }}
                    />
                  ) : (
                    <img
                      src="https://placehold.co/800x600?text=No+Image"
                      alt="listing"
                      style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <h4><Link to={`/listings/${req.listing?._id}`}>{req.listing?.title}</Link></h4>
                    <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>₹{req.listing?.price}</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                      Seller: {req.seller?.name} (Hostel {req.seller?.hostel})
                    </div>
                    <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                      <ReputationBadge
                        rating={req.seller?.sellerRating}
                        reviewCount={req.seller?.sellerReviewCount}
                        completedTransactions={req.seller?.sellerCompletedTransactions}
                        showRole={true}
                        role="Seller"
                      />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Requested on: {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                    
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={`badge ${statusInfo.badgeClass}`}>
                        {statusInfo.badgeText}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {statusInfo.text}
                      </span>
                      {req.reviewStatus === 'pending' && (
                        <span className="badge" style={{ backgroundColor: '#fef08a', color: '#854d0e', border: '1px solid #facc15' }}>
                          ★ Review Pending
                        </span>
                      )}
                      {req.reviewStatus === 'submitted' && (
                        <span className="badge badge-success">
                          ✓ Review Submitted
                        </span>
                      )}
                    </div>

                    {req.status === 'cancelled' && req.sellerMessage && req.sellerMessage.trim() !== '' && (
                      <div className="seller-message-box" style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--surface-alt, #f1f5f9)', borderRadius: '6px', borderLeft: '4px solid var(--text-muted)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Message from seller:</div>
                        <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-main)' }}>"{req.sellerMessage}"</div>
                      </div>
                    )}
                  </div>
                  <div>
                    {req.status === 'pending' && (
                      <button onClick={() => handleCancel(req._id)} className="btn btn-danger">Cancel Request</button>
                    )}
                    {req.status === 'negotiating' && req.conversationId && (
                      <Link
                        to={`/chat/${req.conversationId}`}
                        className="btn btn-primary"
                        style={{ backgroundColor: '#0284c7' }}
                      >
                        Open Chat
                      </Link>
                    )}
                    {req.pendingSellerDecision && req.conversationId && (
                      <Link
                        to={`/chat/${req.conversationId}`}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.85rem', textAlign: 'center' }}
                      >
                        View Chat History
                      </Link>
                    )}
                    {(req.status === 'accepted' || req.status === 'cancelled' || req.status === 'rejected') && !req.pendingSellerDecision && req.conversationId && (
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <Link
                          to={`/chat/${req.conversationId}`}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.85rem', textAlign: 'center' }}
                        >
                          View Chat History
                        </Link>
                        {req.reviewStatus === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReviewConvId(req.conversationId);
                              setShowReviewModal(true);
                            }}
                            className="btn btn-primary"
                            style={{ backgroundColor: '#f59e0b', color: '#000', fontWeight: 'bold', fontSize: '0.82rem', padding: '6px 12px' }}
                          >
                            ★ Rate Now
                          </button>
                        )}
                        {req.reviewStatus === 'submitted' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReviewConvId(req.conversationId);
                              setShowReviewModal(true);
                            }}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                          >
                            View Submitted Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rating & Review Modal */}
          <ReviewModal
            conversationId={activeReviewConvId}
            isOpen={showReviewModal}
            onClose={() => {
              setShowReviewModal(false);
              setActiveReviewConvId(null);
            }}
            onReviewSubmitted={(rev) => {
              setRequests((prev) =>
                prev.map((r) =>
                  r.conversationId === activeReviewConvId
                    ? { ...r, reviewStatus: 'submitted', myReview: rev }
                    : r
                )
              );
            }}
          />
        </div>
      </div>
    </>
  );
};

export default MyPurchases;
