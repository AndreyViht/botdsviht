const { sendPrompt } = require('./bot/ai/vihtAi');

(async () => {
  const queries = [
    'Сандра?',
    'Кто такой Андрей Вихт?',
    'Расскажи о Ное Бое'
  ];
  for (const q of queries) {
    try {
      console.log('PROMPT:', q);
      const res = await sendPrompt(q, { callerIsCreator: true, authorId: '111111111111111111' });
      console.log('RESPONSE:\n', res, '\n----\n');
    } catch (e) {
      console.error('Error for', q, e && e.message ? e.message : e);
    }
  }
})();
