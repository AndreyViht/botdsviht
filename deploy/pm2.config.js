module.exports = {
  apps: [
    {
      name: 'viht-vpn-bot',
      script: 'bot/index.js',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        // set in server environment or via PM2 ecosystem env
        // DISCORD_TOKEN: '',
        // GEMINI_API_KEY: '',
        // CLIENT_ID: '',
        // GUILD_ID: '',
        // AI_CHAT_CHANNEL_ID: '',
        MESSAGE_CONTENT_INTENT: 'true',
        GUILD_MEMBERS_INTENT: 'true'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: './pm2-logs/viht-error.log',
      out_file: './pm2-logs/viht-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    }
  ]
};