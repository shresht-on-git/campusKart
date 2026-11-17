import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to={user ? "/marketplace" : "/login"} className="nav-brand">
          🛍️ CampusKart
        </Link>
        <div className="nav-links">
          {user ? (
            <>
              <Link to="/marketplace" className="nav-link">Marketplace</Link>
              <Link to="/my-purchases" className="nav-link">My Purchases</Link>
              <Link to="/seller-requests" className="nav-link">Seller Requests</Link>
              <Link to="/listings/create" className="nav-link">Create Listing</Link>
              <Link to="/profile" className="nav-link">Profile ({user.name})</Link>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="btn btn-primary">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
