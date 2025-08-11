# Pokt Code Controller

Sistema simplificado de controle para validação de tokens e consumo de requisições.

## 🎯 **Funcionalidades Principais**

- **Validar Token**: Verifica se o token do usuário é válido e retorna informações
- **Consumir Requisição**: Desconta 1 requisição do limite mensal do usuário
- **Painel Admin**: Interface para cadastrar usuários e monitorar uso

## 🌐 **Deploy no Vercel**

### **Configuração Automática:**
O projeto já está configurado para funcionar no Vercel com:
- ✅ **vercel.json** configurado
- ✅ **Conexões PostgreSQL** otimizadas para serverless
- ✅ **Timeout** configurado para 30 segundos

### **Deploy:**
1. **Instalar Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Fazer deploy:**
   ```bash
   vercel
   ```

3. **Configurar variáveis de ambiente (opcional):**
   ```bash
   vercel env add DATABASE_URL
   ```

### **Por que funciona no Vercel agora:**
- **Client ao invés de Pool**: Cada requisição cria uma nova conexão
- **Conexões fechadas**: `client.end()` após cada operação
- **Sem estado persistente**: Ideal para funções serverless
- **SSL configurado**: Compatível com Neon PostgreSQL

## 🚀 **Instalação**

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Iniciar servidor:**
   ```bash
   node server.js
   ```

3. **Acessar interface:**
   ```
   http://localhost:3000
   ```

## 🔑 **APIs Principais**

### **1. Validar Token do Usuário**
```bash
POST /api/validate-token
```

**Body:**
```json
{
  "user_token": "uuid-token-usuario"
}
```

**Resposta (Token Válido):**
```json
{
  "valid": true,
  "user_id": 1,
  "username": "joao",
  "monthly_limit": 1000,
  "requests_used": 150,
  "remaining_requests": 850,
  "system_key": "uuid-system-key",
  "message": "Token válido"
}
```

**Resposta (Token Inválido):**
```json
{
  "error": "Token inválido"
}
```

### **2. Consumir Requisição**
```bash
POST /api/consume-request
```

**Body:**
```json
{
  "user_token": "uuid-token-usuario"
}
```

**Resposta (Sucesso):**
```json
{
  "success": true,
  "message": "Requisição consumida com sucesso",
  "user_id": 1,
  "username": "joao",
  "monthly_limit": 1000,
  "requests_used": 151,
  "remaining_requests": 849
}
```

**Resposta (Limite Esgotado):**
```json
{
  "error": "Limite de requisições esgotado",
  "monthly_limit": 1000,
  "requests_used": 1000,
  "remaining_requests": 0
}
```

## 💻 **Implementação no Seu Sistema**

### **JavaScript/Node.js:**
```javascript
// 1. Validar token e obter System Key
async function validateUserToken(userToken) {
    const response = await fetch('http://localhost:3000/api/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_token: userToken })
    });
    
    const data = await response.json();
    
    if (data.valid) {
        // Salvar System Key para uso posterior
        localStorage.setItem('system_key', data.system_key);
        console.log('Requisições restantes:', data.remaining_requests);
        return data;
    } else {
        throw new Error(data.error);
    }
}

// 2. Consumir requisição
async function consumeRequest(userToken) {
    const response = await fetch('http://localhost:3000/api/consume-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_token: userToken })
    });
    
    const data = await response.json();
    
    if (data.success) {
        console.log('Requisição consumida. Restantes:', data.remaining_requests);
        return data;
    } else {
        throw new Error(data.error);
    }
}

// Exemplo de uso
const userToken = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Validar token primeiro
validateUserToken(userToken).then(userInfo => {
    console.log('Token válido!');
    console.log('Requisições restantes:', userInfo.remaining_requests);
    
    // Consumir requisição
    return consumeRequest(userToken);
}).then(result => {
    console.log('Requisição processada com sucesso');
}).catch(error => {
    console.error('Erro:', error.message);
});
```

### **Python:**
```python
import requests

def validate_user_token(user_token):
    """Valida token e retorna informações do usuário"""
    url = "http://localhost:3000/api/validate-token"
    payload = {"user_token": user_token}
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    if data.get('valid'):
        print(f"Token válido! Requisições restantes: {data['remaining_requests']}")
        return data
    else:
        raise Exception(data.get('error'))

def consume_request(user_token):
    """Consome 1 requisição do usuário"""
    url = "http://localhost:3000/api/consume-request"
    payload = {"user_token": user_token}
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    if data.get('success'):
        print(f"Requisição consumida. Restantes: {data['remaining_requests']}")
        return data
    else:
        raise Exception(data.get('error'))

# Exemplo de uso
user_token = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

try:
    # Validar token
    user_info = validate_user_token(user_token)
    
    # Consumir requisição
    result = consume_request(user_token)
    
except Exception as e:
    print(f"Erro: {e}")
```

## 📊 **APIs Administrativas**

### **Dashboard:**
- **`GET /api/dashboard`** - Estatísticas do sistema
- **`GET /api/users`** - Listar usuários
- **`POST /api/users/register`** - Cadastrar usuário (requer System Key)

### **Sistema:**
- **`GET /api/health`** - Status do servidor
- **`GET /api/system/key`** - Obter System Key atual

## 🔄 **Fluxo de Uso**

1. **Seu sistema recebe** o token do usuário
2. **Valida o token** via `/api/validate-token`
3. **Recebe a System Key** e informações do usuário
4. **Para cada operação**, chama `/api/consume-request`
5. **Sistema desconta** 1 requisição automaticamente

## 📋 **Resumo das Rotas**

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/health` | Status do servidor | ❌ |
| GET | `/api/system/key` | Obter System Key | ❌ |
| GET | `/api/dashboard` | Estatísticas | ❌ |
| GET | `/api/users` | Listar usuários | ❌ |
| POST | `/api/validate-token` | **Validar token usuário** | ❌ |
| POST | `/api/consume-request` | **Consumir requisição** | ❌ |
| POST | `/api/users/register` | Cadastrar usuário | ✅ System Key |

## 🏗️ **Tecnologias**

- **Backend**: Node.js + Express
- **Database**: SQLite
- **Frontend**: HTML + CSS + JavaScript
- **Autenticação**: System Key + Tokens privados

## 📁 **Estrutura do Projeto**

```
├── server.js          # Servidor principal
├── public/            # Arquivos frontend
│   ├── index.html     # Interface administrativa
│   ├── script.js      # Lógica JavaScript
│   └── styles.css     # Estilos CSS
├── database.db        # Banco SQLite
└── package.json       # Dependências
```

## 🔒 **Segurança**

- **System Key** para operações administrativas
- **Tokens únicos** para cada usuário
- **Controle de limite** de requisições mensais
- **Validação** de entrada em todas as APIs

## 🌐 **Base URL**

- **Desenvolvimento:** `http://localhost:3000`
- **Produção:** Configurável via variável de ambiente `PORT`