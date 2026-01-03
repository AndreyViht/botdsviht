const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const ytSearch = require('yt-search');
const playdl = require('play-dl');
const db = require('../libs/db');

class PlayerManager {
  constructor() {
    this.queue = new Map(); // guildId -> array of songs
    this.nowPlaying = new Map(); // guildId -> current song info
    this.connections = new Map(); // guildId -> VoiceConnection
    this.players = new Map(); // guildId -> AudioPlayer
    this.owners = new Map(); // guildId -> userId of session owner
    this.panels = new Map(); // guildId -> { channelId, messageId } for control panel
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

  // Session management
  startSession(guildId, userId) {
    this.owners.set(guildId, userId);
    console.log(`[PLAYER] Session started for guild ${guildId} by user ${userId}`);
  }

  endSession(guildId) {
    this.owners.delete(guildId);
    this.panels.delete(guildId);
    console.log(`[PLAYER] Session ended for guild ${guildId}`);
  }

  checkOwner(guildId, userId) {
    const owner = this.owners.get(guildId);
    return owner === userId;
  }

  isInSession(guildId) {
    return this.owners.has(guildId);
  }

  setPanel(guildId, channelId, messageId) {
    this.panels.set(guildId, { channelId, messageId });
  }

  getPanel(guildId) {
    return this.panels.get(guildId);
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

  async getStreamForSong(song) {
    try {
      // If song has a URL (YouTube link or direct), try play-dl stream
      if (song.url && typeof song.url === 'string') {
        try {
          const s = await playdl.stream(song.url, { quality: 2 });
          return s;
        } catch (e) {
          console.warn('[PLAYER] play-dl stream failed for url, falling back to search:', e.message);
        }
      }

      // Fallback: search by title on YouTube via play-dl
      if (song.title) {
        const results = await playdl.search(song.title, { source: 'youtube', limit: 1 });
        if (results && results.length > 0) {
          const s = await playdl.stream(results[0].url, { quality: 2 });
          return s;
        }
      }

      return null;
    } catch (e) {
      console.error('[PLAYER] Failed to get stream for song:', e.message);
      return null;
    }
  }

  async addToQueue(guildId, song, voiceChannel, client, userId) {
    if (!this.queue.has(guildId)) this.queue.set(guildId, []);
    const q = this.queue.get(guildId);
    const wasEmpty = q.length === 0;
    // attach requester and voiceChannelId for later
    q.push(Object.assign({}, song, { requesterVoiceChannelId: voiceChannel?.id || null, requesterId: userId || null }));

    // If queue was empty, start session
    if (wasEmpty && userId) {
      this.startSession(guildId, userId);
    }

    // If player not active, start playback
    if (!this.players.has(guildId)) {
      try {
        await this.startPlayer(guildId, voiceChannel, client);
      } catch (e) {
        console.error('[PLAYER] startPlayer error:', e.message);
      }
    }
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

  async stop(guildId, client, options = {}) {
    const player = this.players.get(guildId);
    const connection = this.connections.get(guildId) || getVoiceConnection(guildId);

    if (player) player.stop();

    // If a move target is provided, attempt to join that voice channel instead of full disconnect
    if (options.moveTo) {
      try {
        const targetChannel = await client.channels.fetch(options.moveTo).catch(() => null);
        if (targetChannel && (targetChannel.type === 2 || targetChannel?.isVoiceBased?.())) {
          // destroy existing connection and re-join target
          try { if (connection && connection.destroy) connection.destroy(); } catch (e) {}
          const conn = joinVoiceChannel({ channelId: targetChannel.id, guildId: guildId, adapterCreator: targetChannel.guild.voiceAdapterCreator });
          this.connections.set(guildId, conn);
          // keep player instance, but do not play anything
          console.log('[PLAYER] Moved bot to target voice channel:', options.moveTo);
          return;
        }
      } catch (e) {
        console.warn('[PLAYER] Failed to move to target channel:', e.message);
      }
    }

    if (connection) {
      try { connection.destroy(); } catch (e) {}
    }

    this.players.delete(guildId);
    this.connections.delete(guildId);
    this.queue.delete(guildId);
    this.nowPlaying.delete(guildId);
    this.endSession(guildId);
  }

  // Start player and play first item from queue
  async startPlayer(guildId, voiceChannel, client) {
    if (!voiceChannel) throw new Error('No voice channel provided to start player');

    const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: guildId, adapterCreator: voiceChannel.guild.voiceAdapterCreator });
    this.connections.set(guildId, connection);

    const audioPlayer = createAudioPlayer();
    this.players.set(guildId, audioPlayer);

    // subscribe connection to player
    connection.subscribe(audioPlayer);

    audioPlayer.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle) {
        // play next
        setImmediate(() => this._playNextFromQueue(guildId, client));
      }
    });

    audioPlayer.on('error', (err) => {
      console.error('[PLAYER] Audio player error:', err.message);
      setImmediate(() => this._playNextFromQueue(guildId, client));
    });

    // start playing immediately
    await this._playNextFromQueue(guildId, client);

    // Update control panel
    setTimeout(async () => {
      try {
        const { createControlPanel } = require('./musicHandlers');
        await createControlPanel(guildId, client);
      } catch (e) {
        console.warn('[PLAYER] Failed to update panel after start:', e.message);
      }
    }, 2000); // Delay to allow stream to start
  }

  async _playNextFromQueue(guildId, client) {
    try {
      const q = this.queue.get(guildId) || [];
      if (!q || q.length === 0) {
        // nothing to play — cleanup
        const conn = this.connections.get(guildId);
        if (conn) try { conn.destroy(); } catch (e) {}
        this.connections.delete(guildId);
        this.players.delete(guildId);
        this.nowPlaying.delete(guildId);
        return;
      }

      const next = q.shift();
      this.queue.set(guildId, q);
      this.nowPlaying.set(guildId, next);

      const streamObj = await this.getStreamForSong(next);
      if (!streamObj) {
        console.warn('[PLAYER] Could not resolve stream for', next.title || next.url);
        // try next
        return this._playNextFromQueue(guildId, client);
      }

      const resource = createAudioResource(streamObj.stream, { inputType: streamObj.type });
      const player = this.players.get(guildId);
      if (!player) return;
      player.play(resource);
      console.log('[PLAYER] Now playing:', next.title || next.url);
    } catch (e) {
      console.error('[PLAYER] _playNextFromQueue error:', e.message);
    }
  }

  getNowPlaying(guildId) {
    return this.nowPlaying.get(guildId) || null;
  }
}

module.exports = new PlayerManager();
