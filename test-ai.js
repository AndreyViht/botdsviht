const { sendPrompt } = require('./bot/ai/vihtAi');

(async () => {
  try {
    const longPrompt = `Напиши очень подробный и развернутый текст по настройке VPN-соединения, включи примеры конфигураций, рекомендации по безопасности, объяснения, предупреждения и пошаговую инструкцию. Ответ должен быть длинным и содержательным, чтобы вызвать много токенов и проверить поведение при возможном усечении.`;
    console.log('Sending prompt...');
    const res = await sendPrompt(longPrompt);
    console.log('--- RESPONSE START ---');
    if (!res) console.log('<empty string returned>');
    else console.log(res);
    console.log('--- RESPONSE END ---');
  } catch (e) {
    console.error('Test script error:', e && e.stack ? e.stack : e);
    process.exitCode = 1;
  }
})();
