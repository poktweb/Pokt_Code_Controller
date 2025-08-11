const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Database
const db = new sqlite3.Database('database.db');

// Initialize database
function initDatabase() {
    console.log('Iniciando banco de dados...');
    
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            private_key TEXT UNIQUE NOT NULL,
            monthly_limit INTEGER DEFAULT 1000,
            requests_used INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Erro ao criar tabela users:', err);
            } else {
                console.log('Tabela users criada/verificada com sucesso');
            }
        });

        // System config table
        db.run(`CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_name TEXT UNIQUE NOT NULL,
            key_value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Erro ao criar tabela system_config:', err);
            } else {
                console.log('Tabela system_config criada/verificada com sucesso');
                
                // Insert system key if not exists
                db.get("SELECT key_value FROM system_config WHERE key_name = 'system_key'", (err, row) => {
                    if (err) {
                        console.error('Erro ao verificar system key:', err);
                    } else if (!row) {
                        const systemKey = uuidv4();
                        console.log('Criando nova System Key:', systemKey);
                        
                        db.run("INSERT INTO system_config (key_name, key_value) VALUES (?, ?)", 
                            ['system_key', systemKey], (err) => {
                            if (err) {
                                console.error('Erro ao inserir system key:', err);
                            } else {
                                console.log('System Key criada com sucesso:', systemKey);
                            }
                        });
                    } else {
                        console.log('System Key já existe:', row.key_value);
                    }
                });
            }
        });
    });
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Sistema funcionando' });
});

// Get system key
app.get('/api/system/key', (req, res) => {
    db.get("SELECT key_value FROM system_config WHERE key_name = 'system_key'", (err, row) => {
        if (err) {
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else if (!row) {
            res.status(404).json({ error: 'System key não encontrada' });
        } else {
            res.json({ system_key: row.key_value });
        }
    });
});

// Dashboard stats
app.get('/api/dashboard', (req, res) => {
    db.get("SELECT COUNT(*) as total_users FROM users", (err, userRow) => {
        if (err) {
            res.status(500).json({ error: 'Erro interno do servidor' });
            return;
        }
        
        db.get("SELECT SUM(requests_used) as total_requests FROM users", (err, requestRow) => {
            if (err) {
                res.status(500).json({ error: 'Erro interno do servidor' });
                return;
            }
            
            res.json({
                total_users: userRow.total_users || 0,
                total_requests: requestRow.total_requests || 0
            });
        });
    });
});

// List users (for admin panel)
app.get('/api/users', (req, res) => {
    db.all("SELECT id, username, email, private_key, monthly_limit, requests_used, created_at FROM users ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else {
            res.json(rows);
        }
    });
});

// Register user (admin only)
app.post('/api/users/register', (req, res) => {
    console.log('Tentativa de cadastro:', req.body);
    
    const { username, email, system_key, monthly_limit = 1000 } = req.body;
    
    if (!username || !email || !system_key) {
        console.log('Campos obrigatórios faltando:', { username, email, system_key });
        return res.status(400).json({ error: 'Username, email e system_key são obrigatórios' });
    }

    console.log('Verificando system key...');
    
    // Verify system key
    db.get("SELECT key_value FROM system_config WHERE key_name = 'system_key'", (err, row) => {
        if (err) {
            console.error('Erro ao verificar system key:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        
        console.log('System key encontrada:', row ? row.key_value : 'não encontrada');
        
        if (!row || row.key_value !== system_key) {
            console.log('System key inválida. Recebida:', system_key, 'Esperada:', row ? row.key_value : 'não encontrada');
            return res.status(401).json({ error: 'System key inválida' });
        }

        console.log('System key válida, criando usuário...');
        const privateKey = uuidv4();
        
        // Query simplificada
        const query = "INSERT INTO users (username, email, private_key, monthly_limit) VALUES (?, ?, ?, ?)";
        const params = [username, email, privateKey, monthly_limit];
        
        console.log('Executando query:', query, 'com params:', params);
        
        db.run(query, params, function(err) {
            if (err) {
                console.error('Erro ao inserir usuário:', err);
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'Username ou email já existe' });
                } else {
                    res.status(500).json({ error: 'Erro interno do servidor' });
                }
            } else {
                console.log('Usuário criado com sucesso. ID:', this.lastID);
                res.json({
                    message: 'Usuário criado com sucesso',
                    user_id: this.lastID,
                    private_key: privateKey
                });
            }
        });
    });
});

// Validate user token
app.post('/api/validate-token', (req, res) => {
    const { user_token } = req.body;
    
    if (!user_token) {
        return res.status(400).json({ error: 'Token do usuário é obrigatório' });
    }

    db.get("SELECT id, username, monthly_limit, requests_used FROM users WHERE private_key = ?", [user_token], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Get system key
        db.get("SELECT key_value FROM system_config WHERE key_name = 'system_key'", (err, systemRow) => {
            if (err) {
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }

            const remainingRequests = user.monthly_limit - user.requests_used;
            
            res.json({
                valid: true,
                user_id: user.id,
                username: user.username,
                monthly_limit: user.monthly_limit,
                requests_used: user.requests_used,
                remaining_requests: remainingRequests,
                system_key: systemRow.key_value,
                message: 'Token válido'
            });
        });
    });
});

// Consume request (deduct 1 from user's limit)
app.post('/api/consume-request', (req, res) => {
    const { user_token } = req.body;
    
    if (!user_token) {
        return res.status(400).json({ error: 'Token do usuário é obrigatório' });
    }

    db.get("SELECT id, username, monthly_limit, requests_used FROM users WHERE private_key = ?", [user_token], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const remainingRequests = user.monthly_limit - user.requests_used;
        
        if (remainingRequests <= 0) {
            return res.status(429).json({ 
                error: 'Limite de requisições esgotado',
                monthly_limit: user.monthly_limit,
                requests_used: user.requests_used,
                remaining_requests: 0
            });
        }

        // Update requests_used
        db.run("UPDATE users SET requests_used = requests_used + 1 WHERE id = ?", [user.id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }

            res.json({
                success: true,
                message: 'Requisição consumida com sucesso',
                user_id: user.id,
                username: user.username,
                monthly_limit: user.monthly_limit,
                requests_used: user.requests_used + 1,
                remaining_requests: remainingRequests - 1
            });
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    initDatabase();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nEncerrando servidor...');
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar banco:', err);
        } else {
            console.log('Banco fechado com sucesso');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nEncerrando servidor...');
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar banco:', err);
        } else {
            console.log('Banco fechado com sucesso');
        }
        process.exit(0);
    });
});
