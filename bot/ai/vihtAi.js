// Gemini AI wrapper - простой запрос к Google API
const axios = require('axios');
const { useMockAi } = require('../config');
const db = require('../libs/db');

function vihtError() {
  return 'ОШИБКА ПОДКЛЮЧЕНИЯ К СЕРВЕРАМ Viht. Мы уже передали разработчикам — подождите немного, пожалуйста.';
}

function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/([\p{L}\p{N}])\s*\n\s*([\p{L}\p{N}])/gu, '$1 $2')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// canned responses for known names and downloads — only when user explicitly asks
function cannedResponse(prompt) {
  const p = String(prompt || '').trim();
  const low = p.toLowerCase();

  // identity questions only: match "кто такой/кто такая" or English "who is/who's"
  const whoRx = /\b(?:кто\s+(?:такой|такая)|who\s+is|who(?:'|’)s)\b/i;

  // Андрей / Viht — only respond when user asks who he is
  if (whoRx.test(p) && /\b(андрей|andrey|viht|вихт)\b/i.test(p)) {
    return `👨‍💻 Андрей Вихт — создатель и главный разработчик системы VPN Viht, основатель компании Viht. Это грамотный и добрый человек, который вложил душу в проект. Подробнее: https://vihtai.pro`;
  }

  // Sandra — respond only to direct question
  if (whoRx.test(p) && /\b(сандра|sandra|sandra\s+goslin|sandra\s+viht)\b/i.test(p)) {
    return `💖 Sandra — помощник и самый любимый человек создателя, поддерживающая команду и пользователей. Очень тёплый и заботливый человек. 😊`;
  }

  // Naya / Noy — direct question only
  if (whoRx.test(p) && /\b(naya\s+bay|naya|noya|ной\s*бой|ной|ная|няя)\b/i.test(p)) {
    return `🎭 Naya (Naya Bay) — весёлый и душевный человек, который поднимает настроение в команде шутками и поддержкой. Всегда рядом, чтобы помочь и рассмешить.`;
  }

  // model question explicit
  if (/\b(?:какая\s+модель|какая\s+модель\s+используется|what\s+model|which\s+model)\b/i.test(low)) {
    return `Модель: viht-ai-ftxl-v-1-34.`;
  }

  // Downloads — only when user asks about downloading or mentions 'скачать' / 'download'
  if (/\b(скачать|download|install|установить)\b/i.test(p)) {
    if (/android|плей\s*маркет|play\s*store/i.test(p)) {
      return `📲 Для Android: https://play.google.com/store/apps/details?id=com.v2raytun.android&hl=ru`;
    }
    if (/ios|iphone|ipad|app\s*store/i.test(p)) {
      return `📱 Для iOS: https://apps.apple.com/ru/app/v2raytun/id6476628951`;
    }
    if (/windows|win|виндовс/i.test(p)) {
      return `💻 Для Windows: https://v2raytunvpn.cc/files/xraysurf.zip`;
    }
  }

  // How to create key — only when user asks about key creation
  if (/\b(ключ|создать\s+ключ|create\s+key|auth|авторизоваться|авторизация)\b/i.test(p)) {
    return `🔑 Чтобы получить ключ: зайди на https://vihtai.pro, авторизуйся через Telegram, выбери устройство и создай ключ доступа.`;
  }

  return null;
}

async function sendPrompt(prompt, opts = {}) {
  // quick local canned responses (bypass external API)
  const canned = cannedResponse(prompt);
  if (canned) return canned;

  if (useMockAi) {
    // keep a simple fallback mock
    const q = String(prompt || '').trim().toLowerCase();
    if (!q) return 'Здравствуйте! Чем могу помочь?';
    if (/\b(кто\s+такой\s+viht|viht|вихт)\b/i.test(q)) return '👨‍💻 Viht — команда, создающая быстрые и надёжные VPN‑решения.';
    if (/\b(андрей|andrey)\b/i.test(q)) return '👨‍💻 Андрей Вихт — основатель проекта Viht. Подробнее: https://vihtai.pro';
    if (/\b(сандра|sandra)\b/i.test(q)) return '💖 Sandra — помощник и любимый человек создателя.';
    if (/\b(naya|noya|ной)\b/i.test(q)) return '🎭 Naya — душа команды, всегда поднимет настроение.';
    return 'Принято. Сейчас AI недоступен — уточните запрос.';
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return vihtError();

  // call with retries for transient errors (503, 5xx, network)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: String(prompt) }] }],
    systemInstruction: {
      parts: [{ text: `Ты — Viht, виртуальный помощник проекта Viht. Отвечай по-русски, кратко и по существу. Отвечай только на явный запрос пользователя — не добавляй списки опций и не предлагая дополнительные действия, если пользователь прямо не попросил их. Не упоминай внутреннее имя модели, кроме как по прямому вопросу "какая модель". Используй эмодзи экономно.` }] },
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
      // unexpected empty response — break
      return vihtError();
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      console.warn(`AI request attempt ${attempt} failed`, status || e.code || e.message);
      // retry on 5xx or network errors
      if (status && status >= 500 && status < 600 || !status) {
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s, ...
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      break;
    }
  }

  console.error('❌ AI ошибка: all attempts failed', lastErr && (lastErr.message || lastErr));
  return vihtError();
}

module.exports = { sendPrompt };
