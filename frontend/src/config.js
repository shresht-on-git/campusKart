// Frontend configuration for API and Socket connections
// Locally defaults to http://localhost:5000
// In production (Vercel): configured via VITE_API_URL environment variable

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const API_URL = `${API_BASE_URL}/api`;

/**
 * Resolves full URL for product images:
 * - If image is an external URL (http/https), returns as is.
 * - If image contains http://localhost:5000, dynamically points to the current API_BASE_URL.
 * - If image is a relative path (/uploads/...), prepends API_BASE_URL.
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://localhost:5000')) {
    return imagePath.replace('http://localhost:5000', API_BASE_URL);
  }
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return `${API_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};
