const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const radiosPath = path.join(__dirname, '..', 'bot', 'music', 'radios.json');
const radios = JSON.parse(fs.readFileSync(radiosPath, 'utf8'));

function fetchHead(url, timeout = 8000) {
  return new Promise((resolve) => {
    try {
      const isHttps = url.startsWith('https');
      const lib = isHttps ? https : http;
      const req = lib.get(url, { method: 'GET', timeout }, (res) => {
        const info = { statusCode: res.statusCode, headers: res.headers };
        // read some data then destroy
        let got = false;
        res.on('data', (chunk) => {
          if (!got) {
            got = true;
            req.destroy();
            resolve({ ok: true, info });
          }
        });
        res.on('end', () => {
          if (!got) resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, info });
        });
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message }));
      req.on('timeout', () => { try { req.destroy(); } catch (e) {} ; resolve({ ok: false, error: 'timeout' }); });
    } catch (e) {
      resolve({ ok: false, error: String(e && e.message) });
    }
  });
}

(async () => {
  const results = [];
  for (const r of radios) {
    process.stdout.write(`Checking ${r.label} -> ${r.url} ... `);
    try {
      const res = await fetchHead(r.url, 8000);
      if (res.ok) {
        console.log('OK', res.info && res.info.statusCode);
        results.push({ ...r, ok: true, status: res.info && res.info.statusCode, headers: res.info && res.info.headers });
      } else {
        console.log('FAIL', res.error || (res.info && res.info.statusCode));
        results.push({ ...r, ok: false, error: res.error || (res.info && res.info.statusCode) });
      }
    } catch (e) {
      console.log('ERR', e && e.message);
      results.push({ ...r, ok: false, error: String(e && e.message) });
    }
  }

  const working = results.filter(x => x.ok).map(x => ({ id: x.id, label: x.label, url: x.url }));
  const outPath = path.join(__dirname, 'radios-working.json');
  fs.writeFileSync(outPath, JSON.stringify({ checkedAt: Date.now(), results, working }, null, 2));
  console.log('\nWrote results to', outPath);
})();
