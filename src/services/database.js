// src/services/database.js

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '..', '..', 'assistente.db');
  }

  async init() {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
    await this.createIndexes();
  }

  async createTables() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL UNIQUE,
        nome TEXT,
        empresa TEXT,
        email TEXT,
        ultima_interacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        contexto TEXT DEFAULT '{}',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS mensagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversa_id INTEGER NOT NULL,
        remetente TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversa_id) REFERENCES conversas(id)
      );
    `);
  }

  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_conversas_numero ON conversas(numero)',
      'CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id ON mensagens(conversa_id)'
    ];

    for (const sql of indexes) {
      await this.db.exec(sql);
    }
  }

  async getOuCriarConversa(numero) {
    let conversa = await this.db.get(
      'SELECT * FROM conversas WHERE numero = ?',
      numero
    );

    if (!conversa) {
      const result = await this.db.run(
        'INSERT INTO conversas (numero) VALUES (?)',
        numero
      );
      conversa = await this.db.get(
        'SELECT * FROM conversas WHERE id = ?',
        result.lastID
      );
    } else {
      await this.db.run(
        'UPDATE conversas SET ultima_interacao = CURRENT_TIMESTAMP WHERE id = ?',
        conversa.id
      );
    }

    return conversa;
  }

  async salvarMensagem(numero, remetente, mensagem) {
    const conversa = await this.getOuCriarConversa(numero);
    const result = await this.db.run(
      'INSERT INTO mensagens (conversa_id, remetente, mensagem) VALUES (?, ?, ?)',
      conversa.id,
      remetente,
      mensagem
    );

    return { conversaId: conversa.id, mensagemId: result.lastID };
  }

  async atualizarNome(numero, nome) {
    await this.db.run(
      'UPDATE conversas SET nome = ?, ultima_interacao = CURRENT_TIMESTAMP WHERE numero = ?',
      nome,
      numero
    );
  }

  async salvarContexto(numero, contexto) {
    const conversa = await this.getOuCriarConversa(numero);
    await this.db.run(
      'UPDATE conversas SET contexto = ?, ultima_interacao = CURRENT_TIMESTAMP WHERE id = ?',
      JSON.stringify(contexto || {}),
      conversa.id
    );
  }

  async obterContexto(numero) {
    const conversa = await this.db.get(
      'SELECT contexto FROM conversas WHERE numero = ?',
      numero
    );
    if (!conversa || !conversa.contexto) return {};
    try {
      return JSON.parse(conversa.contexto);
    } catch {
      return {};
    }
  }

  async obterConversaPorNumero(numero) {
    return this.db.get(
      'SELECT * FROM conversas WHERE numero = ?',
      numero
    );
  }

  async obterHistorico(numero, limite = 10) {
    const conversa = await this.getOuCriarConversa(numero);
    const mensagens = await this.db.all(
      `
      SELECT remetente, mensagem, timestamp
      FROM mensagens
      WHERE conversa_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
      `,
      conversa.id,
      limite
    );
    return mensagens.reverse();
  }

  getDb() {
    return this.db;
  }
}

const database = new Database();

module.exports = {
  database,
  init: async () => await database.init(),
  getDb: () => database.getDb(),
  getOuCriarConversa: (...args) => database.getOuCriarConversa(...args),
  salvarMensagem: (...args) => database.salvarMensagem(...args),
  atualizarNome: (...args) => database.atualizarNome(...args),
  salvarContexto: (...args) => database.salvarContexto(...args),
  obterContexto: (...args) => database.obterContexto(...args),
  obterConversaPorNumero: (...args) => database.obterConversaPorNumero(...args),
  obterHistorico: (...args) => database.obterHistorico(...args)
};
