const express = require('express');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection function
async function getClient() {
    const client = new Client({
        connectionString: 'postgresql://neondb_owner:npg_o4jREmlL7zpQ@ep-purple-flower-aejbb9ba-pooler.c-2.us-east-2.aws.neon.tech/Pokt_Code?sslmode=require&channel_binding=require',
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    await client.connect();
    return client;
}

// Test database connection
async function testConnection() {
    try {
        const client = await getClient();
        const result = await client.query('SELECT NOW()');
        console.log('Conectado ao PostgreSQL:', result.rows[0].now);
        await client.end();
    } catch (err) {
        console.error('Erro ao conectar com PostgreSQL:', err);
    }
}

// Initialize database
async function initDatabase() {
    console.log('Iniciando banco de dados PostgreSQL...');
    
    try {
        const client = await getClient();
        
        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                private_key VARCHAR(255) UNIQUE NOT NULL,
                monthly_limit INTEGER DEFAULT 1000,
                requests_used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Tabela users criada/verificada com sucesso');

        // System config table
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_config (
                id SERIAL PRIMARY KEY,
                key_name VARCHAR(255) UNIQUE NOT NULL,
                key_value VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Tabela system_config criada/verificada com sucesso');
        
        // Insert system key if not exists
        const systemKeyResult = await client.query("SELECT key_value FROM system_config WHERE key_name = 'system_key'");
        
        if (systemKeyResult.rows.length === 0) {
            const systemKey = uuidv4();
            console.log('Criando nova System Key:', systemKey);
            
            await client.query("INSERT INTO system_config (key_name, key_value) VALUES ($1, $2)", 
                ['system_key', systemKey]);
            console.log('System Key criada com sucesso:', systemKey);
        } else {
            console.log('System Key já existe:', systemKeyResult.rows[0].key_value);
        }
        
        await client.end();
        
    } catch (error) {
        console.error('Erro ao inicializar banco:', error);
    }
}

// API Routes

// Root route - serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const client = await getClient();
        const result = await client.query('SELECT NOW()');
        res.json({ status: 'ok', message: 'Sistema funcionando', db_status: 'connected', db_time: result.rows[0].now });
        await client.end();
    } catch (err) {
        console.error('Erro ao buscar health check:', err);
        res.status(500).json({ status: 'error', message: 'Erro interno do servidor' });
    }
});

// Get system key
app.get('/api/system/key', async (req, res) => {
    try {
        const client = await getClient();
        const result = await client.query("SELECT key_value FROM system_config WHERE key_name = 'system_key'");
        
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'System key não encontrada' });
        } else {
            res.json({ system_key: result.rows[0].key_value });
        }
        await client.end();
    } catch (err) {
        console.error('Erro ao buscar system key:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Dashboard stats
app.get('/api/dashboard', async (req, res) => {
    try {
        const client = await getClient();
        const userResult = await client.query("SELECT COUNT(*) as total_users FROM users");
        const requestResult = await client.query("SELECT COALESCE(SUM(requests_used), 0) as total_requests FROM users");
        
        res.json({
            total_users: parseInt(userResult.rows[0].total_users) || 0,
            total_requests: parseInt(requestResult.rows[0].total_requests) || 0
        });
        await client.end();
    } catch (err) {
        console.error('Erro ao buscar dashboard:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// List users (for admin panel)
app.get('/api/users', async (req, res) => {
    try {
        const client = await getClient();
        const result = await client.query("SELECT id, username, email, private_key, monthly_limit, requests_used, created_at FROM users ORDER BY created_at DESC");
        res.json(result.rows);
        await client.end();
    } catch (err) {
        console.error('Erro ao listar usuários:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Register user (admin only)
app.post('/api/users/register', async (req, res) => {
    console.log('Tentativa de cadastro:', req.body);
    
    const { username, email, system_key, monthly_limit = 1000 } = req.body;
    
    if (!username || !email || !system_key) {
        console.log('Campos obrigatórios faltando:', { username, email, system_key });
        return res.status(400).json({ error: 'Username, email e system_key são obrigatórios' });
    }

    try {
        console.log('Verificando system key...');
        
        // Verify system key
        const client = await getClient();
        const systemKeyResult = await client.query("SELECT key_value FROM system_config WHERE key_name = 'system_key'");
        
        if (systemKeyResult.rows.length === 0) {
            console.log('System key não encontrada');
            return res.status(401).json({ error: 'System key inválida' });
        }
        
        const systemKey = systemKeyResult.rows[0].key_value;
        console.log('System key encontrada:', systemKey);
        
        if (systemKey !== system_key) {
            console.log('System key inválida. Recebida:', system_key, 'Esperada:', systemKey);
            return res.status(401).json({ error: 'System key inválida' });
        }

        console.log('System key válida, criando usuário...');
        const privateKey = uuidv4();
        
        // Query simplificada
        const query = "INSERT INTO users (username, email, private_key, monthly_limit) VALUES ($1, $2, $3, $4) RETURNING id";
        const params = [username, email, privateKey, monthly_limit];
        
        console.log('Executando query:', query, 'com params:', params);
        
        const result = await client.query(query, params);
        
        console.log('Usuário criado com sucesso. ID:', result.rows[0].id);
        res.json({
            message: 'Usuário criado com sucesso',
            user_id: result.rows[0].id,
            private_key: privateKey
        });
        
    } catch (err) {
        console.error('Erro ao cadastrar usuário:', err);
        if (err.message.includes('duplicate key value violates unique constraint')) {
            res.status(400).json({ error: 'Username ou email já existe' });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// Validate user token
app.post('/api/validate-token', async (req, res) => {
    const { user_token } = req.body;
    
    if (!user_token) {
        return res.status(400).json({ error: 'Token do usuário é obrigatório' });
    }

    try {
        const client = await getClient();
        const userResult = await client.query("SELECT id, username, monthly_limit, requests_used FROM users WHERE private_key = $1", [user_token]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const user = userResult.rows[0];
        
        // Get system key
        const systemResult = await client.query("SELECT key_value FROM system_config WHERE key_name = 'system_key'");
        const systemKey = systemResult.rows[0].key_value;

        const remainingRequests = user.monthly_limit - user.requests_used;
        
        res.json({
            valid: true,
            user_id: user.id,
            username: user.username,
            monthly_limit: user.monthly_limit,
            requests_used: user.requests_used,
            remaining_requests: remainingRequests,
            system_key: systemKey,
            message: 'Token válido'
        });
        
    } catch (err) {
        console.error('Erro ao validar token:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Consume request (deduct 1 from user's limit)
app.post('/api/consume-request', async (req, res) => {
    const { user_token } = req.body;
    
    if (!user_token) {
        return res.status(400).json({ error: 'Token do usuário é obrigatório' });
    }

    try {
        const client = await getClient();
        const userResult = await client.query("SELECT id, username, monthly_limit, requests_used FROM users WHERE private_key = $1", [user_token]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const user = userResult.rows[0];
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
        await client.query("UPDATE users SET requests_used = requests_used + 1 WHERE id = $1", [user.id]);

        res.json({
            success: true,
            message: 'Requisição consumida com sucesso',
            user_id: user.id,
            username: user.username,
            monthly_limit: user.monthly_limit,
            requests_used: user.requests_used + 1,
            remaining_requests: remainingRequests - 1
        });
        
    } catch (err) {
        console.error('Erro ao consumir requisição:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Update user monthly limit
app.put('/api/users/:id/limit', async (req, res) => {
    const { id } = req.params;
    const { monthly_limit, system_key } = req.body;

    if (!monthly_limit || !system_key) {
        return res.status(400).json({ error: 'Limite mensal e system key são obrigatórios' });
    }

    if (monthly_limit < 1) {
        return res.status(400).json({ error: 'Limite mensal deve ser maior que 0' });
    }

    try {
        // Verify system key
        const client = await getClient();
        const systemKeyResult = await client.query("SELECT key_value FROM system_config WHERE key_name = 'system_key'");
        
        if (systemKeyResult.rows.length === 0 || systemKeyResult.rows[0].key_value !== system_key) {
            return res.status(401).json({ error: 'System key inválida' });
        }

        const result = await client.query("UPDATE users SET monthly_limit = $1 WHERE id = $2 RETURNING id", [monthly_limit, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({ message: 'Limite mensal atualizado com sucesso', monthly_limit });
        
    } catch (err) {
        console.error('Erro ao atualizar usuário:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { system_key } = req.body;

    if (!system_key) {
        return res.status(400).json({ error: 'System key é obrigatória' });
    }

    try {
        // Verify system key
        const client = await getClient();
        const systemKeyResult = await client.query("SELECT key_value FROM system_config WHERE key_name = 'system_key'");
        
        if (systemKeyResult.rows.length === 0 || systemKeyResult.rows[0].key_value !== system_key) {
            return res.status(401).json({ error: 'System key inválida' });
        }

        const result = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({ message: 'Usuário deletado com sucesso' });
        
    } catch (err) {
        console.error('Erro ao deletar usuário:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    await testConnection();
    await initDatabase();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nEncerrando servidor...');
    // No need to close pool here, as each request uses a new client.
    // If you had a global pool, you would do:
    // if (global.pool) {
    //     global.pool.end((err) => {
    //         if (err) {
    //             console.error('Erro ao fechar conexão PostgreSQL:', err);
    //         } else {
    //             console.log('Conexão PostgreSQL fechada com sucesso');
    //         }
    //     });
    // }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nEncerrando servidor...');
    // No need to close pool here, as each request uses a new client.
    // If you had a global pool, you would do:
    // if (global.pool) {
    //     global.pool.end((err) => {
    //         if (err) {
    //             console.error('Erro ao fechar conexão PostgreSQL:', err);
    //         } else {
    //             console.log('Conexão PostgreSQL fechada com sucesso');
    //         }
    //     });
    // }
    process.exit(0);
});
