const { IrvingRuas } = require("../config/personal.js");
const { settings } = require("../config/settings.js");
const { queryAI } = require("../services/ai.js");
const database = require("../services/database.js");

let currentMode = 'assistant';

async function handleMessage(sock, msg, text, from) {
  // REMOVER ESPAÇOS E CONVERTER PARA MINÚSCULAS PARA COMPARAÇÃO
  const cleanedText = text.trim().toLowerCase();
  const isOwner = from === settings.ownerNumber;
  
  console.log(`📨 Mensagem de ${isOwner ? 'DONO' : 'usuário'}: ${from}`);
  console.log(`📝 Texto: ${text.substring(0, 50)}...`);
  
  // Registrar interação no banco
  try {
    await database.getOuCriarConversa(from);
    await database.salvarMensagem(from, 'usuario', text);
  } catch (dbError) {
    console.error('Erro no banco de dados:', dbError.message);
  }
  
  // COMANDOS começam com '!' (verificar PRIMEIRO se é dono para comandos especiais)
  if (cleanedText.startsWith('!')) {
    console.log(`⚡ Comando detectado: ${cleanedText}`);
    return handleCommand(sock, msg, cleanedText, from, isOwner);
  }
  
  // Tratar modos de operação
  switch(currentMode) {
    case 'work':
      await handleWorkMode(sock, from, text, isOwner);
      break;
      
    case 'away':
      await sock.sendMessage(from, { 
        text: `⏸️ ${settings.responses.busy}\n\nPosso ajudar com:\n• Informações básicas (!info)\n• Serviços oferecidos (!servicos)\n• Contato profissional (!contato)` 
      });
      break;
      
    case 'assistant':
    default:
      if (isOwner || currentMode === 'assistant') {
        return handleAIResponse(sock, msg, text, from, isOwner);
      }
      break;
  }
}

async function handleCommand(sock, msg, command, from, isOwner) {
  console.log(`🎯 Processando comando: ${command} | Dono: ${isOwner}`);
  
  // LISTA DE COMANDOS PÚBLICOS (todos podem usar)
  const publicCommands = {
    '!info': async () => {
      await sock.sendMessage(from, { 
        text: `*🤖 ASSISTENTE DO ${IrvingRuas.nome.toUpperCase()}*\n\n` +
              `💼 *Profissão:* ${IrvingRuas.profissao}\n` +
              `🎓 *Formação:* ${IrvingRuas.formacao}\n` +
              `🌐 *Site:* ${IrvingRuas.site}\n` +
              `📧 *Email:* ${IrvingRuas.email}\n` +
              `📍 *Localização:* ${IrvingRuas.localizacao}\n\n` +
              `_Use !servicos para ver serviços ou !contato para informações de contato._`
      });
    },
    
    '!servicos': async () => {
      const servicesList = IrvingRuas.servicos.map((s, i) => `${i+1}. ${s}`).join('\n');
      await sock.sendMessage(from, { 
        text: `*💼 SERVIÇOS DO ${IrvingRuas.nome.toUpperCase()}:*\n\n${servicesList}\n\n` +
              `*🎯 Objetivo:* ${IrvingRuas.objetivo}\n\n` +
              `💻 *GitHub:* ${IrvingRuas.github}\n\n` +
              `📨 *Para orçamentos:* ${IrvingRuas.email}`
      });
    },
    
    '!contato': async () => {
      await sock.sendMessage(from, { 
        text: `*📞 CONTATO PROFISSIONAL:*\n\n` +
              `👤 *Nome:* ${IrvingRuas.nome}\n` +
              `💼 *Profissão:* ${IrvingRuas.profissao}\n` +
              `🌐 *Site:* ${IrvingRuas.site}\n` +
              `📧 *Email:* ${IrvingRuas.email}\n` +
              `💻 *GitHub:* ${IrvingRuas.github}\n` +
              `📍 *Localização:* ${IrvingRuas.localizacao}\n\n` +
              `⏰ *Tempo de resposta:* Até 24 horas\n` +
              `🌎 *Disponibilidade:* Projetos globais`
      });
    },
    
    '!ajuda': async () => {
      await sock.sendMessage(from, { 
        text: `*🆘 COMANDOS DISPONÍVEIS:*\n\n` +
              `ℹ️ *Informações*\n` +
              `!info - Informações sobre ${IrvingRuas.nome}\n` +
              `!servicos - Lista de serviços oferecidos\n` +
              `!contato - Contatos profissionais\n` +
              `!ajuda - Esta mensagem de ajuda\n\n` +
              `👑 *Comandos do Dono* ${isOwner ? '(✅ Disponíveis)' : '(❌ Apenas para Irving)'}\n` +
              `!modo trabalho - Ativa modo produtivo\n` +
              `!modo ausente - Ativa respostas automáticas\n` +
              `!modo assistente - Ativa IA completa\n` +
              `!status - Status do bot\n` +
              `!estatisticas - Estatísticas de uso\n\n` +
              `💬 *Conversa normal:* Apenas escreva sua mensagem!`
      });
    },
    
    '!help': async () => {
      await sock.sendMessage(from, { 
        text: `*🆘 COMANDOS DISPONÍVEIS:*\n\n` +
              `ℹ️ *Informações*\n` +
              `!info - Informações sobre ${IrvingRuas.nome}\n` +
              `!servicos - Lista de serviços oferecidos\n` +
              `!contato - Contatos profissionais\n` +
              `!ajuda - Esta mensagem de ajuda\n\n` +
              `👑 *Comandos do Dono* ${isOwner ? '(✅ Disponíveis)' : '(❌ Apenas para Irving)'}\n` +
              `!modo trabalho - Ativa modo produtivo\n` +
              `!modo ausente - Ativa respostas automáticas\n` +
              `!modo assistente - Ativa IA completa\n` +
              `!status - Status do bot\n` +
              `!estatisticas - Estatísticas de uso\n\n` +
              `💬 *Conversa normal:* Apenas escreva sua mensagem!`
      });
    }
  };
  
  // LISTA DE COMANDOS APENAS PARA DONO
  const ownerCommands = {
    '!modo trabalho': async () => {
      currentMode = 'work';
      await sock.sendMessage(from, { 
        text: '✅ *MODO TRABALHO ATIVADO*\n\nRespostas rápidas e focadas. IA limitada apenas para dono.' 
      });
      console.log(`🔄 Modo alterado para: ${currentMode} por ${from}`);
    },
    
    '!modo ausente': async () => {
      currentMode = 'away';
      await sock.sendMessage(from, { 
        text: '⏸️ *MODO AUSENTE ATIVADO*\n\nRespostas automáticas ativadas para todos.' 
      });
      console.log(`🔄 Modo alterado para: ${currentMode} por ${from}`);
    },
    
    '!modo assistente': async () => {
      currentMode = 'assistant';
      await sock.sendMessage(from, { 
        text: '🤖 *MODO ASSISTENTE ATIVADO*\n\nIA completa ativada para todas as conversas.' 
      });
      console.log(`🔄 Modo alterado para: ${currentMode} por ${from}`);
    },
    
    '!status': async () => {
      const stats = await database.getEstatisticas();
      await sock.sendMessage(from, { 
        text: `*📊 STATUS DO ASSISTENTE:*\n\n` +
              `🤖 *Modo atual:* ${settings.modes[currentMode]}\n` +
              `👥 *Contatos atendidos:* ${stats?.total_contatos || 0}\n` +
              `💬 *Total mensagens:* ${stats?.total_mensagens || 0}\n` +
              `📅 *Mensagens hoje:* ${stats?.mensagens_hoje || 0}\n` +
              `🕐 *Última mensagem:* ${stats?.ultima_mensagem ? new Date(stats.ultima_mensagem).toLocaleString('pt-BR') : 'N/A'}\n\n` +
              `✅ *Sistema operacional*` 
      });
    },
    
    '!estatisticas': async () => {
      const estatisticas = await database.getEstatisticas();
      const conversasRecentes = await database.getConversasRecentes(5);
      
      let conversasTexto = '';
      if (conversasRecentes.length > 0) {
        conversasTexto = `\n*📞 Últimos contatos:*\n`;
        conversasRecentes.forEach((conv, i) => {
          const nome = conv.nome || 'Sem nome';
          const tempo = new Date(conv.ultima_interacao).toLocaleString('pt-BR');
          conversasTexto += `${i+1}. ${nome} (${conv.total_mensagens} msgs) - ${tempo}\n`;
        });
      }
      
      await sock.sendMessage(from, { 
        text: `*📈 ESTATÍSTICAS DETALHADAS:*\n\n` +
              `👥 *Contatos únicos:* ${estatisticas?.total_contatos || 0}\n` +
              `💬 *Total de mensagens:* ${estatisticas?.total_mensagens || 0}\n` +
              `📊 *Mensagens hoje:* ${estatisticas?.mensagens_hoje || 0}\n` +
              `📅 *Primeira mensagem:* ${estatisticas?.primeira_mensagem ? new Date(estatisticas.primeira_mensagem).toLocaleDateString('pt-BR') : 'N/A'}\n` +
              `⏰ *Hora servidor:* ${new Date().toLocaleTimeString('pt-BR')}` +
              conversasTexto
      });
    },
    
    // Comandos de debug/diagnóstico
    '!debug': async () => {
      await sock.sendMessage(from, { 
        text: `*🐛 DEBUG INFO:*\n\n` +
              `📱 *Seu número:* ${from}\n` +
              `🔑 *Owner config:* ${settings.ownerNumber}\n` +
              `✅ *É dono?* ${isOwner ? 'SIM' : 'NÃO'}\n` +
              `🤖 *Modo atual:* ${currentMode}\n` +
              `📊 *DB conectado:* ${database.db ? 'SIM' : 'NÃO'}\n` +
              `🔧 *Ambiente:* ${process.env.NODE_ENV || 'development'}`
      });
    },
    
    '!reiniciar': async () => {
      await sock.sendMessage(from, { 
        text: '🔄 *REINICIANDO SISTEMA...*\n\nO bot será reiniciado em 3 segundos.' 
      });
      console.log(`🔄 Reinício solicitado por: ${from}`);
      setTimeout(() => {
        console.log('🔄 Reiniciando processo...');
        process.exit(0); // Será reiniciado pelo sistema (PM2 ou similar)
      }, 3000);
    }
  };
  
  // PRIMEIRO: Verificar se é comando público
  if (publicCommands[command]) {
    console.log(`✅ Executando comando público: ${command}`);
    try {
      await publicCommands[command]();
      return;
    } catch (error) {
      console.error(`❌ Erro no comando público ${command}:`, error);
      await sock.sendMessage(from, { 
        text: `❌ Erro ao executar comando. Tente novamente.` 
      });
      return;
    }
  }
  
  // SEGUNDO: Verificar se é comando de dono
  if (ownerCommands[command]) {
    if (isOwner) {
      console.log(`✅ Executando comando de dono: ${command}`);
      try {
        await ownerCommands[command]();
      } catch (error) {
        console.error(`❌ Erro no comando de dono ${command}:`, error);
        await sock.sendMessage(from, { 
          text: `❌ Erro no comando de administração.` 
        });
      }
    } else {
      console.log(`🚫 Tentativa de comando de dono por não-autorizado: ${command}`);
      await sock.sendMessage(from, { 
        text: `🚫 *Acesso negado!*\n\nEste comando é exclusivo para ${IrvingRuas.nome}.` 
      });
    }
    return;
  }
  
  // TERCEIRO: Verificar comandos parciais (com argumentos)
  if (command.startsWith('!modo ')) {
    if (isOwner) {
      const modo = command.split(' ')[1];
      if (modo === 'trabalho' || modo === 'work') {
        currentMode = 'work';
        await sock.sendMessage(from, { 
          text: '✅ *MODO TRABALHO ATIVADO*' 
        });
      } else if (modo === 'ausente' || modo === 'away') {
        currentMode = 'away';
        await sock.sendMessage(from, { 
          text: '⏸️ *MODO AUSENTE ATIVADO*' 
        });
      } else if (modo === 'assistente' || modo === 'assistant') {
        currentMode = 'assistant';
        await sock.sendMessage(from, { 
          text: '🤖 *MODO ASSISTENTE ATIVADO*' 
        });
      } else {
        await sock.sendMessage(from, { 
          text: `❌ Modo desconhecido. Use:\n!modo trabalho\n!modo ausente\n!modo assistente` 
        });
      }
    } else {
      await sock.sendMessage(from, { 
        text: `🚫 Comando exclusivo para ${IrvingRuas.nome}.` 
      });
    }
    return;
  }
  
  // Comando não reconhecido
  console.log(`❓ Comando desconhecido: ${command}`);
  await sock.sendMessage(from, { 
    text: `❌ Comando desconhecido: ${command}\n\nUse *!ajuda* para ver comandos disponíveis.` 
  });
}

// O restante do código permanece igual (handleWorkMode, handleAIResponse, etc.)
// ... [mantenha as funções handleWorkMode e handleAIResponse exatamente como estão] ...

async function handleWorkMode(sock, from, text, isOwner) {
  const keywords = {
    'orçamento': '💰 Para orçamentos, envie email para ' + IrvingRuas.email,
    'preço': '💰 Para orçamentos, envie email para ' + IrvingRuas.email,
    'contato': `📞 *Contato:*\nEmail: ${IrvingRuas.email}\nSite: ${IrvingRuas.site}`,
    'serviço': `💼 *Serviços:* ${IrvingRuas.servicos.slice(0, 3).join(', ')}...\nUse !servicos para lista completa`,
    'site': `🌐 Site: ${IrvingRuas.site}`,
    'email': `📧 Email: ${IrvingRuas.email}`,
    'olá': `👋 Olá! Irving está em modo trabalho. Em que posso ajudar rapidamente?`,
    'oi': `👋 Olá! Irving está em modo trabalho. Em que posso ajudar rapidamente?`
  };
  
  const lowerText = text.toLowerCase();
  let response = null;
  
  for (const [key, value] of Object.entries(keywords)) {
    if (lowerText.includes(key)) {
      response = value;
      break;
    }
  }
  
  if (!response) {
    response = `👨‍💻 ${IrvingRuas.nome} está em modo trabalho focado.\n\nPara ajuda rápida, mencione:\n• "orçamento" ou "preço"\n• "contato"\n• "serviço"\n• Ou use !info para informações completas`;
  }
  
  await sock.sendMessage(from, { text: response });
  
  // Se dono no modo trabalho, ainda processa IA
  if (isOwner && text.length > 10) {
    setTimeout(async () => {
      try {
        const aiResponse = await queryAI(text, { from, isOwner, mode: 'work' });
        await sock.sendMessage(from, { 
          text: `💡 (Resposta IA no modo trabalho):\n${aiResponse}` 
        });
      } catch (error) {
        console.error('Erro IA modo trabalho:', error);
      }
    }, 1000);
  }
}

async function handleAIResponse(sock, msg, text, from, isOwner) {
  try {
    // Indicador de digitação
    await sock.sendPresenceUpdate('composing', from);
    
    const context = {
      from: from,
      mode: currentMode,
      isOwner: isOwner,
      timestamp: new Date().toISOString()
    };
    
    const response = await queryAI(text, context);
    
    // Salvar resposta no banco
    await database.salvarMensagem(from, 'assistente', response);
    
    await sock.sendMessage(from, { text: response });
    
    // Notificar dono sobre mensagens urgentes
    if (!isOwner && text.toLowerCase().includes('urgente')) {
      try {
        const contato = await database.getOuCriarConversa(from);
        await sock.sendMessage(settings.ownerNumber, {
          text: `⚠️ *MENSAGEM URGENTE IDENTIFICADA*\n\n` +
                `👤 De: ${from}\n` +
                `📝 Mensagem: ${text.substring(0, 150)}${text.length > 150 ? '...' : ''}\n` +
                `🕐 Horário: ${new Date().toLocaleTimeString('pt-BR')}\n` +
                `📊 Contato salvo no banco: ${contato.nome ? `Nome: ${contato.nome}` : 'Sem nome registrado'}`
        });
      } catch (notifyError) {
        console.error('Erro ao notificar dono:', notifyError);
      }
    }
    
  } catch (error) {
    console.error("❌ Erro no handler AI:", error);
    
    // Fallback para erros
    const fallbackResponse = `Desculpe, tive um problema técnico ao processar sua mensagem.\n\n` +
                            `Por favor, tente:\n1. Repetir sua pergunta\n2. Usar !info para informações básicas\n3. Email direto: ${IrvingRuas.email}`;
    
    await sock.sendMessage(from, { text: fallbackResponse });
    
    // Registrar erro no banco
    try {
      await database.salvarMensagem(from, 'sistema', `ERRO: ${error.message}`);
    } catch (dbError) {
      console.error('Erro ao registrar erro no banco:', dbError);
    }
  } finally {
    // Parar indicador de digitação
    await sock.sendPresenceUpdate('available', from);
  }
}

module.exports = { handleMessage, currentMode };
