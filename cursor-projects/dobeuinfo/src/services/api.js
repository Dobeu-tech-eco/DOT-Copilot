// API service layer
// Implements actual API endpoints with fallback mock data for development

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * Generic fetch wrapper with error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Response data
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  }
  
  // Add auth token if available
  const token = localStorage.getItem('authToken')
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }
  
  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  }
  
  try {
    const response = await fetch(url, config)
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    const isJson = contentType && contentType.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    
    if (!response.ok) {
      throw new ApiError(
        data.message || data.error || 'Request failed',
        response.status,
        data
      )
    }
    
    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    // Network error or other fetch error
    throw new ApiError(error.message || 'Network error', 0)
  }
}

/**
 * Submit a product for review
 * @param {Object} formData - Product submission data
 * @returns {Promise<Object>} - Response from API
 */
export const submitProduct = async (formData) => {
  // If no API URL configured, use mock for development
  if (!API_BASE_URL) {
    console.log('[API Mock] Submitting product:', formData)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Product submitted successfully',
          id: Date.now().toString(),
        })
      }, 1000)
    })
  }
  
  try {
    const response = await apiFetch('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(formData),
    })
    
    return {
      success: true,
      message: response.message || 'Product submitted successfully',
      id: response.id,
      ...response,
    }
  } catch (error) {
    console.error('Submit product error:', error)
    throw new Error(error.message || 'Failed to submit product')
  }
}

/**
 * Get all product reviews
 * @param {Object} options - Query options (page, limit, etc.)
 * @returns {Promise<Object>} - Paginated list of reviews
 */
export const getReviews = async (options = {}) => {
  const { page = 1, limit = 10, status, sortBy = 'createdAt', sortOrder = 'desc' } = options
  
  // If no API URL configured, use mock for development
  if (!API_BASE_URL) {
    console.log('[API Mock] Getting reviews with options:', options)
    return {
      reviews: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    }
  }
  
  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    })
    
    if (status) {
      queryParams.append('status', status)
    }
    
    const response = await apiFetch(`/api/reviews?${queryParams}`)
    
    return {
      reviews: response.reviews || response.data || [],
      pagination: response.pagination || {
        page,
        limit,
        total: response.total || 0,
        totalPages: response.totalPages || 0,
      },
    }
  } catch (error) {
    console.error('Get reviews error:', error)
    throw new Error(error.message || 'Failed to fetch reviews')
  }
}

/**
 * Get a single review by ID
 * @param {string} id - Review ID
 * @returns {Promise<Object|null>} - Review data
 */
export const getReview = async (id) => {
  if (!id) {
    throw new Error('Review ID is required')
  }
  
  // If no API URL configured, use mock for development
  if (!API_BASE_URL) {
    console.log('[API Mock] Getting review:', id)
    return null
  }
  
  try {
    const response = await apiFetch(`/api/reviews/${id}`)
    return response.review || response.data || response
  } catch (error) {
    if (error.status === 404) {
      return null
    }
    console.error('Get review error:', error)
    throw new Error(error.message || 'Failed to fetch review')
  }
}

/**
 * Update a review
 * @param {string} id - Review ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated review
 */
export const updateReview = async (id, updateData) => {
  if (!id) {
    throw new Error('Review ID is required')
  }
  
  // If no API URL configured, use mock for development
  if (!API_BASE_URL) {
    console.log('[API Mock] Updating review:', id, updateData)
    return { id, ...updateData, updatedAt: new Date().toISOString() }
  }
  
  try {
    const response = await apiFetch(`/api/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    })
    return response.review || response.data || response
  } catch (error) {
    console.error('Update review error:', error)
    throw new Error(error.message || 'Failed to update review')
  }
}

/**
 * Delete a review
 * @param {string} id - Review ID
 * @returns {Promise<boolean>} - Success status
 */
export const deleteReview = async (id) => {
  if (!id) {
    throw new Error('Review ID is required')
  }
  
  // If no API URL configured, use mock for development
  if (!API_BASE_URL) {
    console.log('[API Mock] Deleting review:', id)
    return true
  }
  
  try {
    await apiFetch(`/api/reviews/${id}`, {
      method: 'DELETE',
    })
    return true
  } catch (error) {
    console.error('Delete review error:', error)
    throw new Error(error.message || 'Failed to delete review')
  }
}

/**
 * Upload a file (image, document, etc.)
 * @param {File} file - File to upload
 * @param {string} type - File type category
 * @returns {Promise<Object>} - Upload result with URL
 */
export const uploadFile = async (file, type = 'image') => {
  if (!file) {
    throw new Error('File is required')
  }
  
  // If no API URL configured, use mock for development
  if (!API_BASE_URL) {
    console.log('[API Mock] Uploading file:', file.name, type)
    return {
      success: true,
      url: URL.createObjectURL(file),
      filename: file.name,
    }
  }
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    
    const token = localStorage.getItem('authToken')
    const headers = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(`${API_BASE_URL}/api/uploads`, {
      method: 'POST',
      headers,
      body: formData,
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Upload failed')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Upload file error:', error)
    throw new Error(error.message || 'Failed to upload file')
  }
}

// Export error class for external use
export { ApiError }

