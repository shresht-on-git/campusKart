import React, { useState } from 'react';

const StarSelector = ({ value = 0, onChange, readOnly = false, size = '1.4rem' }) => {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue || value;

  return (
    <div style={{ display: 'inline-flex', gap: '4px', cursor: readOnly ? 'default' : 'pointer' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= displayValue;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange && onChange(star)}
            onMouseEnter={() => !readOnly && setHoverValue(star)}
            onMouseLeave={() => !readOnly && setHoverValue(0)}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: readOnly ? 'default' : 'pointer',
              fontSize: size,
              lineHeight: 1,
              color: isFilled ? '#f59e0b' : '#94a3b8',
              transition: 'color 0.15s ease, transform 0.1s ease',
              transform: !readOnly && hoverValue === star ? 'scale(1.2)' : 'none'
            }}
            title={`${star} star${star > 1 ? 's' : ''}`}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};

export default StarSelector;

