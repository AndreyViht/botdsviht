const fs = require('fs');
(async function(){
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const m = env.match(/GEMINI_API_KEY=(.*)/);
    if (!m) { console.error('GEMINI_API_KEY not found in .env'); process.exit(1); }
    const key = m[1].trim();
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
    const res = await fetch(url);
    const data = await res.text();
    console.log('HTTP', res.status);
    try { console.log(JSON.stringify(JSON.parse(data), null, 2)); }
    catch(e) { console.log(data); }
  } catch (e) {
    console.error('Error', e.message || e);
  }
})();
