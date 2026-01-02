# BotAssist - Assistente WhatsApp IA

[![Node.js](https://img.shields.io/badge/Node.js-v20-green.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Baileys-25D366.svg)](https://github.com/WhiskeySockets/Baileys)

**BotAssist** é um assistente inteligente de WhatsApp com IA Groq (Llama 3.3 70B). Funciona 24/7 como extensão pessoal/profissional, gerenciando conversas, lembrando contextos e otimizando comunicação.

## ✨ Funcionalidades

- ✅ **IA Conversacional** - Groq Llama 3.3 70B com personalidade customizável
- ✅ **Persistência SQLite** - Histórico completo + contexto por usuário
- ✅ **Networking Inteligente** - Detecta oportunidades técnicas/marketing
- ✅ **Delay Humanizado** - Respostas naturais (1-3s)
- ✅ **Zero Dependências Extras** - Apenas 6 pacotes essenciais
- ✅ **Multi-dispositivo** - Baileys nativo

## 🚀 Instalação Rápida

```bash
# 1. Clonar
git clone https://github.com/N1ghthill/BotAssist.git
cd BotAssist

# 2. Instalar
npm install

# 3. Configurar (.env)
cp .env.example .env
# Edite GROQ_API_KEY=seu_token

# 4. Iniciar
npm start

## 📁 Estrutura Limpa

📦 15 arquivos | ~2MB total
├── src/bot.js (principal)
├── src/services/ (IA + DB)
├── assistente.db (SQLite)
├── auth_info/ (WhatsApp)
└── package.json (minimalista)

## ⚙️ Configuração (.env)

GROQ_API_KEY=seu_token_groq
NODE_ENV=production
PORT=3000

## 🛠️ Comandos

npm start      # Produção
npm run dev    # Desenvolvimento
npm run clean  # Reset auth + deps
npm run backup # Backup DB

## 📊 Dependências Mínimas

@whiskeysockets/baileys  # WhatsApp
groq-sdk                # IA
sqlite3                 # Banco
dotenv + qrcode         # Utils

## 🔒 Segurança

✅ Credenciais criptografadas (Baileys nativo)

✅ Rate limiting interno

✅ Zero webserver exposto

✅ SQLite WAL mode otimizado

## 📈 Performance

⚡ 1.2-2.8s delay humanizado
⚡ <50ms consulta SQLite
⚡ 250 tokens resposta máxima
⚡ 100% uptime (reconecta auto)
