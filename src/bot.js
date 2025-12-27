const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { handleMessage } = require('./handlers/base.js');
const database = require('./services/database.js');

require('dotenv').config();

const logger = pino({ level: 'silent' });

// Verificar variáveis de ambiente
if (!process.env.GROQ_API_KEY) {
  console.error('❌ ERRO: GROQ_API_KEY não encontrada no .env');
  console.log('💡 Crie um arquivo .env com: GROQ_API_KEY=sua_chave_aqui');
  process.exit(1);
}

async function startBot() {
    console.log('🚀 Iniciando Assistente Irving Ruas...\n');
    
    // Inicializar banco de dados
    try {
        await database.init();
        console.log('✅ Banco de dados conectado');
    } catch (error) {
        console.error('❌ Erro ao conectar ao banco:', error.message);
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const sock = makeWASocket({
        logger,
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📱 ESCANEIE O QR CODE ABAIXO COM O WHATSAPP:');
            console.log('==============================================');
            qrcode.generate(qr, { small: true });
            console.log('==============================================\n');
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('📡 Conexão fechada. Reconectando em 5 segundos...');
            if (shouldReconnect) {
                setTimeout(startBot, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ CONECTADO AO WHATSAPP!');
            console.log('🤖 Assistente Irving Ruas está ONLINE\n');
            
            // Notificar dono se configurado
            if (process.env.OWNER_NUMBER) {
                try {
                    await sock.sendMessage(process.env.OWNER_NUMBER, {
                        text: `✅ *Assistente Conectado!*\n\nData: ${new Date().toLocaleDateString('pt-BR')}\nHora: ${new Date().toLocaleTimeString('pt-BR')}\nStatus: Pronto para uso`
                    });
                    console.log('📨 Notificação enviada ao dono');
                } catch (error) {
                    console.log('ℹ️ Dono não configurado ou erro na notificação');
                }
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     '';

        if (!text.trim() && !msg.message.imageMessage) {
            await sock.sendMessage(from, { text: '📷 Recebi sua imagem! Para melhor atendimento, descreva o que precisa.' });
            return;
        }

        try {
            await handleMessage(sock, msg, text, from);
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
            try {
                await sock.sendMessage(from, { 
                    text: '⚠️ Desculpe, tive um problema técnico. Pode repetir sua mensagem?' 
                });
            } catch (e) {
                console.error('Erro ao enviar mensagem de erro:', e);
            }
        }
    });

    // Monitorar erros de conexão
    sock.ev.on('connection.update', (update) => {
        if (update.error) {
            console.error('❌ Erro de conexão:', update.error);
        }
    });

    // Lidar com desconexões inesperadas
    process.on('uncaughtException', (error) => {
        console.error('⚠️ Exceção não tratada:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('⚠️ Promessa rejeitada:', reason);
    });
}

// Iniciar o bot
startBot();

// Encerramento gracioso
process.on('SIGINT', async () => {
    console.log('\n\n👋 Encerrando assistente graciosamente...');
    try {
        if (database.db) {
            await database.db.close();
            console.log('✅ Banco de dados fechado');
        }
    } catch (error) {
        console.error('Erro ao fechar banco:', error);
    }
    process.exit(0);
});
