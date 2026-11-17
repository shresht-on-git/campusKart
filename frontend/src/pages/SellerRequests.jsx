import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import ReputationBadge from '../components/ReputationBadge';
import ReviewModal from '../components/ReviewModal';
import { API_URL, getImageUrl } from '../config';

const SellerRequests = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [sortBy, setSortBy] = useState('rating');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeReviewConvId, setActiveReviewConvId] = useState(null);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/purchases/seller?sortBy=${sortBy}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setRequests(res.data);
    } catch (err) {
      setError('Failed to load incoming requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) fetchRequests();
  }, [user, sortBy]);

  const handleAcceptAndChat = async (reqItem) => {
    try {
      setActionLoading(reqItem._id);
      const res = await axios.put(`${API_URL}/purchases/${reqItem._id}/accept`, {}, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      
      const convId = res.data.conversation?._id || res.data.request?.conversationId || reqItem.conversationId;
      
      // Update local state without removing other requests
      setRequests(prev => prev.map(r => {
        if (r._id === reqItem._id) {
          return {
            ...r,
            status: 'negotiating',
            conversationId: convId
          };
        }
        return r;
      }));

      // Navigate to chat
      if (convId) {
        navigate(`/chat/${convId}`);
      } else {
        fetchRequests();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept request for negotiation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndNegotiation = async (id) => {
    if (!window.confirm('Are you sure you want to end negotiation with this buyer?')) return;
    try {
      setActionLoading(id);
      const res = await axios.put(`${API_URL}/purchases/${id}/end-negotiation`, {}, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      
      setRequests(prev => prev.map(r => {
        if (r._id === id) {
          return { ...r, status: res.data.status };
        }
        return r;
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end negotiation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    try {
      setActionLoading(id);
      const res = await axios.put(`${API_URL}/purchases/${id}/reject`, {}, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      
      setRequests(prev => prev.map(r => {
        if (r._id === id) {
          return { ...r, status: res.data.status };
        }
        return r;
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSellerDecision = async (id, decision) => {
    if (decision === 'confirm_sale') {
      const confirmOk = window.confirm('Are you sure you want to confirm this sale? This will mark the listing as SOLD and cancel other requests.');
      if (!confirmOk) return;
    }
    try {
      setActionLoading(id);
      await axios.put(
        `${API_URL}/purchases/${id}/seller-decision`,
        { decision },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit decision');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h2>Seller Requests</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sort by:</label>
              <select
                className="form-control"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
              >
                <option value="rating">Highest Buyer Rating</option>
                <option value="newest">Newest Requests First</option>
              </select>
            </div>
          </div>
          {loading && <div>Loading incoming requests...</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
          {!loading && !error && requests.length === 0 && (
            <div className="empty-state">You have no incoming purchase requests.</div>
          )}
          
          <div className="requests-list" style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
            {requests.map(req => {
              const isListingSold = req.listing?.status === 'sold';

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
                      Buyer: {req.buyer?.name} ({req.buyer?.email}) - Hostel {req.buyer?.hostel}
                    </div>
                    <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                      <ReputationBadge
                        rating={req.buyer?.buyerRating}
                        reviewCount={req.buyer?.buyerReviewCount}
                        completedTransactions={req.buyer?.buyerCompletedTransactions}
                        showRole={true}
                        role="Buyer"
                      />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Requested on: {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {req.pendingSellerDecision ? (
                        <span className="badge" style={{ backgroundColor: '#f59e0b', color: '#000000', fontWeight: 'bold' }}>
                          DECISION NEEDED
                        </span>
                      ) : (
                        <span className={`badge ${
                          req.status === 'accepted' ? 'badge-success' :
                          req.status === 'negotiating' ? 'badge-primary' :
                          req.status === 'pending' ? 'badge-primary' :
                          req.status === 'rejected' ? 'badge-danger' : 'badge-secondary'
                        }`}>
                          {req.status === 'negotiating' ? 'NEGOTIATING' : req.status.toUpperCase()}
                        </span>
                      )}
                      {isListingSold && req.status !== 'accepted' && (
                        <span className="badge badge-secondary">Listing Sold</span>
                      )}
                      {req.reviewStatus === 'pending' && !req.pendingSellerDecision && (
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
                  </div>
                  <div>
                    {req.pendingSellerDecision ? (
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <button
                          type="button"
                          onClick={() => handleSellerDecision(req._id, 'confirm_sale')}
                          className="btn btn-primary"
                          style={{ backgroundColor: '#166534', padding: '6px 12px', fontSize: '0.85rem' }}
                          disabled={actionLoading === req._id}
                        >
                          ✓ Confirm Sale
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSellerDecision(req._id, 'no_sale')}
                          className="btn btn-secondary"
                          style={{ backgroundColor: '#ef4444', color: '#ffffff', borderColor: '#ef4444', padding: '6px 12px', fontSize: '0.85rem' }}
                          disabled={actionLoading === req._id}
                        >
                          ✗ No Sale
                        </button>
                        {req.conversationId && (
                          <Link
                            to={`/chat/${req.conversationId}`}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.82rem', textAlign: 'center', padding: '4px 8px' }}
                          >
                            View Chat
                          </Link>
                        )}
                      </div>
                    ) : req.status === 'pending' && !isListingSold ? (
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <button
                          onClick={() => handleAcceptAndChat(req)}
                          className="btn btn-primary"
                          style={{ backgroundColor: '#166534' }}
                          disabled={actionLoading === req._id}
                        >
                          {actionLoading === req._id ? 'Opening...' : 'Accept & Chat'}
                        </button>
                        <button
                          onClick={() => handleReject(req._id)}
                          className="btn btn-danger"
                          disabled={actionLoading === req._id}
                        >
                          Reject
                        </button>
                      </div>
                    ) : req.status === 'negotiating' ? (
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <Link
                          to={`/chat/${req.conversationId}`}
                          className="btn btn-primary"
                          style={{ backgroundColor: '#0284c7', textAlign: 'center' }}
                        >
                          Open Chat
                        </Link>
                        {!isListingSold && (
                          <button
                            onClick={() => handleEndNegotiation(req._id)}
                            className="btn btn-secondary"
                            style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            disabled={actionLoading === req._id}
                          >
                            End Negotiation
                          </button>
                        )}
                      </div>
                    ) : (req.status === 'accepted' || req.status === 'cancelled' || req.status === 'rejected') && req.conversationId ? (
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
                            ✓ View Review
                          </button>
                        )}
                      </div>
                    ) : null}
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

export default SellerRequests;
