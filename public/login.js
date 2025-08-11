document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    
    // Check if user is already logged in
    if (localStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = '/dashboard';
        return;
    }
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showMessage('Preencha todos os campos', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Login successful
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', username);
                showMessage('Login realizado com sucesso! Redirecionando...', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                showMessage(data.error || 'Erro no login', 'error');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            showMessage('Erro de conexão', 'error');
        }
    });
    
    function showMessage(message, type) {
        loginMessage.textContent = message;
        loginMessage.className = `login-message ${type}`;
        
        // Clear message after 5 seconds
        setTimeout(() => {
            loginMessage.textContent = '';
            loginMessage.className = 'login-message';
        }, 5000);
    }
});
