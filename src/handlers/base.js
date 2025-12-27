const { IrvingRuas } = require("../config/personal.js");
const { settings } = require("../config/settings.js");
const { queryAI } = require("../services/ai.js");

let currentMode = 'assistant';

async function handleMessage(sock, msg, text, from) {
  const isOwner = from === settings.ownerNumber;
  
  if (text.startsWith('!')) {
    return handleCommand(sock, msg, text, from, isOwner);
  }
  
  if (currentMode === 'assistant' || isOwner) {
    return handleAIResponse(sock, msg, text, from, isOwner);
  }
  
  if (currentMode === 'away') {
    await sock.sendMessage(from, { text: settings.responses.busy });
    return;
  }
}

async function handleCommand(sock, msg, text, from, isOwner) {
  const command = text.toLowerCase().trim();
  
  switch(command) {
    case '!info':
      await sock.sendMessage(from, { 
        text: `*🤖 Assistente do ${IrvingRuas.nome}*\n\n` +
              `📱 *Site:* ${IrvingRuas.site}\n` +
              `📧 *Email:* ${IrvingRuas.email}\n` +
              `💼 *Serviços:* ${IrvingRuas.servicos.slice(0, 3).join(", ")}`
      });
      break;
      
    case '!servicos':
      const servicesList = IrvingRuas.servicos.map((s, i) => `${i+1}. ${s}`).join('\n');
      await sock.sendMessage(from, { 
        text: `*💼 Serviços do ${IrvingRuas.nome}:*\n\n${servicesList}\n\nPara orçamentos: ${IrvingRuas.email}`
      });
      break;
      
    case '!contato':
      await sock.sendMessage(from, { 
        text: `*📞 Contato Profissional:*\n\n` +
              `🌐 Site: ${IrvingRuas.site}\n` +
              `📧 Email: ${IrvingRuas.email}\n\n` +
              `_Para assuntos urgentes, mencione no email._`
      });
      break;
  }
  
  if (isOwner) {
    switch(command) {
      case '!modo trabalho':
        currentMode = 'work';
        await sock.sendMessage(from, { text: '✅ Modo trabalho ativado. Focado em produtividade.' });
        break;
        
      case '!modo ausente':
        currentMode = 'away';
        await sock.sendMessage(from, { text: '⏸️ Modo ausente ativado. Respostas automáticas.' });
        break;
        
      case '!modo assistente':
        currentMode = 'assistant';
        await sock.sendMessage(from, { text: '🤖 Modo assistente ativado. IA ligada.' });
        break;
        
      case '!status':
        await sock.sendMessage(from, { 
          text: `*Status do Assistente:*\n` +
                `📊 Modo: ${settings.modes[currentMode]}\n` +
                `🔑 Dono: ${isOwner ? 'Sim' : 'Não'}\n` +
                `⚙️ IA: ${currentMode === 'assistant' ? 'Ativa' : 'Inativa'}`
        });
        break;
    }
  }
}

async function handleAIResponse(sock, msg, text, from, isOwner) {
  try {
    const context = {
      mode: currentMode,
      isOwner: isOwner,
      sender: from
    };
    
    await sock.sendMessage(from, { 
      text: '🤔 Pensando...' 
    });
    
    const response = await queryAI(text, context);
    
    await sock.sendMessage(from, { text: response });
    
    if (!isOwner && text.toLowerCase().includes('urgente')) {
      try {
        await sock.sendMessage(settings.ownerNumber, {
          text: `⚠️ *MENSAGEM URGENTE*\nDe: ${from}\nMensagem: ${text.substring(0, 200)}...`
        });
      } catch (error) {
        console.log('Não foi possível notificar o dono');
      }
    }
    
  } catch (error) {
    console.error("Erro no handler:", error);
    await sock.sendMessage(from, { 
      text: "Desculpe, tive um problema técnico. Pode enviar email para " + IrvingRuas.email 
    });
  }
}

module.exports = { handleMessage };
