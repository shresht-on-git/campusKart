import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReputationBadge from '../components/ReputationBadge';
import './Auth.css';

const CATEGORIES = [
  'Electronics', 'Books', 'Notes', 'Cycles', 
  'Hostel Essentials', 'Study Materials', 'Sports', 'Accessories', 'Other'
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const HOSTELS = ['A', 'B', 'C', 'D', 'H', 'J'];

const Profile = () => {
  const { user, updateUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Reputation data state
  const [reputationData, setReputationData] = useState(null);
  const [loadingReputation, setLoadingReputation] = useState(true);

  // Edit Profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileHostel, setProfileHostel] = useState('A');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // My Listings state
  const [myListings, setMyListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [listingTab, setListingTab] = useState('available'); // 'available' | 'sold'
  const [listingMessage, setListingMessage] = useState(null);
  const [listingError, setListingError] = useState(null);

  // Edit Listing Modal state
  const [editingListing, setEditingListing] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: ''
  });
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [savingListing, setSavingListing] = useState(false);
  const [editListingError, setEditListingError] = useState(null);

  // Delete Listing Confirmation Modal state
  const [deletingListing, setDeletingListing] = useState(null);
  const [processingDelete, setProcessingDelete] = useState(false);

  // Initialize profile form values when user changes
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileHostel(user.hostel || 'A');
    }
  }, [user]);

  // Fetch reputation
  useEffect(() => {
    const fetchReputation = async () => {
      if (!user?._id || !user?.token) return;
      try {
        setLoadingReputation(true);
        const res = await axios.get(`http://localhost:5000/api/reviews/user/${user._id}`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setReputationData(res.data);
      } catch (err) {
        console.error('Failed to load reputation details:', err);
      } finally {
        setLoadingReputation(false);
      }
    };

    fetchReputation();
  }, [user?._id, user?.token]);

  // Fetch My Listings
  const fetchMyListings = async () => {
    if (!user?.token) return;
    try {
      setLoadingListings(true);
      const res = await axios.get('http://localhost:5000/api/listings/my', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setMyListings(res.data || []);
    } catch (err) {
      console.error('Failed to load user listings:', err);
      setListingError('Failed to load your listings.');
    } finally {
      setLoadingListings(false);
    }
  };

  useEffect(() => {
    fetchMyListings();
  }, [user?.token]);

  // Save profile changes (Name and Hostel)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    const trimmed = profileName.trim();
    if (!trimmed) {
      setProfileError('Full Name cannot be empty.');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 50) {
      setProfileError('Full Name must be between 2 and 50 characters.');
      return;
    }
    if (!HOSTELS.includes(profileHostel)) {
      setProfileError('Please select a valid Thapar hostel.');
      return;
    }

    try {
      setSavingProfile(true);
      const res = await axios.put(
        'http://localhost:5000/api/auth/profile',
        { name: trimmed, hostel: profileHostel },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );

      // Update AuthContext user state across entire app
      updateUser(res.data);
      setIsEditingProfile(false);
      setProfileMessage('Profile updated successfully! All available listings synchronized with your new hostel.');

      // Refresh listings to reflect the updated hostel on available listings
      fetchMyListings();
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelProfileEdit = () => {
    setProfileName(user?.name || '');
    setProfileHostel(user?.hostel || 'A');
    setProfileError(null);
    setIsEditingProfile(false);
  };

  // Open Edit Listing modal
  const handleOpenEditListing = (listing) => {
    setEditingListing(listing);
    setEditFormData({
      title: listing.title || '',
      description: listing.description || '',
      price: listing.price || '',
      category: listing.category || 'Other',
      condition: listing.condition || 'Good'
    });
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditListingError(null);
  };

  const handleCloseEditListing = () => {
    setEditingListing(null);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditListingError(null);
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditImageFile(file);
      setEditImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveListing = async (e) => {
    e.preventDefault();
    if (!editingListing) return;

    setEditListingError(null);
    const { title, description, price, category, condition } = editFormData;

    if (!title.trim() || !description.trim() || price === '') {
      setEditListingError('Please fill in all required fields.');
      return;
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setEditListingError('Price must be a valid positive number.');
      return;
    }

    try {
      setSavingListing(true);
      const payload = new FormData();
      payload.append('title', title.trim());
      payload.append('description', description.trim());
      payload.append('price', numPrice);
      payload.append('category', category);
      payload.append('condition', condition);

      if (editImageFile) {
        payload.append('image', editImageFile);
      }

      await axios.put(`http://localhost:5000/api/listings/${editingListing._id}`, payload, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      handleCloseEditListing();
      setListingMessage('Listing updated successfully!');
      fetchMyListings();
    } catch (err) {
      setEditListingError(err.response?.data?.message || 'Failed to update listing.');
    } finally {
      setSavingListing(false);
    }
  };

  // Delete listing workflow
  const handleOpenDelete = (listing) => {
    setDeletingListing(listing);
  };

  const handleCloseDelete = () => {
    setDeletingListing(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingListing) return;

    try {
      setProcessingDelete(true);
      await axios.delete(`http://localhost:5000/api/listings/${deletingListing._id}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });

      handleCloseDelete();
      setListingMessage('Listing deleted successfully. Any active buyer requests have been cancelled and notified.');
      fetchMyListings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete listing.');
    } finally {
      setProcessingDelete(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sellerRep = reputationData?.sellerReputation;
  const buyerRep = reputationData?.buyerReputation;

  const availableListings = myListings.filter(l => l.status === 'available');
  const soldListings = myListings.filter(l => l.status === 'sold');
  const displayedListings = listingTab === 'available' ? availableListings : soldListings;

  return (
    <>
      <Navbar />
      <div className="page-wrapper" style={{ padding: '30px 0' }}>
        <div className="container" style={{ maxWidth: '900px' }}>

          {/* ============================================================== */}
          {/* SECTION 1: Personal Information — Edit Profile */}
          {/* ============================================================== */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-main)' }}>
                Personal Information
              </h3>
              {!isEditingProfile && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setIsEditingProfile(true); setProfileMessage(null); setProfileError(null); }}
                    className="btn btn-secondary"
                    style={{ padding: '7px 16px', fontSize: '0.9rem' }}
                  >
                    ✎ Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="btn btn-danger"
                    style={{ padding: '7px 16px', fontSize: '0.9rem' }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Profile Success Message */}
            {profileMessage && (
              <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', border: '1px solid #22c55e', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>
                ✓ {profileMessage}
              </div>
            )}

            {/* Profile Error Message */}
            {profileError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: '1px solid #ef4444', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>
                ✕ {profileError}
              </div>
            )}

            {!isEditingProfile ? (
              /* View Mode */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '14px', background: 'var(--surface-alt, #0f172a)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>{user?.name}</div>
                </div>

                <div style={{ padding: '14px', background: 'var(--surface-alt, #0f172a)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thapar Email (Fixed)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)' }}>{user?.email}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Non-editable student account</div>
                </div>

                <div style={{ padding: '14px', background: 'var(--surface-alt, #0f172a)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Hostel</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f59e0b' }}>Hostel {user?.hostel}</div>
                </div>
              </div>
            ) : (
              /* Edit Mode Form */
              <form onSubmit={handleSaveProfile} style={{ background: 'var(--surface-alt, #0f172a)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '600' }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      maxLength={50}
                      placeholder="Your full name"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '600' }}>Hostel <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      className="form-control"
                      value={profileHostel}
                      onChange={(e) => setProfileHostel(e.target.value)}
                      required
                    >
                      {HOSTELS.map(h => (
                        <option key={h} value={h}>Hostel {h}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Changing hostel automatically updates all your available listings.
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>Thapar Email (Non-editable)</label>
                  <input
                    type="email"
                    className="form-control"
                    value={user?.email || ''}
                    disabled
                    style={{ opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--surface)' }}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Registered Thapar email address is permanently tied to student identity and cannot be edited.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleCancelProfileEdit}
                    className="btn btn-secondary"
                    disabled={savingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingProfile}
                  >
                    {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ============================================================== */}
          {/* SECTION 2: Seller & Buyer Reputation (Collective Only) */}
          {/* ============================================================== */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.35rem', color: 'var(--text-main)' }}>
              Seller & Buyer Reputation
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Collective reputation scores and verified transaction counts across campus interactions.
            </p>

            {loadingReputation ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                Loading reputation details...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Seller Reputation Box */}
                <div
                  style={{
                    padding: '20px',
                    borderRadius: '10px',
                    background: 'var(--surface-alt, #0f172a)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '1.25rem' }}>🏷️</span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '700' }}>
                      Seller Reputation
                    </h4>
                  </div>
                  <ReputationBadge
                    rating={sellerRep?.rating}
                    reviewCount={sellerRep?.reviewCount}
                    completedTransactions={sellerRep?.completedTransactions}
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Based on student ratings when you sold or negotiated to sell items.
                  </div>
                </div>

                {/* Buyer Reputation Box */}
                <div
                  style={{
                    padding: '20px',
                    borderRadius: '10px',
                    background: 'var(--surface-alt, #0f172a)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '1.25rem' }}>🛍️</span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '700' }}>
                      Buyer Reputation
                    </h4>
                  </div>
                  <ReputationBadge
                    rating={buyerRep?.rating}
                    reviewCount={buyerRep?.reviewCount}
                    completedTransactions={buyerRep?.completedTransactions}
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Based on student ratings when you requested or purchased items.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* SECTION 3: My Listings — Listing Management */}
          {/* ============================================================== */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-main)' }}>
                  My Listings
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Manage your marketplace listings and review historical sales.
                </div>
              </div>

              <Link to="/listings/create" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                + Create New Listing
              </Link>
            </div>

            {/* Notification messages */}
            {listingMessage && (
              <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', border: '1px solid #22c55e', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>
                ✓ {listingMessage}
              </div>
            )}

            {listingError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: '1px solid #ef4444', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', fontWeight: '500' }}>
                ✕ {listingError}
              </div>
            )}

            {/* Filter Tabs: Available vs Sold */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <button
                type="button"
                onClick={() => { setListingTab('available'); setListingMessage(null); }}
                className="btn"
                style={{
                  backgroundColor: listingTab === 'available' ? 'var(--primary)' : 'transparent',
                  color: listingTab === 'available' ? '#ffffff' : 'var(--text-main)',
                  borderColor: listingTab === 'available' ? 'var(--primary)' : 'var(--border)',
                  padding: '8px 18px',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
              >
                Available Listings ({availableListings.length})
              </button>

              <button
                type="button"
                onClick={() => { setListingTab('sold'); setListingMessage(null); }}
                className="btn"
                style={{
                  backgroundColor: listingTab === 'sold' ? 'var(--primary)' : 'transparent',
                  color: listingTab === 'sold' ? '#ffffff' : 'var(--text-main)',
                  borderColor: listingTab === 'sold' ? 'var(--primary)' : 'var(--border)',
                  padding: '8px 18px',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
              >
                Sold Listings ({soldListings.length})
              </button>
            </div>

            {/* Listing Cards List */}
            {loadingListings ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Loading your listings...
              </div>
            ) : displayedListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface-alt, #0f172a)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                <p style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                  {listingTab === 'available' 
                    ? 'You have no available listings at the moment.' 
                    : 'You have no sold listings yet.'}
                </p>
                {listingTab === 'available' && (
                  <Link to="/listings/create" className="btn btn-primary" style={{ marginTop: '8px' }}>
                    Post an Item for Sale
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {displayedListings.map((item) => {
                  const imageSrc = item.images?.[0]
                    ? (item.images[0].startsWith('http') ? item.images[0] : `http://localhost:5000${item.images[0]}`)
                    : 'https://placehold.co/800x600?text=No+Image';

                  return (
                    <div
                      key={item._id}
                      style={{
                        display: 'flex',
                        padding: '16px',
                        borderRadius: '10px',
                        background: 'var(--surface-alt, #0f172a)',
                        border: '1px solid var(--border)',
                        gap: '16px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}
                    >
                      {/* Product Image */}
                      <img
                        src={imageSrc}
                        alt={item.title}
                        style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                        onError={(e) => { e.target.src = 'https://placehold.co/800x600?text=No+Image'; }}
                      />

                      {/* Product Details (NOTE: Date Created is deliberately omitted as instructed) */}
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem' }}>
                          <Link to={`/listings/${item._id}`} style={{ color: 'var(--text-main)' }}>
                            {item.title}
                          </Link>
                        </h4>

                        <div style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1.1rem', marginBottom: '8px' }}>
                          ₹{item.price}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span className="badge badge-primary">{item.category}</span>
                          <span className="badge">Condition: {item.condition}</span>
                          <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            Hostel {item.hostel}
                          </span>
                          <span className={`badge ${item.status === 'available' ? 'badge-success' : 'badge-secondary'}`}>
                            {item.status === 'available' ? 'Available' : 'Sold'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
                        <Link
                          to={`/listings/${item._id}`}
                          className="btn btn-secondary"
                          style={{ padding: '7px 12px', fontSize: '0.85rem', textAlign: 'center' }}
                        >
                          View Details
                        </Link>

                        {/* Available listings: Edit and Delete enabled */}
                        {item.status === 'available' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditListing(item)}
                              className="btn btn-primary"
                              style={{ padding: '7px 12px', fontSize: '0.85rem', backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                            >
                              ✎ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(item)}
                              className="btn btn-secondary"
                              style={{ padding: '7px 12px', fontSize: '0.85rem', color: '#ef4444', borderColor: '#ef4444' }}
                            >
                              🗑 Delete
                            </button>
                          </>
                        )}

                        {/* Sold listings: Cannot be edited or deleted (historical record) */}
                        {item.status === 'sold' && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                            Historical record (Protected)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* EDIT LISTING MODAL */}
      {/* ============================================================== */}
      {editingListing && (
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
            zIndex: 1500,
            padding: '16px'
          }}
        >
          <div
            className="modal-content"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-main)',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>
                Edit Available Listing
              </h3>
              <button
                type="button"
                onClick={handleCloseEditListing}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {editListingError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: '1px solid #ef4444', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.88rem', fontWeight: '500' }}>
                ✕ {editListingError}
              </div>
            )}

            <form onSubmit={handleSaveListing}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600' }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600' }}>Description <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>Price (₹) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>Condition <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    className="form-control"
                    value={editFormData.condition}
                    onChange={(e) => setEditFormData({ ...editFormData, condition: e.target.value })}
                    required
                  >
                    {CONDITIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600' }}>
                  Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Category can be edited at any time, even if buyers are currently negotiating.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600' }}>Replace Image (Optional)</label>
                <input
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  className="form-control"
                  onChange={handleEditFileChange}
                />
                {(editImagePreview || editingListing.images?.[0]) && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {editImagePreview ? 'New Image Preview:' : 'Current Product Image:'}
                    </div>
                    <img
                      src={editImagePreview || (editingListing.images[0].startsWith('http') ? editingListing.images[0] : `http://localhost:5000${editingListing.images[0]}`)}
                      alt="Preview"
                      style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={handleCloseEditListing}
                  className="btn btn-secondary"
                  disabled={savingListing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingListing}
                >
                  {savingListing ? 'Saving Changes...' : 'Save Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DELETE LISTING CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {deletingListing && (
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
            zIndex: 1500,
            padding: '16px'
          }}
        >
          <div
            className="modal-content"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-main)',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: '#dc2626' }}>
              Delete Listing?
            </h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '12px' }}>
              Are you sure you want to delete <strong>"{deletingListing.title}"</strong>?
            </p>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', lineHeight: '1.45', marginBottom: '20px' }}>
              ⚠️ This will remove the listing from public marketplace results immediately. If any buyers have pending purchase requests or active negotiations, their requests will be cancelled and they will receive the notification: <strong>"Product deleted by seller."</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={handleCloseDelete}
                className="btn btn-secondary"
                disabled={processingDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="btn btn-danger"
                disabled={processingDelete}
              >
                {processingDelete ? 'Deleting...' : 'Delete Listing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Profile;
