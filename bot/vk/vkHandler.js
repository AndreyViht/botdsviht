const axios = require('axios');
const { URL } = require('url');

const config = require('../config');

/**
 * VK Music Handler
 * Handles OAuth, search, and audio stream retrieval from VKontakte
 */

const VK_API_BASE = 'https://api.vk.com/method';
const VK_API_VERSION = '5.199'; // Updated to latest stable version

const vkHandler = {
  // In-memory token storage (use DB in production)
  userTokens: new Map(),

  /**
   * Get OAuth login URL
   * Redirect user to this URL to authorize
   */
  getOAuthUrl() {
    if (!config.vkAppId) return null;
    const redirectUri = config.vkOAuthRedirectUri || 'http://localhost:3000/auth/vk/callback';
    return `https://oauth.vk.com/authorize?client_id=${config.vkAppId}&display=popup&redirect_uri=${encodeURIComponent(redirectUri)}&scope=audio&response_type=token`;
  },

  /**
   * Exchange code for access token (server-side flow)
   * Requires VK_APP_ID and VK_APP_SECRET
   */
  async getAccessTokenByCode(code, redirectUri) {
    if (!config.vkAppId || !config.vkAppSecret) {
      throw new Error('VK_APP_ID and VK_APP_SECRET not configured');
    }
    try {
      const response = await axios.get(`${VK_API_BASE}/oauth.getToken`, {
        params: {
          client_id: config.vkAppId,
          client_secret: config.vkAppSecret,
          code,
          redirect_uri: redirectUri
        }
      });
      if (response.data.error) {
        throw new Error(`VK OAuth error: ${response.data.error_description}`);
      }
      return response.data.access_token;
    } catch (e) {
      console.error('getAccessTokenByCode error:', e.message);
      throw e;
    }
  },

  /**
   * Store user token
   */
  setUserToken(userId, token, expiresIn = null) {
    const expiryTime = expiresIn ? Date.now() + expiresIn * 1000 : null;
    this.userTokens.set(userId, { token, expiryTime });
  },

  /**
   * Get user token (with expiry check)
   */
  getUserToken(userId) {
    const data = this.userTokens.get(userId);
    if (!data) return null;
    if (data.expiryTime && Date.now() > data.expiryTime) {
      this.userTokens.delete(userId);
      return null;
    }
    return data.token;
  },

  /**
   * Search for audio in VK
   * @param {string} query - Song title or artist name
   * @param {string} userToken - User's access token (optional, for private audios)
   * @returns {Promise<Array>} - Array of track objects with {id, owner_id, title, artist, duration, url}
   */
  async searchAudio(query, userToken = null) {
    try {
      const token = userToken || config.vkServiceToken;
      if (!token) {
        console.error('searchAudio: No VK token provided');
        throw new Error('No VK token provided. Set VK_SERVICE_TOKEN or use user OAuth token.');
      }

      console.log(`[VK Search] Query: "${query}", Token: ${token.substring(0, 10)}...`);

      const response = await axios.get(`${VK_API_BASE}/audio.search`, {
        params: {
          q: query,
          count: 10,
          access_token: token,
          v: VK_API_VERSION
        },
        timeout: 10000
      });

      console.log(`[VK Search Response]`, response.data);

      if (response.data.error) {
        console.error('VK search error:', response.data.error.error_msg || JSON.stringify(response.data.error));
        throw new Error(`VK API error: ${response.data.error.error_msg || 'Unknown error'}`);
      }

      const items = response.data.response?.items || [];
      console.log(`[VK Search] Found ${items.length} results`);
      
      return items.map(audio => ({
        id: audio.id,
        owner_id: audio.owner_id,
        title: audio.title,
        artist: audio.artist,
        duration: audio.duration,
        url: audio.url, // Direct MP3 URL from VK (may not always be available)
        canPlay: !!audio.url
      }));
    } catch (e) {
      console.error('searchAudio error:', e.message);
      throw e;
    }
  },

  /**
   * Get direct stream URL for audio by ID
   * @param {number} audioId - Audio ID
   * @param {number} ownerId - Owner ID
   * @param {string} userToken - User's access token
   */
  async getAudioUrl(audioId, ownerId, userToken = null) {
    try {
      const token = userToken || config.vkServiceToken;
      if (!token) {
        throw new Error('No VK token provided');
      }

      const response = await axios.get(`${VK_API_BASE}/audio.getById`, {
        params: {
          audios: `${ownerId}_${audioId}`,
          access_token: token,
          v: VK_API_VERSION
        }
      });

      if (response.data.error) {
        throw new Error(`VK API error: ${response.data.error.error_msg}`);
      }

      const audio = response.data.response?.[0];
      if (!audio || !audio.url) {
        throw new Error('Audio not available or URL not accessible');
      }

      return audio.url;
    } catch (e) {
      console.error('getAudioUrl error:', e.message);
      throw e;
    }
  },

  /**
   * Get VK Chart (popular audios)
   * Requires service token
   */
  async getChart() {
    try {
      const token = config.vkServiceToken;
      if (!token) {
        throw new Error('VK_SERVICE_TOKEN not configured');
      }

      const response = await axios.get(`${VK_API_BASE}/audio.getPopular`, {
        params: {
          count: 20,
          genre_id: 0, // All genres
          access_token: token,
          v: VK_API_VERSION
        }
      });

      if (response.data.error) {
        throw new Error(`VK API error: ${response.data.error.error_msg}`);
      }

      const items = response.data.response?.items || [];
      return items.map(audio => ({
        id: audio.id,
        owner_id: audio.owner_id,
        title: audio.title,
        artist: audio.artist,
        duration: audio.duration,
        url: audio.url,
        canPlay: !!audio.url
      }));
    } catch (e) {
      console.error('getChart error:', e.message);
      throw e;
    }
  }
};

module.exports = vkHandler;
