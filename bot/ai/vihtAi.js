// Gemini AI wrapper - простой запрос к Google API
const axios = require('axios');
const { useMockAi } = require('../config');
const db = require('../libs/db');

function vihtError() { 
  return 'ОШИБКА ПОДКЛЮЧЕНИЯ К СЕРВЕРАМ Viht Мы уже передали разработчикам, ждите обновления!'; 
}

function mockResponse(prompt) {
  const p = String(prompt || '').trim().toLowerCase();
  if (!p) return 'Здравствуйте! Чем могу помочь?';
  if (/\b(кто\s+такой\s+viht|viht|вихт)\b/i.test(p)) return 'Viht — команда, создающая быстрые и надёжные VPN‑решения.';
  if (/\b(андрей|andrey)\b/i.test(p)) return 'Андрей Вихт — основатель проекта Viht.';
  return 'Принято. Сейчас не могу использовать внешний AI, но постараюсь помочь — уточните запрос.';
}

function sanitizeText(text) { 
  if (!text) return ''; 
  return String(text)
    .replace(/([\p{L}\p{N}])\s*\n\s*([\p{L}\p{N}])/gu, '$1 $2')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim(); 
}

async function sendPrompt(prompt, opts = {}) {
  if (useMockAi) return mockResponse(prompt, opts);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return vihtError();

  const normalized = String(prompt || '').trim().toLowerCase();
  if (/\b(кто\s+такой\s+viht|viht|вихт)\b/i.test(normalized)) return 'Viht — команда, создающая быстрые и надёжные VPN‑решения.';

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          role: 'user',
          parts: [{ text: String(prompt) }]
        }],
        systemInstruction: {
          parts: [{ text: 'Ты "Viht" — виртуальный помощник. Отвечай по-русски.' }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      let out = sanitizeText(response.data.candidates[0].content.parts[0].text);
      if (out.length > 1800) out = out.slice(0, 1800).trim();
      try { if (db && db.incrementAi) db.incrementAi(); } catch (e) {}
      return out;
    }

    return vihtError();
  } catch (e) {
    console.error('❌ AI ошибка:', e.message);
    return vihtError();
  }
}

module.exports = { sendPrompt };
