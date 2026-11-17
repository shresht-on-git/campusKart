import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(formData.email, formData.password);
      navigate('/marketplace');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="login-page-container">
      {/* Left Panel — Hero Branding Section */}
      <div className="login-hero-panel">
        {/* Subtle geometric wireframe curve overlay */}
        <div className="login-hero-overlay" aria-hidden="true">
          <svg width="100%" height="100%" viewBox="0 0 600 800" fill="none" preserveAspectRatio="none">
            <path d="M-100 150 C 200 80, 350 450, 700 350" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.5" />
            <path d="M-100 250 C 220 180, 370 550, 700 450" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1.5" />
            <path d="M-100 350 C 240 280, 390 650, 700 550" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1.5" />
            <circle cx="650" cy="120" r="300" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1.5" />
            <circle cx="650" cy="120" r="450" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1.5" />
            <circle cx="-50" cy="750" r="280" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="login-hero-content">
          {/* Minimalist white geometric asterisk / spark icon */}
          <div className="login-hero-spark" aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="19.5" y="2" width="5" height="40" rx="2.5" fill="#FFFFFF" />
              <rect x="2" y="19.5" width="40" height="5" rx="2.5" fill="#FFFFFF" />
              <rect x="19.5" y="2" width="5" height="40" rx="2.5" fill="#FFFFFF" transform="rotate(45 22 22)" />
              <rect x="19.5" y="2" width="5" height="40" rx="2.5" fill="#FFFFFF" transform="rotate(-45 22 22)" />
            </svg>
          </div>

          <h1 className="login-hero-heading">
            <span>Hello</span>
            <span>CampusKart! 👋</span>
          </h1>

          <p className="login-hero-subtext">
            Buy, sell, and trade campus essentials effortlessly. Connect with students across campus and find great deals in seconds!
          </p>
        </div>

        <footer className="login-hero-footer">
          &copy; 2026 CampusKart. All rights reserved.
        </footer>
      </div>

      {/* Right Panel — Login Form Section */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="login-brand-header">CampusKart</div>
          
          <h2 className="login-welcome-heading">Welcome Back!</h2>
          
          <p className="login-register-prompt">
            Don't have an account?{' '}
            <Link to="/register" className="login-register-link">
              Register here
            </Link>
          </p>

          {error && <div className="login-error-alert">{error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field-group">
              <label htmlFor="email" className="login-label">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                className="login-input"
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@thapar.edu"
                required
                autoComplete="email"
              />
            </div>

            <div className="login-field-group">
              <label htmlFor="password" className="login-label">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                className="login-input"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="login-submit-btn">
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
