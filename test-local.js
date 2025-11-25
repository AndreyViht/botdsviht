const { sendPrompt } = require('./bot/ai/vihtAi');

(async () => {
  const queries = [
    'Кто такой Viht?',
    'Кто такой Андрей Вихт?',
    'Кто такая Sandra?',
    'Кто такая Ной Бой?'
  ];
  for (const q of queries) {
    try {
      console.log('PROMPT:', q);
      const res = await sendPrompt(q, {});
      console.log('RESPONSE:\n', res, '\n----\n');
    } catch (e) {
      console.error('Error for', q, e && e.message ? e.message : e);
    }
  }
})();
