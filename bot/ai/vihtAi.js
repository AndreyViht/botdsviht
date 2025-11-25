// AI wrapper - respond to explicit questions with canned answers, otherwise use Gemini
const axios = require('axios');
const db = require('../libs/db');

function vihtError() {
  return 'В данный момент сервис перегружен. Пожалуйста, попробуйте позже.';
}

function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/([\p{L}\p{N}])\s*\n\s*([\p{L}\p{N}])/gu, '$1 $2')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Convert markdown links [text](url) -> url
    .replace(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g, '$1')
    // Remove leftover square brackets
    .replace(/\[([^\]]+)\]/g, '$1')
    // Remove backticks
    .replace(/`/g, '')
    .trim();
}

// Canned responses - only for EXPLICIT questions
function cannedResponse(prompt) {
  const p = String(prompt || '').trim();
  const low = p.toLowerCase();

  // Match "кто" queries (Unicode-aware). Use lookarounds to support Cyrillic.
  const whoRx = /(?<!\p{L})(?:кто\s+(?:такой|такая)|who\s+is|who(?:'|’)s)(?!\p{L})/iu;
  const nameAndreyRx = /(?<!\p{L})(?:андрей|вихт|andrey|viht)(?!\p{L})/iu;
  const nameSandraRx = /(?<!\p{L})(?:сандра|sandra|sandra\s+goslin|sandra\s+viht)(?!\p{L})/iu;
  const nameNayaRx = /(?<!\p{L})(?:naya\s+bay|naya|noya|ней\s+бей|ной\s+бой|ная)(?!\p{L})/iu;

  // ANDREY / VIHT - only if user explicitly asks "who is"
  if (whoRx.test(p) && nameAndreyRx.test(p)) {
    return `👨‍💻 **Андрей Вихт** — создатель и главный разработчик системы VPN Viht, основатель компании Viht. Это грамотный, умный и очень хороший человек, который вложил всю душу в развитие проекта. Узнать больше: https://vihtai.pro`;
  }

  // SANDRA - only if user explicitly asks "who is"
  if (whoRx.test(p) && nameSandraRx.test(p)) {
    return `💖 **Sandra** — помощник и самый любимый человек создателя Andrey Viht. Она поддерживает команду и пользователей, очень тёплый, заботливый и вдохновляющий человек. ✨`;
  }

  // NAYA - only if user explicitly asks "who is"
  if (whoRx.test(p) && nameNayaRx.test(p)) {
    return `🎭 **Naya (Naya Bay)** — прекрасный человек, который является сердцем команды. Всегда смешит, веселит и поддерживает коллектив. Несёт за собой юмор, позитив и стремление помогать. Настоящая звёзда в команде! ⭐`;
  }

  // MODEL - only if explicitly asked "какая модель"
  if (/\b(?:какая\s+модель|какая\s+модель\s+используется|what\s+model|which\s+model)\b/i.test(low)) {
    return `Модель: viht-ai-ftxl-v-1-34`;
  }

  // DOWNLOADS - match a wide range of download requests (Unicode-friendly)
  if (/(?:скач|download|install|установ|загруз|ссылка|где|как|получить)/iu.test(p) && /(?:приложен|app|android|ios|windows|виндовс|скач)/iu.test(p)) {
    return `🔗 **Скачать приложение:**\nhttps://vihtai.pro/downloads\n\nВыбери свою платформу (Android, iOS или Windows), скачай приложение, затем перейди на https://vihtai.pro, авторизуйся через Telegram и создай ключ для вашего устройства.`;
  }

  // KEY/AUTH - only if explicitly asked "ключ" / "создать ключ" / "авторизация"
  if (/\b(ключ|создать\s+ключ|create\s+key|auth|авторизоваться|авторизация)\b/i.test(p)) {
    return `🔑 **Как создать ключ:**\n1. Перейди на https://vihtai.pro\n2. Авторизуйся через Telegram\n3. Выбери подходящее устройство (Android, iOS, Windows)\n4. Создай ключ доступа\n5. Скачай и установи приложение на нужную платформу\n\nГотово! Теперь можешь подключаться к VPN Viht. 🚀`;
  }

  return null;
}

async function sendPrompt(prompt, opts = {}) {
  // Check for canned responses FIRST (only on explicit questions)
  const canned = cannedResponse(prompt);
  if (canned) return canned;

  // Otherwise, use Gemini AI
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return vihtError();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: String(prompt) }] }],
    systemInstruction: {
      parts: [{ text: `Ты — Viht, виртуальный помощник проекта Viht. Ты помощник для подключения и работы с VPN Viht, а также искусственный помощник в общении, информации, кодинге, разборе идей и размышлении над темами.

Помогай пользователям:
- Подключиться к VPN Viht
- Скачать и установить приложения (Android, iOS, Windows)
- Создать ключ доступа на https://vihtai.pro
- Ответить на вопросы по кодингу, разработке и техническим темам
- Общаться и помогать с информацией

Отвечай по-русски, кратко, дружелюбно и по существу. Не добавляй списки опций, если пользователь не спросил. Используй эмодзи умеренно. Не упоминай имя модели, кроме как по прямому вопросу.` }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  };

  const maxAttempts = 4;
  let attempt = 0;
  let lastErr = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 });
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        let out = sanitizeText(response.data.candidates[0].content.parts[0].text);
        if (out.length > 1800) out = out.slice(0, 1800).trim();
        try { if (db && db.incrementAi) db.incrementAi(); } catch (e) { console.warn('incrementAi failed:', e && e.message); }
        return out;
      }
      return vihtError();
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      console.warn(`AI request attempt ${attempt} failed`, status || e.code || e.message);
      if ((status && status >= 500 && status < 600) || !status) {
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      break;
    }
  }

  console.error('AI ошибка: all attempts failed', lastErr && (lastErr.message || lastErr));
  return vihtError();
}

module.exports = { sendPrompt };
