import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { API_URL, getImageUrl } from '../config';

const EditListing = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: '',
    status: ''
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const categories = [
    'Electronics', 'Books', 'Notes', 'Cycles', 
    'Hostel Essentials', 'Study Materials', 'Sports', 'Accessories', 'Other'
  ];

  const conditions = ['New', 'Like New', 'Good', 'Fair'];

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await axios.get(`${API_URL}/listings/${id}`, {
          headers: { Authorization: `Bearer ${user?.token}` }
        });
        
        const listing = res.data;
        
        if (listing.seller._id !== user?._id) {
          navigate('/marketplace');
          return;
        }

        if (listing.status === 'sold') {
          setError('Sold listings cannot be edited.');
          return;
        }

        if (listing.isDeleted) {
          setError('Deleted listings cannot be edited.');
          return;
        }

        setFormData({
          title: listing.title,
          description: listing.description,
          price: listing.price,
          category: listing.category,
          condition: listing.condition
        });

        if (listing.images?.length > 0) {
          setCurrentImage(getImageUrl(listing.images[0]));
        }
      } catch (err) {
        setError('Failed to load listing.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.token) {
      fetchListing();
    }
  }, [id, user, navigate]);

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
    setSaving(true);
    setError(null);

    try {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('description', formData.description);
      payload.append('price', Number(formData.price));
      payload.append('category', formData.category);
      payload.append('condition', formData.condition);
      
      if (imageFile) {
        payload.append('image', imageFile);
      }

      await axios.put(`${API_URL}/listings/${id}`, payload, {
        headers: { 
          Authorization: `Bearer ${user?.token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      navigate(`/listings/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update listing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <><Navbar /><div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div></>;
  if (error) return <><Navbar /><div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{error}</div></>;

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container">
          <div className="auth-container" style={{ maxWidth: '600px', marginTop: '20px' }}>
            <h2 className="auth-title">Edit Listing</h2>
            
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
                <label className="form-label">Listing Image (Select to replace)</label>
                <input 
                  type="file" 
                  name="image"
                  accept="image/jpeg, image/png, image/webp"
                  className="form-control" 
                  onChange={handleFileChange}
                />
                
                {(imagePreview || currentImage) && (
                  <div style={{ marginTop: '10px' }}>
                    <p style={{ marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {imagePreview ? 'New Preview:' : 'Current Image:'}
                    </p>
                    <img 
                      src={imagePreview || currentImage} 
                      alt="Preview" 
                      style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #ddd' }} 
                    />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '14px' }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '14px' }}
                  onClick={() => navigate(`/listings/${id}`)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditListing;
