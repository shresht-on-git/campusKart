import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import StarSelector from './StarSelector';
import { API_URL } from '../config';

const ReviewModal = ({ conversationId, isOpen, onClose, onReviewSubmitted }) => {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  const [reviewStatus, setReviewStatus] = useState(null);
  const [criteriaRatings, setCriteriaRatings] = useState({});
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!isOpen || !conversationId || !user?.token) return;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        setValidationErrors({});

        const res = await axios.get(`${API_URL}/reviews/status/${conversationId}`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });

        setReviewStatus(res.data);

        if (res.data.hasReviewed && res.data.myReview) {
          // Preload existing review in read-only view
          setComment(res.data.myReview.comment || '');
          const existingCriteria = res.data.myReview.criteria || {};
          setCriteriaRatings(
            existingCriteria instanceof Map 
              ? Object.fromEntries(existingCriteria) 
              : existingCriteria
          );
        } else {
          setCriteriaRatings({});
          setComment('');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load review details');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [isOpen, conversationId, user?.token]);

  if (!isOpen) return null;

  const isAlreadyReviewed = reviewStatus?.hasReviewed;
  const isPendingDecision = reviewStatus?.pendingSellerDecision;
  const activeCriteriaList = reviewStatus?.applicableCriteria || [];
  const interactionType = reviewStatus?.myReview?.interactionType || reviewStatus?.interactionType;

  const handleStarChange = (criterionKey, starValue) => {
    setCriteriaRatings((prev) => ({
      ...prev,
      [criterionKey]: starValue
    }));

    if (validationErrors[criterionKey]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[criterionKey];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reviewStatus || reviewStatus.hasReviewed || isPendingDecision) return;

    const errors = {};

    activeCriteriaList.forEach((c) => {
      if (!criteriaRatings[c.key] || criteriaRatings[c.key] < 1) {
        errors[c.key] = `Please select a rating for ${c.label}`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please rate all required criteria before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await axios.post(
        `${API_URL}/reviews`,
        {
          conversationId,
          criteria: criteriaRatings,
          comment: comment.trim()
        },
        {
          headers: { Authorization: `Bearer ${user.token}` }
        }
      );

      setSuccessMessage('Thank you! Your review has been submitted successfully.');
      setReviewStatus((prev) => ({
        ...prev,
        hasReviewed: true,
        canReview: false,
        myReview: res.data
      }));

      if (onReviewSubmitted) {
        onReviewSubmitted(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '16px'
      }}
    >
      <div
        className="modal-content"
        style={{
          background: '#1e293b',
          color: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1e293b'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff', fontWeight: '700' }}>
              {isAlreadyReviewed ? 'Your Submitted Review' : 'Rate Your Experience'}
            </h3>
            {reviewStatus?.reviewee && (
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '3px' }}>
                {isAlreadyReviewed ? 'Reviewed' : 'Rating'}{' '}
                <strong style={{ color: '#ffffff' }}>{reviewStatus.reviewee.name}</strong>{' '}
                as {reviewStatus.revieweeRole === 'seller' ? 'Seller' : 'Buyer'}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.6rem',
              cursor: 'pointer',
              color: '#cbd5e1',
              lineHeight: 1,
              padding: '4px'
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, backgroundColor: '#1e293b' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#cbd5e1', fontSize: '0.95rem' }}>
              Loading review form...
            </div>
          ) : error && !reviewStatus ? (
            <div style={{ color: '#f87171', textAlign: 'center', padding: '24px', fontWeight: '600' }}>
              {error}
            </div>
          ) : isPendingDecision ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', background: '#0f172a', borderRadius: '8px', border: '1px solid #475569' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
              <h4 style={{ color: '#f59e0b', margin: '0 0 8px 0', fontSize: '1.1rem' }}>
                Awaiting Seller Confirmation
              </h4>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                The buyer has ended the negotiation. The seller will confirm whether the transaction took place.
                Once confirmed, the rating form will automatically become available.
              </p>
            </div>
          ) : (
            <>
              {/* Encouraging message */}
              {!isAlreadyReviewed && (
                <div
                  style={{
                    backgroundColor: 'rgba(2, 132, 199, 0.18)',
                    borderLeft: '4px solid #38bdf8',
                    padding: '12px 14px',
                    borderRadius: '6px',
                    marginBottom: '18px',
                    fontSize: '0.9rem',
                    color: '#ffffff',
                    lineHeight: '1.45',
                    fontWeight: '500'
                  }}
                >
                  Help make CampusKart more reliable and transparent! Share an honest rating of your experience so other students can make better-informed decisions.
                </div>
              )}

              {/* Interaction category badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: interactionType === 'completed_transaction' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                  border: interactionType === 'completed_transaction' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>
                  {interactionType === 'completed_transaction' ? '🤝' : '💬'}
                </span>
                <span style={{ fontSize: '0.88rem', color: '#ffffff', fontWeight: '600' }}>
                  {interactionType === 'completed_transaction' 
                    ? 'Transaction Completed (6 criteria)' 
                    : 'Negotiation Experience (3 criteria)'}
                </span>
              </div>

              {successMessage && (
                <div
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    color: '#86efac',
                    border: '1px solid #22c55e',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                >
                  ✓ {successMessage}
                </div>
              )}

              {error && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: '#fca5a5',
                    border: '1px solid #ef4444',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '0.88rem',
                    fontWeight: '600'
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Criteria List */}
                {activeCriteriaList.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
                    {activeCriteriaList.map((crit) => {
                      const currentRating = criteriaRatings[crit.key] || 0;
                      const hasError = !!validationErrors[crit.key];

                      return (
                        <div
                          key={crit.key}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 14px',
                            background: '#0f172a',
                            borderRadius: '8px',
                            border: hasError ? '1px solid #ef4444' : '1px solid #334155',
                            flexWrap: 'wrap',
                            gap: '10px'
                          }}
                        >
                          <div>
                            {/* Parameter Name: WHITE and BOLD */}
                            <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem' }}>
                              {crit.label}
                              {!isAlreadyReviewed && (
                                <span style={{ color: '#ef4444', marginLeft: '4px', fontWeight: '700' }}>*</span>
                              )}
                            </div>
                            {hasError && (
                              <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: '3px', fontWeight: '600' }}>
                                {validationErrors[crit.key]}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <StarSelector
                              value={currentRating}
                              onChange={(val) => handleStarChange(crit.key, val)}
                              readOnly={isAlreadyReviewed}
                            />
                            {/* Selected rating number: clearly visible */}
                            <span
                              style={{
                                fontSize: '0.95rem',
                                fontWeight: '700',
                                color: currentRating > 0 ? '#f59e0b' : '#94a3b8',
                                minWidth: '26px',
                                textAlign: 'right'
                              }}
                            >
                              {currentRating > 0 ? `${currentRating}★` : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Overall Rating Display (if reviewed) */}
                {isAlreadyReviewed && reviewStatus?.myReview?.rating && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      marginBottom: '16px'
                    }}
                  >
                    <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>Overall Average Score:</strong>
                    <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#f59e0b' }}>
                      {Number(reviewStatus.myReview.rating).toFixed(1)} ★
                    </span>
                  </div>
                )}

                {/* Comment Box */}
                {(activeCriteriaList.length > 0 || isAlreadyReviewed) && (
                  <div style={{ marginBottom: '18px' }}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '0.92rem',
                        fontWeight: '700',
                        color: '#ffffff'
                      }}
                    >
                      Written Comment {isAlreadyReviewed ? '' : '(Optional)'}:
                    </label>
                    {isAlreadyReviewed ? (
                      <div
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: '#0f172a',
                          border: '1px solid #334155',
                          fontSize: '0.9rem',
                          color: comment ? '#ffffff' : '#94a3b8',
                          fontStyle: comment ? 'normal' : 'italic'
                        }}
                      >
                        {comment || 'No written comment provided.'}
                      </div>
                    ) : (
                      <textarea
                        rows="3"
                        className="form-control"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share details about the interaction (optional)..."
                        maxLength={1000}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #475569',
                          background: '#0f172a',
                          color: '#ffffff',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    )}
                    {!isAlreadyReviewed && (
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        {comment.length}/1000
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    paddingTop: '14px',
                    borderTop: '1px solid #334155'
                  }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-secondary"
                    style={{
                      padding: '9px 18px',
                      color: '#ffffff',
                      borderColor: '#475569',
                      backgroundColor: 'transparent'
                    }}
                  >
                    {isAlreadyReviewed ? 'Close' : 'Cancel'}
                  </button>

                  {!isAlreadyReviewed && (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn btn-primary"
                      style={{
                        padding: '9px 22px',
                        backgroundColor: '#f59e0b',
                        color: '#000000',
                        fontWeight: '700',
                        border: 'none',
                        cursor: submitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
