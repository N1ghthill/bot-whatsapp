# 🤖 Assistente WhatsApp - Irving Ruas

[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Assistente pessoal de WhatsApp com IA integrada (Groq) e sistema de memória de conversa. Desenvolvido para ser o assistente digital de Irving Ruas - Desenvolvedor Full-Stack & Gestor de Tráfego.

![Demo](https://img.shields.io/badge/Demo-Funcionando-success)

## ✨ Funcionalidades

- **🤖 IA Integrada:** Respostas inteligentes usando Groq API
- **🧠 Memória de Conversa:** Lembra nome, contexto e histórico
- **🎯 Comandos Rápidos:** `!info`, `!servicos`, `!contato`
- **👑 Modos de Operação:** Trabalho, Ausente, Assistente
- **📊 Banco de Dados:** SQLite para persistência de dados
- **🔄 Reconexão Automática:** Reconecta em caso de queda

## 🚀 Começando

### Pré-requisitos
- Node.js 20 ou superior
- Conta no [Groq Cloud](https://console.groq.com/)
- Número de WhatsApp

### Instalação

```bash
# Clone o repositório
git clone https://github.com/N1ghthill/bot-whatsapp.git
cd bot-whatsapp

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves
