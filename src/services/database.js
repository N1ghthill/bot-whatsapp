const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '..', '..', 'assistente.db');
    }

    async init() {
        try {
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });

            console.log(`📊 Conectado ao banco: ${this.dbPath}`);
            
            // Criar tabelas se não existirem
            await this.createTables();
            
            return this;
        } catch (error) {
            console.error('❌ Erro ao conectar ao banco:', error);
            throw error;
        }
    }

    async createTables() {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS conversas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero TEXT NOT NULL UNIQUE,
                nome TEXT,
                empresa TEXT,
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

            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT NOT NULL,
                mensagem TEXT NOT NULL,
                detalhes TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_conversas_numero ON conversas(numero);
            CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id);
            CREATE INDEX IF NOT EXISTS idx_mensagens_timestamp ON mensagens(timestamp);
            CREATE INDEX IF NOT EXISTS idx_memoria_chave ON memoria(chave);
        `);

        console.log('✅ Tabelas verificadas/criadas');
    }

    async getOuCriarConversa(numero, nome = null, empresa = null) {
        try {
            let conversa = await this.db.get(
                'SELECT * FROM conversas WHERE numero = ?',
                numero
            );

            if (!conversa) {
                const result = await this.db.run(
                    'INSERT INTO conversas (numero, nome, empresa) VALUES (?, ?, ?)',
                    numero, nome, empresa
                );
                
                console.log(`📝 Nova conversa criada: ${numero}`);
                
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
                
                // Atualizar nome/empresa se fornecidos
                if (nome && !conversa.nome) {
                    await this.db.run(
                        'UPDATE conversas SET nome = ? WHERE id = ?',
                        nome, conversa.id
                    );
                    conversa.nome = nome;
                }
                
                if (empresa && !conversa.empresa) {
                    await this.db.run(
                        'UPDATE conversas SET empresa = ? WHERE id = ?',
                        empresa, conversa.id
                    );
                    conversa.empresa = empresa;
                }
            }

            return conversa;
        } catch (error) {
            console.error('❌ Erro em getOuCriarConversa:', error);
            throw error;
        }
    }

    async salvarMensagem(numero, remetente, mensagem) {
        try {
            const conversa = await this.getOuCriarConversa(numero);
            
            await this.db.run(
                'INSERT INTO mensagens (conversa_id, remetente, mensagem) VALUES (?, ?, ?)',
                conversa.id, remetente, mensagem.substring(0, 1000) // Limitar tamanho
            );

            // Manter apenas últimas 25 mensagens por conversa (para performance)
            await this.db.run(`
                DELETE FROM mensagens 
                WHERE id NOT IN (
                    SELECT id FROM mensagens 
                    WHERE conversa_id = ? 
                    ORDER BY timestamp DESC 
                    LIMIT 25
                ) AND conversa_id = ?
            `, conversa.id, conversa.id);

            return conversa.id;
        } catch (error) {
            console.error('❌ Erro ao salvar mensagem:', error);
            throw error;
        }
    }

    async getHistoricoConversa(numero, limite = 10) {
        try {
            const conversa = await this.getOuCriarConversa(numero);
            
            const mensagens = await this.db.all(`
                SELECT 
                    remetente, 
                    mensagem, 
                    datetime(timestamp, 'localtime') as timestamp_br
                FROM mensagens 
                WHERE conversa_id = ? 
                ORDER BY timestamp ASC 
                LIMIT ?
            `, conversa.id, limite);

            return mensagens;
        } catch (error) {
            console.error('❌ Erro ao obter histórico:', error);
            return [];
        }
    }

    async salvarFato(numero, fato, valor) {
        try {
            const chave = `${numero}:${fato}`;
            
            await this.db.run(`
                INSERT OR REPLACE INTO memoria (chave, valor) 
                VALUES (?, ?)
            `, chave, JSON.stringify(valor));
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar fato:', error);
            return false;
        }
    }

    async getFato(numero, fato) {
        try {
            const chave = `${numero}:${fato}`;
            const resultado = await this.db.get(
                'SELECT valor FROM memoria WHERE chave = ?',
                chave
            );
            
            return resultado ? JSON.parse(resultado.valor) : null;
        } catch (error) {
            console.error('❌ Erro ao obter fato:', error);
            return null;
        }
    }

    async atualizarContexto(numero, contexto) {
        try {
            await this.db.run(
                'UPDATE conversas SET contexto = ? WHERE numero = ?',
                JSON.stringify(contexto), numero
            );
            return true;
        } catch (error) {
            console.error('❌ Erro ao atualizar contexto:', error);
            return false;
        }
    }

    async getContexto(numero) {
        try {
            const conversa = await this.getOuCriarConversa(numero);
            return conversa.contexto ? JSON.parse(conversa.contexto) : {};
        } catch (error) {
            console.error('❌ Erro ao obter contexto:', error);
            return {};
        }
    }

    async getEstatisticas() {
        try {
            const stats = await this.db.get(`
                SELECT 
                    COUNT(DISTINCT numero) as total_contatos,
                    COUNT(*) as total_mensagens,
                    MAX(timestamp) as ultima_mensagem,
                    DATE(MIN(timestamp)) as primeira_mensagem
                FROM conversas 
                LEFT JOIN mensagens ON conversas.id = mensagens.conversa_id
            `);
            
            // Adicionar contagem de hoje
            const hoje = await this.db.get(`
                SELECT COUNT(*) as mensagens_hoje
                FROM mensagens 
                WHERE DATE(timestamp) = DATE('now')
            `);
            
            return {
                ...stats,
                mensagens_hoje: hoje?.mensagens_hoje || 0
            };
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            return {
                total_contatos: 0,
                total_mensagens: 0,
                ultima_mensagem: null,
                primeira_mensagem: null,
                mensagens_hoje: 0
            };
        }
    }

    async getConversasRecentes(limite = 20) {
        try {
            return await this.db.all(`
                SELECT 
                    c.numero,
                    c.nome,
                    c.empresa,
                    c.ultima_interacao,
                    COUNT(m.id) as total_mensagens
                FROM conversas c
                LEFT JOIN mensagens m ON c.id = m.conversa_id
                GROUP BY c.id
                ORDER BY c.ultima_interacao DESC
                LIMIT ?
            `, limite);
        } catch (error) {
            console.error('❌ Erro ao obter conversas recentes:', error);
            return [];
        }
    }

    async logEvent(tipo, mensagem, detalhes = null) {
        try {
            await this.db.run(
                'INSERT INTO logs (tipo, mensagem, detalhes) VALUES (?, ?, ?)',
                tipo, mensagem, detalhes ? JSON.stringify(detalhes) : null
            );
        } catch (error) {
            console.error('❌ Erro ao registrar log:', error);
        }
    }

    async close() {
        if (this.db) {
            await this.db.close();
            console.log('✅ Banco de dados fechado');
        }
    }
}

// Exportar instância singleton
const database = new Database();
module.exports = database;
