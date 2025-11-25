const fs = require('fs');
(async ()=>{
  try {
    const env = fs.readFileSync('.env','utf8');
    const m = env.match(/GEMINI_API_KEY=(.*)/);
    if(!m) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
    const key = m[1].trim();
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const payload = {
      contents: [
        { role: 'user', parts: [{ text: 'Напиши короткий абзац про Александра Пушкина.' }] }
      ],
      systemInstruction: { parts: [{ text: 'Ты — Viht AI. Отвечай по-русски, подробно, дружелюбно.' }] },
      safetySettings: [],
      generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
    };
    console.log('POST', url);
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const text = await resp.text();
    console.log('HTTP', resp.status);
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
    catch(e){ console.log(text); }
  } catch(e) { console.error('Error', e.message || e); }
})();
