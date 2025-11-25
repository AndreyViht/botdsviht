# GitHub Actions Setup для Discord Bot

## Инструкция для запуска бота на GitHub Actions 24/7

### Шаг 1: Добавь Secrets в GitHub

Перейди в твой репозиторий → Settings → Secrets and variables → Actions → New repository secret

Добавь следующие secrets:
- `DISCORD_TOKEN` - токен Discord бота
- `CLIENT_ID` - ID приложения Discord
- `GUILD_ID` - ID сервера Discord
- `GEMINI_API_KEY` - ключ Google Gemini API
- `AI_CHAT_CHANNEL_ID` - ID канала для ИИ (1437189999882801173)

### Шаг 2: Загрузи файлы в GitHub

1. Скопируй папку `.github/workflows/` со своего компьютера в репозиторий
2. Файл `bot.yml` должен быть в `.github/workflows/bot.yml`

### Шаг 3: Включи GitHub Actions

Перейди в Actions → выбери "Discord Bot" workflow → Enable

### Шаг 4: Триггеры запуска

Бот запустится:
- При каждом push в main ветку
- По расписанию каждый час

Чтобы он крутился постоянно, используй workflow_dispatch или измени расписание.

### Шаг 5: Мониторинг

Смотри логи в Actions → Discord Bot → последний run
