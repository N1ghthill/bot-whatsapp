const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        this.db = await open({
            filename: './assistente.db',
            driver: sqlite3.Database
        });

        // Criar tabelas
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS conversas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero TEXT NOT NULL,
                nome TEXT,
                ultima_interacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                contexto TEXT DEFAULT '{}',
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mensagens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversa_id INTEGER,
                remetente TEXT NOT NULL,
                mensagem TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversa_id) REFERENCES conversas(id)
            );

            CREATE TABLE IF NOT EXISTS memoria (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chave TEXT UNIQUE NOT NULL,
                valor TEXT NOT NULL,
                atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Banco de dados inicializado');
        return this;
    }

    // Gerenciar conversas
    async getOuCriarConversa(numero, nome = null) {
        let conversa = await this.db.get(
            'SELECT * FROM conversas WHERE numero = ?',
            numero
        );

        if (!conversa) {
            const result = await this.db.run(
                'INSERT INTO conversas (numero, nome) VALUES (?, ?)',
                numero, nome
            );
            conversa = await this.db.get(
                'SELECT * FROM conversas WHERE id = ?',
                result.lastID
            );
        } else {
            // Atualizar última interação
            await this.db.run(
                'UPDATE conversas SET ultima_interacao = CURRENT_TIMESTAMP WHERE id = ?',
                conversa.id
            );
        }

        return conversa;
    }

    // Salvar mensagem
    async salvarMensagem(numero, remetente, mensagem) {
        const conversa = await this.getOuCriarConversa(numero);
        
        await this.db.run(
            'INSERT INTO mensagens (conversa_id, remetente, mensagem) VALUES (?, ?, ?)',
            conversa.id, remetente, mensagem
        );

        // Manter apenas últimas 20 mensagens por conversa
        await this.db.run(`
            DELETE FROM mensagens 
            WHERE id NOT IN (
                SELECT id FROM mensagens 
                WHERE conversa_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 20
            ) AND conversa_id = ?
        `, conversa.id, conversa.id);

        return conversa.id;
    }

    // Obter histórico recente
    async getHistoricoConversa(numero, limite = 10) {
        const conversa = await this.getOuCriarConversa(numero);
        
        const mensagens = await this.db.all(`
            SELECT remetente, mensagem, timestamp 
            FROM mensagens 
            WHERE conversa_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `, conversa.id, limite);

        return mensagens.reverse(); // Ordenar do mais antigo para o mais novo
    }

    // Memória de longo prazo (fatos importantes)
    async salvarFato(numero, fato, valor) {
        const chave = `${numero}:${fato}`;
        
        await this.db.run(`
            INSERT OR REPLACE INTO memoria (chave, valor) 
            VALUES (?, ?)
        `, chave, JSON.stringify(valor));
    }

    async getFato(numero, fato) {
        const chave = `${numero}:${fato}`;
        const resultado = await this.db.get(
            'SELECT valor FROM memoria WHERE chave = ?',
            chave
        );
        
        return resultado ? JSON.parse(resultado.valor) : null;
    }

    // Contexto da conversa
    async atualizarContexto(numero, contexto) {
        await this.db.run(
            'UPDATE conversas SET contexto = ? WHERE numero = ?',
            JSON.stringify(contexto), numero
        );
    }

    async getContexto(numero) {
        const conversa = await this.getOuCriarConversa(numero);
        return conversa.contexto ? JSON.parse(conversa.contexto) : {};
    }

    // Estatísticas
    async getEstatisticas() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(DISTINCT numero) as total_contatos,
                COUNT(*) as total_mensagens,
                MAX(timestamp) as ultima_mensagem
            FROM conversas 
            LEFT JOIN mensagens ON conversas.id = mensagens.conversa_id
        `);
        
        return stats;
    }
}

module.exports = new Database();
