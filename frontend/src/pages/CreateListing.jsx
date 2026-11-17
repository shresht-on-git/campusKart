import { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';

const CreateListing = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const categories = [
    'Electronics', 'Books', 'Notes', 'Cycles', 
    'Hostel Essentials', 'Study Materials', 'Sports', 'Accessories', 'Other'
  ];

  const conditions = ['New', 'Like New', 'Good', 'Fair'];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      setError('Please select an image for your listing.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('description', formData.description);
      payload.append('price', Number(formData.price));
      payload.append('category', formData.category);
      payload.append('condition', formData.condition);
      payload.append('image', imageFile);

      const res = await axios.post('http://localhost:5000/api/listings', payload, {
        headers: { 
          Authorization: `Bearer ${user?.token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      navigate(`/listings/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container">
          <div className="auth-container" style={{ maxWidth: '600px', marginTop: '20px' }}>
            <h2 className="auth-title">Create a Listing</h2>
            
            {error && <div style={{ color: 'red', marginBottom: '20px', padding: '10px', background: '#fee2e2', borderRadius: '4px' }}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input 
                  type="text" 
                  name="title"
                  className="form-control" 
                  required 
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="What are you selling?"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  name="description"
                  className="form-control" 
                  rows="4"
                  required 
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe your item, mention any defects, etc."
                ></textarea>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Price (₹)</label>
                  <input 
                    type="number" 
                    name="price"
                    className="form-control" 
                    required 
                    min="0"
                    value={formData.price}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Condition</label>
                  <select 
                    name="condition"
                    className="form-control" 
                    required 
                    value={formData.condition}
                    onChange={handleChange}
                  >
                    <option value="" disabled>Select condition</option>
                    {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  name="category"
                  className="form-control" 
                  required 
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="" disabled>Select category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Listing Image</label>
                <input 
                  type="file" 
                  name="image"
                  accept="image/jpeg, image/png, image/webp"
                  className="form-control" 
                  onChange={handleFileChange}
                  required
                />
                {imagePreview && (
                  <div style={{ marginTop: '10px' }}>
                    <p style={{ marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Preview:</p>
                    <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '32px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading}>
                  {loading ? 'Creating...' : 'Post Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateListing;
