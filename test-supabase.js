// Тест Supabase функции
const axios = require('axios');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testSupabaseFunction() {
  try {
    console.log('🧪 Тестирую Supabase функцию...');
    console.log('URL:', SUPABASE_URL);
    console.log('Service Role Key length:', SUPABASE_SERVICE_ROLE_KEY?.length || 0);

    const startTime = Date.now();
    console.log('⏱ Отправляю запрос...');

    const response = await axios.post(
      `${SUPABASE_URL}/functions/v1/gemini-proxy`,
      {
        prompt: 'Привет, как дела?',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxOutputTokens: 100,
        systemInstruction: 'Ты помощник. Отвечай кратко.'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        timeout: 30000
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`✓ Ответ получен за ${elapsed}ms`);
    console.log('Статус:', response.status);
    console.log('Ответ:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
    if (error.code) {
      console.error('Код:', error.code);
    }
  }
}

testSupabaseFunction();
