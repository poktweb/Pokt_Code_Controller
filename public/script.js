// Global variables
let currentSystemKey = '';
let currentTab = 'dashboard';

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando aplicação...');
    initializeTabs();
    loadSystemKey();
    loadDashboard();
    loadUsers();
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', registerUser);
    }

    // Setup modal event listeners
    const modal = document.getElementById('editUserModal');
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    window.addEventListener('click', (event) => {
        if (event.target === modal) { modal.style.display = 'none'; }
    });
    const editForm = document.getElementById('editUserForm');
    if (editForm) { editForm.addEventListener('submit', updateUserLimit); }
});

// Tab management
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            showTab(targetTab);
        });
    });
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show target tab
    document.getElementById(tabName + 'Tab').style.display = 'block';
    
    // Add active class to clicked button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    currentTab = tabName;
}

// Load system key
async function loadSystemKey() {
    try {
        const response = await fetch('/api/system/key');
        if (response.ok) {
            const data = await response.json();
            currentSystemKey = data.system_key;
            document.getElementById('currentSystemKey').value = currentSystemKey;
        }
    } catch (error) {
        console.error('Erro ao carregar system key:', error);
        showNotification('Erro ao carregar System Key', 'error');
    }
}

// Dashboard functions
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
            const data = await response.json();
            displayDashboard(data);
        } else {
            showNotification('Erro ao carregar dashboard', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showNotification('Erro ao carregar dashboard', 'error');
    }
}

function displayDashboard(data) {
    const dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent) {
        dashboardContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total de Usuários</h3>
                    <p class="stat-number">${data.total_users}</p>
                </div>
                <div class="stat-card">
                    <h3>Total de Requisições</h3>
                    <p class="stat-number">${data.total_requests}</p>
                </div>
            </div>
        `;
    }
}

// User management functions
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        if (response.ok) {
            const users = await response.json();
            displayUsers(users);
        } else {
            showNotification('Erro ao carregar usuários', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showNotification('Erro ao carregar usuários', 'error');
    }
}

function displayUsers(users) {
    const usersContent = document.getElementById('usersContent');
    if (usersContent) {
        if (users.length === 0) {
            usersContent.innerHTML = '<p class="no-data">Nenhum usuário cadastrado</p>';
            return;
        }

        const usersHTML = users.map(user => `
            <div class="user-card">
                <div class="user-info">
                    <h3>${user.username}</h3>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Token do Cliente:</strong> <span class="token-text">${user.private_key}</span></p>
                    <p><strong>Limite Mensal:</strong> ${user.monthly_limit}</p>
                    <p><strong>Requisições Usadas:</strong> ${user.requests_used}</p>
                    <p><strong>Requisições Restantes:</strong> ${user.monthly_limit - user.requests_used}</p>
                    <p><strong>Criado em:</strong> ${new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div class="user-actions">
                    <button class="btn btn-secondary" onclick="editUser(${user.id}, '${user.username}', '${user.email}', '${user.private_key}', ${user.monthly_limit})">Editar</button>
                    <button class="btn btn-danger" onclick="deleteUser(${user.id})">Deletar</button>
                </div>
            </div>
        `).join('');

        usersContent.innerHTML = usersHTML;
    }
}

// User registration
async function registerUser(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    
    const userData = {
        username: formData.get('username'),
        email: formData.get('email'),
        system_key: currentSystemKey,
        monthly_limit: parseInt(formData.get('monthlyLimit'))
    };

    try {
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Usuário cadastrado com sucesso!', 'success');
            event.target.reset();
            loadUsers();
            loadDashboard();
        } else {
            showNotification(result.error || 'Erro ao cadastrar usuário', 'error');
        }
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        showNotification('Erro de conexão', 'error');
    }
}

// Copy to clipboard
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.value;
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copiado para a área de transferência!', 'success');
        }).catch(() => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Copiado para a área de transferência!', 'success');
    } catch (err) {
        showNotification('Erro ao copiar texto', 'error');
    }
    
    document.body.removeChild(textArea);
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Edit user
function editUser(userId, username, email, privateKey, monthlyLimit) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUsername').value = username;
    document.getElementById('editEmail').value = email;
    document.getElementById('editPrivateKey').value = privateKey;
    document.getElementById('editMonthlyLimit').value = monthlyLimit;
    document.getElementById('editUserModal').style.display = 'block';
}

// Update user limit
async function updateUserLimit(event) {
    event.preventDefault();
    const userId = document.getElementById('editUserId').value;
    const monthlyLimit = document.getElementById('editMonthlyLimit').value;
    
    if (!monthlyLimit) {
        showNotification('Preencha o limite mensal', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}/limit`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                monthly_limit: parseInt(monthlyLimit),
                system_key: currentSystemKey
            })
        });
        
        if (response.ok) {
            showNotification('Limite mensal atualizado com sucesso!', 'success');
            document.getElementById('editUserModal').style.display = 'none';
            loadUsers();
            loadDashboard();
        } else {
            const error = await response.json();
            showNotification(`Erro ao atualizar usuário: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        showNotification('Erro de conexão ao atualizar usuário', 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja deletar este usuário?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ system_key: currentSystemKey })
        });
        
        if (response.ok) {
            showNotification('Usuário deletado com sucesso!', 'success');
            loadUsers();
            loadDashboard();
        } else {
            const error = await response.json();
            showNotification(`Erro ao deletar usuário: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        showNotification('Erro de conexão ao deletar usuário', 'error');
    }
}
