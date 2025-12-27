const settings = {
  botName: "Assistente Irving",
  ownerNumber: process.env.OWNER_NUMBER || "5531982825422@s.whatsapp.net", // VALOR PADRÃO
  
  autoReplyDelay: 1000,
  maxResponseLength: 4000,
  
  modes: {
    work: "Trabalho ativo - focado em produtividade",
    away: "Ausente - respostas automáticas",
    assistant: "Assistente pessoal - modo completo"
  },
  
  responses: {
    busy: "👨‍💻 Irving está ocupado no momento. Posso ajudar com algo específico?",
    greetings: "Olá! Sou o assistente do Irving Ruas. Em que posso ajudar?",
    ownerOnly: "Desculpe, esse comando é apenas para o Irving."
  },
  
  // Configurações de debug
  debug: process.env.NODE_ENV !== 'production',
  logCommands: true
};

// VALIDAÇÃO DO NÚMERO DO DONO
if (!settings.ownerNumber || !settings.ownerNumber.includes('@s.whatsapp.net')) {
  console.warn('⚠️  OWNER_NUMBER não configurado corretamente no .env');
  console.warn('💡 Adicione no .env: OWNER_NUMBER=5531982825422@s.whatsapp.net');
}

module.exports = { settings };
