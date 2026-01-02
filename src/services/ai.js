// src/services/ai.js 

require('dotenv').config();

const Groq = require('groq-sdk');
const { getSystemPrompt } = require('./personalityManager.js');

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error('GROQ_API_KEY não configurado no .env');
}

const client = new Groq({ apiKey });

function buildMessagesFromHistory(systemPrompt, history, userMessage) {
  const messages = [{ role: 'system', content: systemPrompt }];

  if (Array.isArray(history) && history.length) {
    for (const item of history.slice(-8)) {
      const role = item.remetente === 'usuario' ? 'user' : 'assistant';
      messages.push({ role, content: item.mensagem });
    }
  }

  messages.push({ role: 'user', content: userMessage });
  return messages;
}

async function queryAI(prompt, phoneNumber = null, history = [], context = {}) {
  try {
    const systemPrompt = getSystemPrompt(context, history);
    const messages = buildMessagesFromHistory(systemPrompt, history, prompt);

    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.75,
      max_tokens: 220,
      top_p: 0.88,
      frequency_penalty: 0.4
    });

    let resposta = completion.choices[0].message.content || '';

    // [RuasBot] natural
    if (!resposta.toLowerCase().startsWith('[ruasbot]')) {
      resposta = `[RuasBot] ${resposta}`;
    }

    // Limpeza humanizada
    resposta = resposta
      .replace(/^(\[RuasBot\])\s*(Hmm|Hum|Bem|Então|Olha)\s*,?/gi, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 750);

    // Verificar excesso de emojis (máx 2)
    const emojiCount = (resposta.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
    if (emojiCount > 2) {
      resposta = resposta.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    }

    return resposta || '[RuasBot] Entendi. Pode dar mais detalhes do que precisa?';
  } catch (err) {
    console.error('❌ Erro IA:', err.message);
    return '[RuasBot] Deixa eu verificar aqui. Tenta mandar de novo?';
  }
}

module.exports = {
  queryAI
};
