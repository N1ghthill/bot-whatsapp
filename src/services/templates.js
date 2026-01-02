// src/services/templates.js - MODERAÇÃO EMOJIS

function mensagemBoasVindas(nome) {
  return nome 
    ? `[RuasBot] Olá ${nome}, tudo bem? Irving Ruas aqui. Como posso ajudar hoje?`
    : '[RuasBot] Olá! Sou RuasBot, assistente do Irving Ruas (ruas.dev.br). Como posso ajudar com análise ou automação?';
}

function mensagemErroGenerico() {
  return '[RuasBot] Tive um problema aqui. Reformula que já respondo.';
}

function mensagemNetworking(texto) {
  const oportunidades = {
    'campanha': 'análise de campanhas Python',
    'dados': 'soluções data-driven',
    'automação': 'processos automatizados',
    'site': 'desenvolvimento fullstack',
    'marketing': 'otimização de tráfego'
  };

  for (const [key, value] of Object.entries(oportunidades)) {
    if (texto.toLowerCase().includes(key)) {
      return `[RuasBot] Irving é especialista em ${value}. Posso mostrar cases do GitHub ou agendar call técnica?`;
    }
  }
  return null;
}

function detectarNetworking(texto) {
  const lower = texto.toLowerCase();
  return /(campanha|dados|automação|python|pandas|sql|site|marketing|tráfego)/i.test(lower);
}

function detectarSaudacao(texto) {
  return /^(oi|olá|ola|eae|hey|hello|bom dia|boa tarde|boa noite)/i.test(texto);
}

function detectarDespedida(texto) {
  return /(obrigado|valeu|grato|agr|até mais|tmj|flw|tchau)/i.test(texto);
}

module.exports = {
  mensagemBoasVindas,
  mensagemErroGenerico,
  mensagemNetworking,
  detectarNetworking,
  detectarSaudacao,
  detectarDespedida
};
