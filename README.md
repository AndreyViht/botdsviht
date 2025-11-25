# Viht VPN — Discord bot

Минимальный рабочий проект: AI-чат (/viht) + сообщение-приветствие с реакцией → роль "Подписчик" + небольшой dashboard.

1) Как настроить (локально)

- Скопируйте `.env.example` → `.env` и вставьте реальные значения:

  DISCORD_TOKEN=ВАШ_DISCORD_TOKEN
  CLIENT_ID=ВАШ_CLIENT_ID
  GUILD_ID=ВАШ_GUILD_ID  # опционно для регистрации команд в конкретном сервере
  GEMINI_API_KEY=ВАШ_GEMINI_KEY
  PORT=3001

- Установите зависимости (PowerShell):

```powershell
npm install
```

- Зарегистрируйте slash-команды (локально) — замените .env и запустите:

```powershell
npm run register-commands
```

- Запустите бота:

```powershell
npm start
```

2) Где взять ID и что вводить (текст для точного копирования)

- Application ID (CLIENT_ID): Discord Developer Portal → General Information → Copy ID
- Bot Token (DISCORD_TOKEN): Developer Portal → Bot → Reset Token → Copy token (кладите в `.env`)
- GUILD_ID (опционально): Включите Developer Mode → правый клик по серверу → Copy ID
- WELCOME_CHANNEL_ID: Включите Developer Mode → правый клик по каналу → Copy ID → поместите в `.env` как WELCOME_CHANNEL_ID

3) Развертывание на VPS

- Скопируйте проект на VPS, установите Node.js, создайте `.env` и используйте systemd для запуска `bot/index.js` и `dashboard/app.js`. Подробнее в предыдущих инструкциях.

4) Что ещё сделать

- Настроить nginx proxy + TLS если хотите смотреть dashboard через домен.
- Улучшить обработку ошибок, добавить логирование (winston).
