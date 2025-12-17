const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const { yt_search } = require('play-dl');
const ytSearch = require('yt-search');
const SoundCloud = require('soundcloud-scraper');
const db = require('../libs/db');

const client_sc = new SoundCloud.Client();

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
      return results.videos.slice(0, 5).map(v => ({
        source: 'youtube',
        title: v.title,
        url: v.url,
        duration: v.seconds,
        thumbnail: v.image,
        author: v.author.name
      }));
    } catch (e) {
      console.error('[PLAYER] YouTube search error:', e.message);
      return [];
    }
  }

  async searchSoundCloud(query) {
    try {
      const tracks = await client_sc.tracks.search({ q: query, limit: 5 });
      return tracks.map(t => ({
        source: 'soundcloud',
        title: t.title,
        url: t.permalink_url,
        duration: Math.floor(t.duration / 1000),
        thumbnail: t.artwork_url,
        author: t.user.username
      }));
    } catch (e) {
      console.error('[PLAYER] SoundCloud search error:', e.message);
      return [];
    }
  }

  async search(query) {
    const [ytResults, scResults] = await Promise.all([
      this.searchYouTube(query),
      this.searchSoundCloud(query)
    ]);
    return [...ytResults, ...scResults].slice(0, 8);
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
