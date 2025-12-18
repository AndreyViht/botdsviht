const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const ytSearch = require('yt-search');
const db = require('../libs/db');

class PlayerManager {
  constructor() {
    this.queue = new Map(); // guildId -> array of songs
    this.nowPlaying = new Map(); // guildId -> current song info
    this.connections = new Map(); // guildId -> VoiceConnection
    this.players = new Map(); // guildId -> AudioPlayer
    this.lastCleanup = Date.now();
    
    // Периодическая очистка неактивных гильдий
    setInterval(() => this.cleanupInactiveGuilds(), 30 * 60 * 1000);
  }
  
  // Cleanup старые данные гильдий которые больше не в боте
  cleanupInactiveGuilds() {
    try {
      const now = Date.now();
      if (now - this.lastCleanup < 30 * 60 * 1000) return;
      this.lastCleanup = now;
      
      let cleaned = 0;
      const toDelete = [];
      
      for (const guildId of this.queue.keys()) {
        toDelete.push(guildId);
      }
      
      for (const guildId of toDelete) {
        this.queue.delete(guildId);
        this.nowPlaying.delete(guildId);
        if (this.connections.has(guildId)) {
          try {
            const conn = this.connections.get(guildId);
            if (conn && conn.destroy) conn.destroy();
          } catch (e) {}
          this.connections.delete(guildId);
        }
        if (this.players.has(guildId)) {
          try {
            const player = this.players.get(guildId);
            if (player && player.stop) player.stop();
          } catch (e) {}
          this.players.delete(guildId);
        }
        cleaned++;
      }
      
      if (cleaned > 0) {
        console.log('[PLAYER] Cleaned up ' + cleaned + ' inactive guild records');
      }
    } catch (e) {
      console.warn('[PLAYER] Cleanup error:', e.message);
    }
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

  getNowPlaying(guildId) {
    return this.nowPlaying.get(guildId) || null;
  }
}

module.exports = new PlayerManager();
