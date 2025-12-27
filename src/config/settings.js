const settings = {
  botName: "Assistente Irving",
  ownerNumber: process.env.OWNER_NUMBER,
  
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
  }
};

module.exports = { settings };
