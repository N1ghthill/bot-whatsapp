require('dotenv').config();
const { Groq } = require("groq-sdk");
const { IrvingRuas } = require("../config/personal.js");
const database = require("./database.js");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: 30000,
  maxRetries: 2
});

// Cache em memória para performance (complementa banco)
const cacheMemoria = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function queryAI(userMessage, context = {}) {
  const { from: numero, isOwner, mode = 'assistant' } = context;
  
  // Verificar se banco está inicializado
  if (!database.db) {
    try {
      await database.init();
    } catch (error) {
      console.error('❌ Não foi possível inicializar banco:', error);
      return getFallbackResponse(userMessage, IrvingRuas, {});
    }
  }
  
  try {
    // Obter dados do banco
    const conversa = await database.getOuCriarConversa(numero);
    const historicoDB = await database.getHistoricoConversa(numero, 8); // Últimas 8 mensagens
    const contextoDB = await database.getContexto(numero);
    
    // Extrair nome do usuário se mencionado
    let nomeUsuario = contextoDB.nome_usuario || conversa.nome;
    
    if (!nomeUsuario) {
      const nomeMatch = extractName(userMessage);
      if (nomeMatch) {
        nomeUsuario = nomeMatch;
        await database.salvarFato(numero, 'nome_usuario', nomeUsuario);
        await database.atualizarContexto(numero, { ...contextoDB, nome_usuario: nomeUsuario });
      }
    }
    
    // Extrair empresa se mencionada
    if (userMessage.toLowerCase().includes('empresa') || userMessage.toLowerCase().includes('trabalho na')) {
      const empresaMatch = userMessage.match(/(empresa|trabalho na|empresa é)\s+([^.?!,]+)/i);
      if (empresaMatch && empresaMatch[2]) {
        await database.salvarFato(numero, 'empresa_usuario', empresaMatch[2].trim());
      }
    }
    
    // Formatar histórico
    const historicoFormatado = historicoDB.length > 0 
      ? historicoDB.map(msg => `${msg.remetente === 'usuario' ? '👤 Usuário' : '🤖 Assistente'}: ${msg.mensagem}`).join('\n')
      : 'Nenhuma conversa anterior registrada.';
    
    // Criar prompt baseado no modo
    const systemPrompt = createSystemPrompt(mode, nomeUsuario, historicoFormatado);
    
    // Chamar Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: mode === 'assistant' ? 0.7 : 0.5, // Mais preciso no modo trabalho
      max_tokens: 600,
      top_p: 0.9,
      stream: false
    });

    const resposta = completion.choices[0]?.message?.content || "Não consegui gerar uma resposta. Pode reformular sua pergunta?";
    
    // Salvar no cache para performance
    const cacheKey = `${numero}:${userMessage.substring(0, 50)}`;
    cacheMemoria.set(cacheKey, {
      resposta: resposta,
      timestamp: Date.now()
    });
    
    // Limpar cache antigo
    cleanupCache();
    
    return resposta;
    
  } catch (error) {
    console.error("❌ Erro no Groq API:", error.message);
    
    // Verificar se é erro de API ou timeout
    if (error.message.includes('timeout') || error.message.includes('rate limit')) {
      return `⏱️ Estou com lentidão no momento. ${getFallbackResponse(userMessage, IrvingRuas, {})}`;
    }
    
    if (error.message.includes('authentication') || error.message.includes('API key')) {
      console.error('🔑 ERRO DE AUTENTICAÇÃO GROQ: Verifique sua API_KEY no .env');
      return `🔒 Problema técnico temporário. Por favor, envie email para ${IrvingRuas.email}`;
    }
    
    return getFallbackResponse(userMessage, IrvingRuas, {});
  }
}

function createSystemPrompt(mode, nomeUsuario, historico) {
  const modoInstrucoes = {
    'assistant': 'Você é um assistente pessoal completo. Seja útil, detalhado e atencioso.',
    'work': 'Você está em modo trabalho. Seja direto, objetivo e focado em produtividade.',
    'away': 'Você está em modo ausente. Seja breve e direcione para respostas automáticas.'
  };
  
  return `
  # IDENTIDADE
  Você é o assistente pessoal do ${IrvingRuas.nome}, ${IrvingRuas.profissao}.
  
  # INFORMAÇÕES DO IRVING
  - 🌐 Site: ${IrvingRuas.site}
  - 📧 Email: ${IrvingRuas.email}
  - 💼 Serviços: ${IrvingRuas.servicos.join(", ")}
  - 🎓 Formação: ${IrvingRuas.formacao}
  - 🎯 Objetivo: ${IrvingRuas.objetivo}
  - 💻 GitHub: ${IrvingRuas.github}
  - 📍 Localização: ${IrvingRuas.localizacao}
  
  # CONTEXTO DA CONVERSA
  ${nomeUsuario ? `👤 O usuário se chama: ${nomeUsuario}` : '👤 Usuário não identificado ainda'}
  
  # HISTÓRICO RECENTE (últimas mensagens):
  ${historico}
  
  # MODO DE OPERAÇÃO: ${mode.toUpperCase()}
  ${modoInstrucoes[mode] || modoInstrucoes['assistant']}
  
  # REGRAS DE RESPOSTA:
  1. ${nomeUsuario ? `Use o nome "${nomeUsuario}" quando apropriado` : 'Se o usuário mencionar nome, registre e use'}
  2. Para orçamentos/assuntos comerciais: direcione para ${IrvingRuas.email}
  3. Mantenha respostas ${mode === 'work' ? 'curtas (1-2 parágrafos)' : 'adequadas ao contexto'}
  4. Seja profissional mas acessível
  5. Responda em português brasileiro natural
  6. Se não souber algo, seja honesto e direcione para o email
  
  # FORMATAÇÃO:
  - Use *negrito* para ênfase
  - Use emojis relevantes
  - Estruture com quebras de linha para melhor leitura no WhatsApp
  
  Agora responda à última mensagem do usuário de forma apropriada ao contexto acima.
  `;
}

function extractName(message) {
  const lowerMsg = message.toLowerCase();
  
  const patterns = [
    /me chamo\s+([A-Za-zÀ-ÿ\s]{2,})/i,
    /nome é\s+([A-Za-zÀ-ÿ\s]{2,})/i,
    /sou o\s+([A-Za-zÀ-ÿ\s]{2,})/i,
    /sou a\s+([A-Za-zÀ-ÿ\s]{2,})/i,
    /pode me chamar de\s+([A-Za-zÀ-ÿ\s]{2,})/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const nome = match[1].trim();
      // Capitalizar nome
      return nome.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
  }
  
  return null;
}

function getFallbackResponse(userMessage, IrvingRuas, memoria) {
  const lowerMsg = userMessage.toLowerCase();
  
  if (lowerMsg.includes('olá') || lowerMsg.includes('oi') || lowerMsg.includes('bom') || lowerMsg.includes('boa')) {
    const saudacao = memoria.nome ? `Olá ${memoria.nome}!` : 'Olá!';
    const hora = new Date().getHours();
    const periodo = hora < 12 ? 'bom dia' : hora < 18 ? 'boa tarde' : 'boa noite';
    
    return `${saudacao} ${periodo}! Sou o assistente do ${IrvingRuas.nome}. Em que posso ajudar?`;
  }
  
  if (lowerMsg.includes('orçamento') || lowerMsg.includes('preço') || lowerMsg.includes('quanto') || lowerMsg.includes('valor')) {
    return `💰 *Para orçamentos:*\n\nEnvie um email para ${IrvingRuas.email} com:\n1. Descrição do projeto\n2. Prazo desejado\n3. Orçamento aproximado (se tiver)\n\n${IrvingRuas.nome} responderá em até 24 horas.`;
  }
  
  if (lowerMsg.includes('serviço') || lowerMsg.includes('faz') || lowerMsg.includes('trabalho') || lowerMsg.includes('oferece')) {
    return `💼 *Serviços do ${IrvingRuas.nome}:*\n\n${IrvingRuas.servicos.map(s => `• ${s}`).join('\n')}\n\nPara detalhes específicos: ${IrvingRuas.email}`;
  }
  
  if (lowerMsg.includes('contato') || lowerMsg.includes('email') || lowerMsg.includes('site') || lowerMsg.includes('telefone')) {
    return `📞 *Contatos profissionais:*\n\n🌐 Site: ${IrvingRuas.site}\n📧 Email: ${IrvingRuas.email}\n💻 GitHub: ${IrvingRuas.github}\n📍 ${IrvingRuas.localizacao}\n\n⏰ Resposta em até 24 horas.`;
  }
  
  if (lowerMsg.includes('tempo') || lowerMsg.includes('disponível') || lowerMsg.includes('horário')) {
    return `⏰ *Disponibilidade:*\n\n• Resposta a emails: Até 24 horas\n• Trabalho remoto: Projetos globais\n• Fuso horário: Brasil (GMT-3)\n\nPara agendar uma call: ${IrvingRuas.email}`;
  }
  
  if (memoria.nome) {
    return `${memoria.nome}, recebi sua mensagem. No momento estou com limitações técnicas.\n\nPara uma resposta completa:\n📧 Email: ${IrvingRuas.email}\n🌐 Site: ${IrvingRuas.site}`;
  }
  
  return `Obrigado pela sua mensagem! Para um atendimento personalizado:\n\n📧 Email: ${IrvingRuas.email}\n🌐 Site: ${IrvingRuas.site}\n\nEstou aqui para ajudar com informações básicas no momento.`;
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cacheMemoria.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cacheMemoria.delete(key);
    }
  }
}

module.exports = { queryAI };
