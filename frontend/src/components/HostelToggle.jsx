import { useHostelMode } from '../context/HostelModeContext';
import './HostelToggle.css';

const HostelToggle = () => {
  const { hostelMode, isEligible, toggleHostelMode, availabilityMessage, userHostel } = useHostelMode();

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (isEligible) {
        toggleHostelMode();
      }
    }
  };

  return (
    <div className="hostel-toggle-container">
      <div className="hostel-toggle-wrapper">
        <button
          type="button"
          role="switch"
          aria-checked={hostelMode}
          aria-label={
            isEligible
              ? `Toggle Hostel Mode. Currently ${hostelMode ? 'ON' : 'OFF'}`
              : availabilityMessage
          }
          disabled={!isEligible}
          onClick={toggleHostelMode}
          onKeyDown={handleKeyDown}
          className={`hostel-toggle-btn ${hostelMode ? 'mode-on' : 'mode-off'} ${!isEligible ? 'is-disabled' : ''}`}
          title={
            !isEligible
              ? availabilityMessage
              : `Hostel Mode is ${hostelMode ? 'ON' : 'OFF'}`
          }
        >
          {/* Celestial icons backdrop */}
          <div className="toggle-sky-icons">
            {/* Sun Icon with rays for Day mode */}
            <div className="toggle-icon-sun" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5" fill="#ffffff" />
                <path
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Crescent Moon & Stars for Night mode */}
            <div className="toggle-icon-night" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  fill="#f8fafc"
                />
                {/* Little stars */}
                <circle cx="19" cy="5" r="1" fill="#fef08a" />
                <circle cx="16" cy="2" r="0.75" fill="#fef08a" />
                <circle cx="21" cy="9" r="0.75" fill="#fef08a" />
              </svg>
            </div>
          </div>

          {/* Sliding circular knob */}
          <div className="toggle-knob" aria-hidden="true">
            <span className="knob-crater knob-crater-1"></span>
            <span className="knob-crater knob-crater-2"></span>
          </div>
        </button>

        <div className="hostel-toggle-info">
          <div className="hostel-toggle-title">
            <span>Hostel Mode</span>
            {isEligible ? (
              <span className={`hostel-status-tag ${hostelMode ? 'status-active' : 'status-inactive'}`}>
                {hostelMode ? 'ON' : 'OFF'}
              </span>
            ) : (
              <span className="hostel-status-tag status-inactive">LOCKED</span>
            )}
          </div>

          {!isEligible ? (
            <div className="hostel-time-badge" role="status">
              🕒 {availabilityMessage}
            </div>
          ) : (
            <div className="hostel-hint-text">
              {hostelMode
                ? userHostel
                  ? `Prioritizing Hostel ${userHostel} listings`
                  : 'Prioritizing your hostel listings'
                : 'Prioritize same-hostel listings + Night Mode'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostelToggle;
