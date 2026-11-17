import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    hostel: 'A'
  });
  const [error, setError] = useState('');
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.endsWith('@thapar.edu')) {
      setError('Only @thapar.edu emails are allowed.');
      return;
    }
    try {
      await register(formData);
      navigate('/marketplace');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Join CampusKart</h2>
        {error && <div className="error">{error}</div>}
        
        <label>Name</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        
        <label>Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} required />
        
        <label>Password</label>
        <input type="password" name="password" value={formData.password} onChange={handleChange} required />
        
        <label>Hostel</label>
        <select name="hostel" value={formData.hostel} onChange={handleChange}>
          {['A', 'B', 'C', 'D', 'H', 'J'].map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        
        <button type="submit">Register</button>
        <p>Already have an account? <Link to="/login">Login here</Link></p>
      </form>
    </div>
  );
};

export default Register;
