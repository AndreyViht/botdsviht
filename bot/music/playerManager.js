const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const ytSearch = require('yt-search');
const db = require('../libs/db');

class PlayerManager {
  constructor() {
    this.queue = new Map(); // guildId -> array of songs
    this.nowPlaying = new Map(); // guildId -> current song info
    this.connections = new Map(); // guildId -> VoiceConnection
    this.players = new Map(); // guildId -> AudioPlayer
  }

  async searchYouTube(query) {
    try {
      const results = await ytSearch(query);
      if (!results.videos || results.videos.length === 0) {
        console.warn('[PLAYER] No YouTube results for:', query);
        return [];
      }
      
      return results.videos.slice(0, 5).map(v => ({
        source: 'youtube',
        title: v.title || 'Unknown',
        url: v.url,
        duration: v.seconds || 0,
        thumbnail: v.image || null,
        author: v.author?.name || 'Unknown'
      }));
    } catch (e) {
      console.error('[PLAYER] YouTube search error:', e.message);
      return [];
    }
  }

  async searchSoundCloud(query) {
    // SoundCloud поиск отключен в этой версии
    // Вернём пустой массив для совместимости
    return [];
  }

  async search(query) {
    try {
      console.log('[PLAYER] Searching for:', query);
      const ytResults = await this.searchYouTube(query);
      return ytResults.slice(0, 8);
    } catch (e) {
      console.error('[PLAYER] Search error:', e.message);
      return [];
    }
  }

  async getPlaybackLink(song) {
    try {
      if (song.source === 'youtube') {
        const stream = await yt_search(song.url);
        return stream;
      } else if (song.source === 'soundcloud') {
        const track = await client_sc.tracks.fetch(song.url);
        return track.url;
      }
    } catch (e) {
      console.error('[PLAYER] Failed to get playback link:', e.message);
      return null;
    }
  }

  addToQueue(guildId, song) {
    if (!this.queue.has(guildId)) this.queue.set(guildId, []);
    this.queue.get(guildId).push(song);
  }

  getQueue(guildId) {
    return this.queue.get(guildId) || [];
  }

  clearQueue(guildId) {
    this.queue.delete(guildId);
  }

  skip(guildId) {
    const player = this.players.get(guildId);
    if (player) player.stop();
  }

  stop(guildId) {
    const player = this.players.get(guildId);
    const connection = this.connections.get(guildId);
    
    if (player) player.stop();
    if (connection) connection.destroy();
    
    this.players.delete(guildId);
    this.connections.delete(guildId);
    this.queue.delete(guildId);
    this.nowPlaying.delete(guildId);
  }
}

module.exports = new PlayerManager();
