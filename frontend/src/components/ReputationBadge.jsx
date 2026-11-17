import React from 'react';

const ReputationBadge = ({ rating = 0, reviewCount = 0, completedTransactions = 0, showRole = false, role = 'Seller' }) => {
  const isRated = reviewCount > 0;
  const formattedRating = Number(rating || 0).toFixed(1);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.85rem' }}>
      {showRole && (
        <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>
          {role} Reputation:
        </span>
      )}
      {isRated ? (
        <>
          <span style={{ color: '#f59e0b', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            {formattedRating} ★
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
          </span>
        </>
      ) : (
        <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
          New
        </span>
      )}
      <span style={{ color: 'var(--border, #64748b)', margin: '0 2px' }}>|</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        {completedTransactions || 0} completed transactions
      </span>
    </div>
  );
};

export default ReputationBadge;

