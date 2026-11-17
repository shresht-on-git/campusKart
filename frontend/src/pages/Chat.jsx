import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar';
import ReviewModal from '../components/ReviewModal';
import { AuthContext } from '../context/AuthContext';

const Chat = () => {
  const { conversationId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals and action states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBuyerEndModal, setShowBuyerEndModal] = useState(false);
  const [showSellerDecisionModal, setShowSellerDecisionModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState(null);
  const [sellerMessage, setSellerMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check review eligibility & status
  const checkReviewEligibility = useCallback(async (autoOpen = false) => {
    if (!conversationId || !user?.token) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/reviews/status/${conversationId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setReviewStatus(res.data);
      if (autoOpen && res.data.canReview && !res.data.hasReviewed && !res.data.pendingSellerDecision) {
        setShowReviewModal(true);
      }
    } catch (err) {
      console.error('Error fetching review status:', err);
    }
  }, [conversationId, user?.token]);

  // Load conversation and messages via REST
  const fetchChatData = useCallback(async () => {
    try {
      setLoading(true);
      const [convRes, msgRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/chats/${conversationId}`, {
          headers: { Authorization: `Bearer ${user?.token}` }
        }),
        axios.get(`http://localhost:5000/api/chats/${conversationId}/messages`, {
          headers: { Authorization: `Bearer ${user?.token}` }
        })
      ]);

      const convData = convRes.data;
      setConversation(convData);
      setMessages(msgRes.data.messages || []);
      setError(null);

      const isUserSeller = user && (convData.seller?._id === user._id || convData.seller === user._id);
      const isPending = convData.purchaseRequest?.pendingSellerDecision;

      if (isUserSeller && isPending) {
        setShowSellerDecisionModal(true);
      }

      if (convData.status === 'closed' && !isPending) {
        checkReviewEligibility(true);
      } else {
        checkReviewEligibility(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, checkReviewEligibility]);

  useEffect(() => {
    if (user?.token && conversationId) {
      fetchChatData();
    }
  }, [conversationId, user?.token, fetchChatData]);

  // Socket.IO setup for real-time messaging
  useEffect(() => {
    if (!user?.token || !conversationId) return;

    const socket = io('http://localhost:5000', {
      auth: { token: user.token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-conversation', conversationId);
    });

    socket.on('new-message', (incomingMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === incomingMsg._id)) return prev;
        return [...prev, incomingMsg];
      });
    });

    socket.on('conversation-closed', (data) => {
      setConversation((prev) => prev ? {
        ...prev,
        status: 'closed',
        closedReason: data.reason || 'Conversation closed'
      } : prev);
      setTimeout(() => checkReviewEligibility(true), 300);
    });

    socket.on('buyer-ended-negotiation', (data) => {
      setConversation((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          status: 'closed',
          closedReason: 'Buyer ended negotiation - awaiting seller decision'
        };
        if (typeof updated.purchaseRequest === 'object' && updated.purchaseRequest) {
          updated.purchaseRequest = {
            ...updated.purchaseRequest,
            pendingSellerDecision: true,
            buyerEndedNegotiation: true
          };
        }
        return updated;
      });

      // If current user is seller, immediately pop up decision modal
      const isUserSeller = user && (conversation?.seller?._id === user._id || conversation?.seller === user._id);
      if (isUserSeller) {
        setShowSellerDecisionModal(true);
      }
    });

    socket.on('seller-decision-resolved', (data) => {
      setConversation((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          status: 'closed',
          closedReason: 'Negotiation ended - No transaction'
        };
        if (typeof updated.purchaseRequest === 'object' && updated.purchaseRequest) {
          updated.purchaseRequest = {
            ...updated.purchaseRequest,
            pendingSellerDecision: false,
            status: 'rejected'
          };
        }
        return updated;
      });
      setShowSellerDecisionModal(false);
      setTimeout(() => checkReviewEligibility(true), 300);
    });

    socket.on('sale-confirmed', () => {
      setConversation((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          status: 'closed',
          closedReason: 'Sale finalized'
        };
        if (typeof updated.purchaseRequest === 'object' && updated.purchaseRequest) {
          updated.purchaseRequest = {
            ...updated.purchaseRequest,
            pendingSellerDecision: false,
            status: 'accepted'
          };
        }
        return updated;
      });
      setShowSellerDecisionModal(false);
      setTimeout(() => checkReviewEligibility(true), 300);
    });

    socket.on('error', (errData) => {
      alert(errData.message || 'Chat error');
    });

    return () => {
      socket.emit('leave-conversation', conversationId);
      socket.disconnect();
    };
  }, [conversationId, user?.token, conversation?.seller, checkReviewEligibility]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMessageText.trim();
    if (!trimmed) return;

    if (conversation?.status === 'closed' || conversation?.purchaseRequest?.pendingSellerDecision) {
      alert('This conversation is closed. Messages cannot be sent.');
      return;
    }

    setNewMessageText('');

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send-message', {
        conversationId,
        message: trimmed
      });
    } else {
      try {
        const res = await axios.post(
          `http://localhost:5000/api/chats/${conversationId}/messages`,
          { message: trimmed },
          { headers: { Authorization: `Bearer ${user?.token}` } }
        );
        setMessages((prev) => {
          if (prev.some((m) => m._id === res.data._id)) return prev;
          return [...prev, res.data];
        });
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to send message');
      }
    }
  };

  // Seller Action: Direct Confirm Sale (Case 1) or via decision modal (Case 4)
  const handleConfirmSale = async () => {
    const purchaseReqId = conversation?.purchaseRequest?._id || conversation?.purchaseRequest;
    if (!purchaseReqId) return;

    try {
      setActionLoading(true);
      await axios.put(
        `http://localhost:5000/api/purchases/${purchaseReqId}/confirm-sale`,
        { sellerMessage: sellerMessage.trim() || undefined },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );

      setShowConfirmModal(false);
      setShowSellerDecisionModal(false);
      setConversation((prev) => ({
        ...prev,
        status: 'closed',
        closedReason: 'Sale finalized',
        purchaseRequest: typeof prev?.purchaseRequest === 'object'
          ? { ...prev.purchaseRequest, pendingSellerDecision: false, status: 'accepted' }
          : prev?.purchaseRequest
      }));
      setTimeout(() => checkReviewEligibility(true), 300);
      alert('Sale finalized successfully! Other buyer requests have been cancelled.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to confirm sale');
    } finally {
      setActionLoading(false);
    }
  };

  // Seller Action: Direct End Negotiation (Case 2)
  const handleEndNegotiation = async () => {
    if (!window.confirm('Are you sure you want to end negotiation and reject this buyer?')) return;

    const purchaseReqId = conversation?.purchaseRequest?._id || conversation?.purchaseRequest;
    if (!purchaseReqId) return;

    try {
      setActionLoading(true);
      await axios.put(
        `http://localhost:5000/api/purchases/${purchaseReqId}/end-negotiation`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );

      setConversation((prev) => ({
        ...prev,
        status: 'closed',
        closedReason: 'Seller ended negotiation',
        purchaseRequest: typeof prev?.purchaseRequest === 'object'
          ? { ...prev.purchaseRequest, pendingSellerDecision: false, status: 'rejected' }
          : prev?.purchaseRequest
      }));
      setTimeout(() => checkReviewEligibility(true), 300);
      alert('Negotiation ended. This buyer has been rejected.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end negotiation');
    } finally {
      setActionLoading(false);
    }
  };

  // Buyer Action: End Negotiation (sets pending seller decision)
  const handleBuyerEndNegotiation = async () => {
    const purchaseReqId = conversation?.purchaseRequest?._id || conversation?.purchaseRequest;
    if (!purchaseReqId) return;

    try {
      setActionLoading(true);
      await axios.put(
        `http://localhost:5000/api/purchases/${purchaseReqId}/buyer-end-negotiation`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );

      setShowBuyerEndModal(false);
      setConversation((prev) => ({
        ...prev,
        status: 'closed',
        closedReason: 'Buyer ended negotiation - awaiting seller decision',
        purchaseRequest: typeof prev?.purchaseRequest === 'object'
          ? { ...prev.purchaseRequest, pendingSellerDecision: true, buyerEndedNegotiation: true }
          : prev?.purchaseRequest
      }));
      checkReviewEligibility(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end negotiation');
    } finally {
      setActionLoading(false);
    }
  };

  // Seller Action on Buyer End Negotiation: (Case 3 No Sale OR Case 4 Confirm Sale)
  const handleSellerDecision = async (decision) => {
    const purchaseReqId = conversation?.purchaseRequest?._id || conversation?.purchaseRequest;
    if (!purchaseReqId) return;

    if (decision === 'confirm_sale') {
      setShowSellerDecisionModal(false);
      setShowConfirmModal(true);
      return;
    }

    // decision === 'no_sale' (Case 3)
    try {
      setActionLoading(true);
      await axios.put(
        `http://localhost:5000/api/purchases/${purchaseReqId}/seller-decision`,
        { decision: 'no_sale' },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );

      setShowSellerDecisionModal(false);
      setConversation((prev) => ({
        ...prev,
        status: 'closed',
        closedReason: 'Negotiation ended - No transaction',
        purchaseRequest: typeof prev?.purchaseRequest === 'object'
          ? { ...prev.purchaseRequest, pendingSellerDecision: false, status: 'rejected' }
          : prev?.purchaseRequest
      }));
      setTimeout(() => checkReviewEligibility(true), 300);
      alert('Transaction recorded as not completed. Negotiation review is now available.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record decision');
    } finally {
      setActionLoading(false);
    }
  };

  const isSeller = user && (conversation?.seller?._id === user._id || conversation?.seller === user._id);
  const otherParticipant = isSeller ? conversation?.buyer : conversation?.seller;
  const isPendingDecision = conversation?.purchaseRequest?.pendingSellerDecision;
  const isClosed = conversation?.status === 'closed' || isPendingDecision;

  const getClosedReasonDisplay = () => {
    if (isPendingDecision) {
      return isSeller 
        ? 'Buyer ended negotiation. Awaiting your confirmation on whether the transaction took place.' 
        : 'You ended this negotiation. Awaiting seller confirmation.';
    }

    if (!conversation?.closedReason) return 'This negotiation has ended. Messages are read-only.';
    
    if (conversation.closedReason === 'Buyer ended negotiation') {
      return isSeller ? 'Buyer ended this negotiation.' : 'You ended this negotiation.';
    }
    if (conversation.closedReason === 'Seller ended negotiation') {
      return isSeller ? 'You ended this negotiation.' : 'Seller ended this negotiation.';
    }
    if (conversation.closedReason === 'Negotiation ended - No transaction') {
      return 'Negotiation ended without transaction.';
    }
    if (conversation.closedReason === 'Product deleted by seller.') {
      return 'Product deleted by seller.';
    }
    if (conversation.closedReason === 'Listing sold to another buyer') {
      return 'This item has been sold to another buyer. Negotiation closed.';
    }
    if (conversation.closedReason === 'Sale finalized') {
      return 'Sale finalized! This conversation is now archived.';
    }
    return conversation.closedReason;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page-wrapper">
          <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
            Loading conversation...
          </div>
        </div>
      </>
    );
  }

  if (error || !conversation) {
    return (
      <>
        <Navbar />
        <div className="page-wrapper">
          <div className="container" style={{ textAlign: 'center', padding: '60px 0', color: 'red' }}>
            <h3>Error loading chat</h3>
            <p>{error || 'Conversation not found'}</p>
            <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ marginTop: '16px' }}>
              &larr; Go Back
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-wrapper" style={{ paddingBottom: '20px' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          {/* Header navigation bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <button onClick={() => navigate(isSeller ? '/seller-requests' : '/my-purchases')} className="btn btn-secondary" style={{ padding: '8px 14px' }}>
              &larr; Back to {isSeller ? 'Seller Requests' : 'My Purchases'}
            </button>

            {/* Action Buttons */}
            {!isClosed && (
              <div style={{ display: 'flex', gap: '10px' }}>
                {isSeller && (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#166534', padding: '8px 16px' }}
                    disabled={actionLoading}
                  >
                    ✓ Confirm Sale
                  </button>
                )}
                <button
                  onClick={isSeller ? handleEndNegotiation : () => setShowBuyerEndModal(true)}
                  className="btn btn-secondary"
                  style={{ color: '#ef4444', borderColor: '#ef4444', padding: '8px 14px' }}
                  disabled={actionLoading}
                >
                  End Negotiation
                </button>
              </div>
            )}
          </div>

          {/* Chat Main Card */}
          <div className="card chat-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: '520px', overflow: 'hidden' }}>
            {/* Conversation Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  Chat with {otherParticipant?.name}
                  <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    (Hostel {otherParticipant?.hostel})
                  </span>
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {otherParticipant?.email} • {isSeller ? 'Buyer' : 'Seller'}
                </div>
              </div>

              {conversation.listing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface-alt, #f8fafc)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {conversation.listing.images?.[0] && (
                    <img
                      src={conversation.listing.images[0].startsWith('http') ? conversation.listing.images[0] : `http://localhost:5000${conversation.listing.images[0]}`}
                      alt="item"
                      style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }}
                      onError={(e) => { e.target.src = 'https://placehold.co/800x600?text=No+Image'; }}
                    />
                  )}
                  <div>
                    <Link to={`/listings/${conversation.listing._id}`} style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {conversation.listing.title}
                    </Link>
                    <div style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '0.85rem' }}>
                      ₹{conversation.listing.price}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Persistent Banner: Pending Seller Decision */}
            {isPendingDecision && (
              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px 20px', fontSize: '0.92rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>⏳ Buyer Ended Negotiation:</span>
                  <span>{isSeller ? 'Did the transaction take place?' : 'Waiting for seller to confirm whether transaction occurred.'}</span>
                </div>
                {isSeller && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleSellerDecision('confirm_sale')}
                      className="btn btn-primary"
                      style={{ backgroundColor: '#166534', padding: '6px 12px', fontSize: '0.85rem' }}
                      disabled={actionLoading}
                    >
                      ✓ Confirm Sale
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSellerDecision('no_sale')}
                      className="btn btn-secondary"
                      style={{ backgroundColor: '#ef4444', color: '#ffffff', borderColor: '#ef4444', padding: '6px 12px', fontSize: '0.85rem' }}
                      disabled={actionLoading}
                    >
                      ✗ No Sale
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Closed Status Notice Banner (When not pending decision) */}
            {isClosed && !isPendingDecision && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>🔒 Conversation Closed:</span>
                  <span>{getClosedReasonDisplay()}</span>
                </div>
                {reviewStatus && !reviewStatus.pendingSellerDecision && (
                  <div>
                    {reviewStatus.canReview ? (
                      <button
                        type="button"
                        onClick={() => setShowReviewModal(true)}
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.85rem', backgroundColor: '#f59e0b', color: '#000', fontWeight: 'bold', border: 'none' }}
                      >
                        ★ Rate Now
                      </button>
                    ) : reviewStatus.hasReviewed ? (
                      <button
                        type="button"
                        onClick={() => setShowReviewModal(true)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                      >
                        ✓ View Your Review
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-color)' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '4px' }}>💬 No messages yet.</p>
                  <p style={{ fontSize: '0.85rem' }}>Start the negotiation by sending a message below.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender?._id === user?._id || msg.sender === user?._id;
                  const timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg._id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        alignSelf: isMine ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', padding: '0 4px' }}>
                        {isMine ? 'You' : msg.sender?.name || otherParticipant?.name} • {timeFormatted}
                      </div>
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          backgroundColor: isMine ? 'var(--primary)' : 'var(--surface)',
                          color: isMine ? '#ffffff' : 'var(--text-main)',
                          border: isMine ? 'none' : '1px solid var(--border)',
                          boxShadow: 'var(--shadow-sm)',
                          wordBreak: 'break-word',
                          lineHeight: '1.4'
                        }}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <form onSubmit={handleSendMessage} style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="form-control"
                placeholder={isClosed ? 'This conversation is closed (Read-only)' : 'Type your offer or message...'}
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                disabled={isClosed}
                maxLength={2000}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isClosed || !newMessageText.trim()}
                style={{ padding: '10px 20px' }}
              >
                Send
              </button>
            </form>
          </div>

          {/* Confirm Sale Modal (Seller Only) */}
          {showConfirmModal && (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="modal-content" style={{ background: 'var(--surface)', color: 'var(--text-main)', padding: '24px', borderRadius: '12px', maxWidth: '460px', width: '90%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                <h3 style={{ marginBottom: '12px', fontSize: '1.25rem', color: 'var(--text-main)' }}>
                  Finalize Sale with {otherParticipant?.name}?
                </h3>
                <p style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Are you sure you want to finalize this sale? This will mark the listing as <strong>Sold</strong> and automatically cancel all other pending and negotiating requests for this item.
                </p>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Message to other buyers (optional):
                  </label>
                  <textarea
                    value={sellerMessage}
                    onChange={(e) => setSellerMessage(e.target.value)}
                    placeholder="Example: Sorry, I have finalized the deal with another buyer. Thank you for your interest."
                    rows="3"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-alt, #0f172a)',
                      color: 'var(--text-main)',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowConfirmModal(false); setSellerMessage(''); }}
                    className="btn btn-secondary"
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSale}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#166534' }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Finalizing...' : 'Confirm Sale'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* End Negotiation Confirmation Modal (Buyer) */}
          {showBuyerEndModal && (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="modal-content" style={{ background: 'var(--surface)', color: 'var(--text-main)', padding: '24px', borderRadius: '12px', maxWidth: '440px', width: '90%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                <h3 style={{ marginBottom: '12px', fontSize: '1.25rem', color: 'var(--text-main)' }}>
                  End Negotiation?
                </h3>
                <p style={{ marginBottom: '20px', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                  Are you sure you want to end this negotiation?
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowBuyerEndModal(false)}
                    className="btn btn-secondary"
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyerEndNegotiation}
                    className="btn btn-secondary"
                    style={{ backgroundColor: '#ef4444', color: '#ffffff', borderColor: '#ef4444' }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Ending...' : 'End Negotiation'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Seller Decision Modal (When Buyer Ends Negotiation) */}
          {showSellerDecisionModal && isSeller && (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
              <div className="modal-content" style={{ background: '#1e293b', color: '#ffffff', padding: '24px', borderRadius: '12px', maxWidth: '480px', width: '100%', border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff', fontWeight: '700' }}>
                    Buyer Ended Negotiation
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowSellerDecisionModal(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.6rem', cursor: 'pointer', lineHeight: 1 }}
                  >
                    &times;
                  </button>
                </div>
                <p style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '600', lineHeight: '1.5', marginBottom: '12px' }}>
                  The buyer has ended the negotiation. Did the transaction take place?
                </p>
                <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.4', marginBottom: '20px' }}>
                  Your decision will determine the final status of this listing and the rating criteria for both participants.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleSellerDecision('confirm_sale')}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#166534', color: '#ffffff', padding: '12px', fontWeight: '700', borderRadius: '8px' }}
                    disabled={actionLoading}
                  >
                    ✓ Confirm Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSellerDecision('no_sale')}
                    className="btn btn-secondary"
                    style={{ backgroundColor: '#ef4444', color: '#ffffff', borderColor: '#ef4444', padding: '12px', fontWeight: '700', borderRadius: '8px' }}
                    disabled={actionLoading}
                  >
                    ✗ No, Transaction Not Completed
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSellerDecisionModal(false)}
                    className="btn btn-secondary"
                    style={{ backgroundColor: 'transparent', color: '#94a3b8', borderColor: '#475569', padding: '8px', fontSize: '0.85rem' }}
                  >
                    Decide Later
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rating & Review Modal */}
          <ReviewModal
            conversationId={conversationId}
            isOpen={showReviewModal}
            onClose={() => setShowReviewModal(false)}
            onReviewSubmitted={(rev) => {
              setReviewStatus((prev) => ({
                ...prev,
                hasReviewed: true,
                canReview: false,
                myReview: rev
              }));
            }}
          />
        </div>
      </div>
    </>
  );
};

export default Chat;
