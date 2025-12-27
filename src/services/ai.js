require('dotenv').config();
const { Groq } = require("groq-sdk");
const { IrvingRuas } = require("../config/personal.js");
const { settings } = require("../config/settings.js");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Memória simples em cache (substituiremos por SQLite depois)
const memoriaCache = new Map();

async function queryAI(userMessage, context = {}) {
  const { from: numero, isOwner } = context;
  
  // Obter memória deste contato
  if (!memoriaCache.has(numero)) {
    memoriaCache.set(numero, {
      nome: null,
      empresa: null,
      historico: [],
      contexto: {}
    });
  }
  
  const memoria = memoriaCache.get(numero);
  
  // Adicionar ao histórico
  memoria.historico.push({
    remetente: 'usuario',
    mensagem: userMessage,
    timestamp: new Date().toISOString()
  });
  
  // Manter apenas últimos 10 itens
  if (memoria.historico.length > 10) {
    memoria.historico = memoria.historico.slice(-10);
  }
  
  // Extrair informações
  if (userMessage.toLowerCase().includes('me chamo') || userMessage.toLowerCase().includes('nome é')) {
    const nomeMatch = userMessage.match(/me chamo\s+(\w+)/i) || 
                     userMessage.match(/nome é\s+(\w+)/i) ||
                     userMessage.match(/sou o\s+(\w+)/i);
    if (nomeMatch) {
      memoria.nome = nomeMatch[1];
      memoria.contexto.nome_usuario = nomeMatch[1];
    }
  }
  
  // Formatar histórico
  const historicoFormatado = memoria.historico
    .map(msg => `${msg.remetente === 'usuario' ? 'Usuário' : 'Assistente'}: ${msg.mensagem}`)
    .join('\n');
  
  const systemPrompt = `
  Você é o assistente pessoal do ${IrvingRuas.nome}, ${IrvingRuas.profissao}.
  
  INFORMAÇÕES DO IRVING:
  - Site: ${IrvingRuas.site}
  - Email: ${IrvingRuas.email}
  - Serviços: ${IrvingRuas.servicos.join(", ")}
  
  ${memoria.nome ? `O usuário se chama: ${memoria.nome}` : ''}
  
  HISTÓRICO DA CONVERSA (últimas mensagens):
  ${historicoFormatado || 'Nenhuma mensagem anterior'}
  
  INSTRUÇÕES:
  1. Se o usuário já se apresentou, use o nome dele
  2. Mantenha coerência com o histórico da conversa
  3. Para orçamentos e assuntos comerciais, direcione para ${IrvingRuas.email}
  4. Seja útil, profissional e direto
  5. Mantenha respostas curtas (2-3 parágrafos)
  
  Responda em português brasileiro.
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 500
    });

    const resposta = completion.choices[0]?.message?.content || "Não consegui processar sua mensagem.";
    
    // Salvar resposta no histórico
    memoria.historico.push({
      remetente: 'assistente',
      mensagem: resposta,
      timestamp: new Date().toISOString()
    });
    
    return resposta;
    
  } catch (error) {
    console.error("Erro no Groq:", error.message);
    
    // Fallback inteligente
    return getFallbackResponse(userMessage, IrvingRuas, memoria);
  }
}

function getFallbackResponse(userMessage, IrvingRuas, memoria) {
  const lowerMsg = userMessage.toLowerCase();
  
  if (lowerMsg.includes('olá') || lowerMsg.includes('oi') || lowerMsg.includes('bom dia')) {
    const saudacao = memoria.nome ? `Olá ${memoria.nome}!` : 'Olá!';
    return `${saudacao} Sou o assistente do ${IrvingRuas.nome}. Em que posso ajudar?`;
  }
  
  if (lowerMsg.includes('orçamento') || lowerMsg.includes('preço') || lowerMsg.includes('quanto')) {
    return `Para orçamentos, por favor envie um email para ${IrvingRuas.email} com os detalhes do seu projeto. Assim ${IrvingRuas.nome} poderá analisar e retornar com uma proposta adequada.`;
  }
  
  if (lowerMsg.includes('serviço') || lowerMsg.includes('faz') || lowerMsg.includes('trabalho')) {
    return `${IrvingRuas.nome} oferece os seguintes serviços:\n${IrvingRuas.servicos.map(s => `• ${s}`).join('\n')}\n\nPara mais informações: ${IrvingRuas.email}`;
  }
  
  if (lowerMsg.includes('contato') || lowerMsg.includes('email') || lowerMsg.includes('site')) {
    return `📞 *Contatos do ${IrvingRuas.nome}:*\n🌐 Site: ${IrvingRuas.site}\n📧 Email: ${IrvingRuas.email}\n\n_Estou aqui para ajudar com informações básicas!_`;
  }
  
  if (memoria.nome) {
    return `${memoria.nome}, recebi sua mensagem. No momento, estou com limitações técnicas. Para uma resposta completa, envie um email para ${IrvingRuas.email} ou visite ${IrvingRuas.site}`;
  }
  
  return `Obrigado pela mensagem! Para assuntos específicos, entre em contato por email: ${IrvingRuas.email}`;
}

module.exports = { queryAI };
