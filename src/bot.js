const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { handleMessage } = require('./handlers/base.js');
const { settings } = require('./config/settings.js');

require('dotenv/config');

const logger = pino({ level: 'silent' });

require('dotenv').config();

// Verificar variáveis de ambiente essenciais
if (!process.env.GROQ_API_KEY) {
  console.error('❌ ERRO: GROQ_API_KEY não encontrada no .env');
  console.log('💡 Dica: Verifique se o arquivo .env existe e contém:');
  console.log('GROQ_API_KEY=sua_chave_aqui');
  process.exit(1);
}

console.log('✅ Variáveis de ambiente carregadas');

async function startBot() {
    console.log('🚀 Iniciando Assistente Irving Ruas...\n');
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const sock = makeWASocket({
        logger,
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.0'],
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 ESCANEIE O QR CODE ABAIXO COM O WHATSAPP:');
            console.log('==============================================');
            qrcode.generate(qr, { small: true });
            console.log('==============================================\n');
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('📡 Conexão fechada. Reconectando...');
            if (shouldReconnect) {
                setTimeout(startBot, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ Conectado ao WhatsApp!');
            console.log('🤖 Assistente Irving Ruas está online\n');
            
            if (settings.ownerNumber) {
                try {
                    await sock.sendMessage(settings.ownerNumber, {
                        text: `✅ Assistente conectado!\nHorário: ${new Date().toLocaleString('pt-BR')}`
                    });
                } catch (error) {
                    // Ignora erro se não houver dono configurado
                }
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     '';

        if (!text.trim() && !msg.message.imageMessage) return;

        try {
            await handleMessage(sock, msg, text, from);
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
        }
    });

    sock.ev.on('connection.update', (update) => {
        if (update.error) {
            console.error('❌ Erro de conexão:', update.error);
        }
    });
}

startBot();

process.on('SIGINT', () => {
    console.log('\n\n👋 Encerrando assistente...');
    process.exit(0);
});
