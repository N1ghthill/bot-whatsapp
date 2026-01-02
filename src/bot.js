// src/bot.js - HUMANIZADO COMPLETO

require('dotenv').config();

const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const {
  init, salvarMensagem, obterHistorico, obterContexto,
  salvarContexto, atualizarNome, obterConversaPorNumero
} = require('./services/database.js');

const { queryAI } = require('./services/ai.js');
const {
  mensagemBoasVindas, mensagemErroGenerico, mensagemNetworking,
  detectarNetworking, detectarSaudacao, detectarDespedida
} = require('./services/templates.js');

function extractText(msg) {
  if (!msg.message) return '';
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message.ephemeralMessage?.message?.conversation) {
    return msg.message.ephemeralMessage.message.conversation;
  }
  return '';
}

// DELAY HUMANIZADO
function delayHumanizado(min = 1200, max = 2800) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function capturarContextoAdicional(numero, texto) {
  const nomeMatch = texto.match(/(meu nome é|sou|chamo-me)\s+(.+)/i);
  if (nomeMatch) await atualizarNome(numero, nomeMatch[2].trim());

  const empresaMatch = texto.match(/(empresa|trabalho na|da empresa)\s+(.+)/i);
  if (empresaMatch) {
    const contexto = await obterContexto(numero);
    await salvarContexto(numero, { ...contexto, empresa: empresaMatch[2].trim() });
  }
}

async function startBot() {
  await init();
  console.log('🗄️ SQLite OK | RuasBot iniciando...');

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    syncFullHistory: false,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) {
      console.log('📱 QR Code RuasBot:');
      require('qrcode-terminal').generate(qr, { small: true });
    }
    if (connection === 'open') console.log('✅ RuasBot online - ruas.dev.br');
    if (connection === 'close') {
      console.log('🔄 Reconectando em 5s...');
      setTimeout(startBot, 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || !msg.key?.remoteJid || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const texto = extractText(msg).trim();
    if (!texto) return;

    console.log(`📩 ${from.substring(0, 15)}: ${texto.substring(0, 60)}...`);

    try {
      await salvarMensagem(from, 'usuario', texto);
      await capturarContextoAdicional(from, texto);

      const contexto = await obterContexto(from);
      const historico = await obterHistorico(from, 12);
      const conversa = await obterConversaPorNumero(from);
      const nome = conversa?.nome || contexto?.nome || null;

      // Templates com delay natural
      if (detectarSaudacao(texto) && historico.length <= 2) {
        const resposta = mensagemBoasVindas(nome);
        await sock.sendMessage(from, { text: resposta });
        await salvarMensagem(from, 'bot', resposta);
        return;
      }

      if (detectarDespedida(texto)) {
        const resposta = '[RuasBot] Valeu! Qualquer coisa técnica é só chamar.';
        await sock.sendMessage(from, { text: resposta });
        await salvarMensagem(from, 'bot', resposta);
        return;
      }

      if (detectarNetworking(texto)) {
        const netResponse = mensagemNetworking(texto);
        if (netResponse) {
          await sock.sendMessage(from, { text: netResponse });
          await salvarMensagem(from, 'bot', netResponse);
          return;
        }
      }

      // IA principal + delay humanizado
      const resposta = await queryAI(texto, from, historico, { ...contexto, nome });
      await delayHumanizado(1200, 2200); // 1.2-2.2s natural
      await sock.sendMessage(from, { text: resposta });
      await salvarMensagem(from, 'bot', resposta);

    } catch (error) {
      console.error('❌ Erro:', error);
      await delayHumanizado(800, 1500);
      const fallback = mensagemErroGenerico();
      await sock.sendMessage(from, { text: fallback });
      await salvarMensagem(from, 'bot', fallback);
    }
  });
}

console.log('🚀 RuasBot iniciando...');
startBot();
