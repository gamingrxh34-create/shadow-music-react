/**
 * Optimizes image URLs on-the-fly for Cloudinary and Unsplash.
 * Automatically requests WebP/AVIF format, auto-quality compression,
 * and downscales to the exact container width needed.
 *
 * @param {string} url Original image URL
 * @param {number} width Desired display width in pixels (e.g. 120 for row, 300 for card, 600 for player)
 * @returns {string} Highly optimized image URL
 */
export function getOptimizedImageUrl(url, width = 300) {
  if (!url || typeof url !== 'string') {
    return 'https://via.placeholder.com/300?text=♪'
  }

  // Local capacitor file or base64 or blob - return as is
  if (url.startsWith('file:') || url.startsWith('http://localhost') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }

  // Cloudinary: inject auto-format, auto-quality, width, and fill crop
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    // Prevent double-transforming
    if (url.includes('/f_auto,q_auto')) {
      return url
    }
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_fill/`)
  }

  // Unsplash: update width and quality parameters
  if (url.includes('unsplash.com')) {
    if (url.includes('w=')) {
      return url.replace(/w=\d+/, `w=${width}`).replace(/q=\d+/, 'q=75')
    }
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}w=${width}&auto=format&fit=crop&q=75`
  }

  // Apple Music / iTunes mzstatic CDN: support dynamic resizing
  if (url.includes('mzstatic.com') && url.includes('bb.jpg')) {
    return url.replace(/\/\d+x\d+bb\.jpg/, `/${width}x${width}bb.jpg`)
  }

  return url
}
