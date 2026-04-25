// ===== GLOBAL STATE & API =====
const API = 'http://localhost:3000/api';
let socket = null;
let state = {
  token: localStorage.getItem('livetask_token'),
  user: JSON.parse(localStorage.getItem('livetask_user') || 'null'),
  products: [],
  categories: [],
  currentPage: 'dashboard'
};

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  
  const res = await fetch(API + path, {
    headers,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  
  if (!res.ok) {
    if (res.status === 401) logout();
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Erro na requisição');
  }
  return res.json();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const colors = { error: 'var(--danger)', success: 'var(--success)', info: 'var(--primary)' };
  toast.className = 'toast';
  toast.style.borderLeftColor = colors[type] || colors.info;
  toast.innerHTML = `<strong>${type === 'error' ? 'Erro' : type === 'success' ? 'Sucesso' : 'Aviso'}</strong><p>${message}</p>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== AUTHENTICATION =====
let isLoginMode = true;

document.getElementById('auth-toggle-btn').addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  document.getElementById('auth-title').textContent = isLoginMode ? 'Bem-vindo de volta' : 'Criar Nova Conta';
  document.getElementById('auth-subtitle').textContent = isLoginMode ? 'Faça login para continuar' : 'Comece a organizar sua vida';
  document.getElementById('auth-submit').textContent = isLoginMode ? 'Entrar' : 'Cadastrar';
  document.getElementById('auth-switch-text').textContent = isLoginMode ? 'Não tem uma conta?' : 'Já tem uma conta?';
  document.getElementById('auth-toggle-btn').textContent = isLoginMode ? 'Criar conta' : 'Fazer login';
  
  if (isLoginMode) {
    document.getElementById('register-fields').classList.add('hidden');
    document.getElementById('auth-name').removeAttribute('required');
  } else {
    document.getElementById('register-fields').classList.remove('hidden');
    document.getElementById('auth-name').setAttribute('required', 'true');
  }
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  
  try {
    let res;
    if (isLoginMode) {
      res = await api('/auth/login', { method: 'POST', body: { email, password } });
      
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('livetask_token', res.token);
      localStorage.setItem('livetask_user', JSON.stringify(res.user));
      
      initApp();
    } else {
      const name = document.getElementById('auth-name').value;
      const accountType = document.querySelector('input[name="account-type"]:checked').value;
      res = await api('/auth/register', { method: 'POST', body: { name, email, password, accountType } });
      
      showToast('Conta criada com sucesso! Faça login.', 'success');
      document.getElementById('auth-password').value = '';
      document.getElementById('auth-toggle-btn').click(); // Troca para modo login
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('logout-btn').addEventListener('click', logout);

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('livetask_token');
  localStorage.removeItem('livetask_user');
  if (socket) socket.disconnect();
  checkAuth();
}

function checkAuth() {
  if (state.token && state.user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  } else {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }
}

// ===== INITIALIZATION & WEBSOCKETS =====
function initApp() {
  // Update UI for user
  document.getElementById('user-name').textContent = state.user.name;
  document.getElementById('user-role').textContent = state.user.role === 'STORE' ? 'Loja' : 'Casa';
  document.getElementById('user-avatar').textContent = state.user.name.charAt(0).toUpperCase();
  
  // Show/Hide features based on role
  if (state.user.role === 'STORE') {
    document.querySelectorAll('.store-only').forEach(el => el.classList.remove('hidden'));
    document.querySelector('.store-fields-group').classList.remove('hidden');
  } else {
    document.querySelectorAll('.store-only').forEach(el => el.classList.add('hidden'));
    document.querySelector('.store-fields-group').classList.add('hidden');
  }
  
  // Setup WebSockets
  if (!socket) {
    socket = io('http://localhost:3000');
    
    socket.on(`new-alerts-${state.user.id}`, alerts => {
      alerts.forEach(a => showToast(a.message, 'info'));
      updateAlertBadge();
      if (state.currentPage === 'alerts') renderPage('alerts');
    });
    
    socket.on(`alert-count-${state.user.id}`, count => {
      const badge = document.getElementById('alert-badge');
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    });
    
    const refreshEvents = [`product-updated-${state.user.id}`, `product-created-${state.user.id}`, `product-deleted-${state.user.id}`, `movement-created-${state.user.id}`];
    refreshEvents.forEach(evt => {
      socket.on(evt, () => renderPage(state.currentPage));
    });
  }
  
  updateAlertBadge();
  navigateTo('dashboard');
}

async function updateAlertBadge() {
  try {
    const res = await api('/alerts/count');
    const badge = document.getElementById('alert-badge');
    badge.textContent = res.count;
    badge.classList.toggle('hidden', res.count === 0);
  } catch(e) {}
}

// ===== NAVIGATION =====
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(el.dataset.page);
  });
});

document.getElementById('nav-alerts').addEventListener('click', () => navigateTo('alerts'));

function navigateTo(page) {
  state.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  
  const titles = {
    dashboard: ['Dashboard', 'Visão geral'],
    products: ['Produtos', state.user.role === 'STORE' ? 'Gerencie o catálogo da sua loja' : 'Itens da sua casa'],
    movements: ['Movimentações', 'Histórico de entradas e saídas'],
    categories: ['Categorias', 'Organize seus itens'],
    alerts: ['Notificações', 'Avisos importantes']
  };
  
  document.getElementById('page-title').textContent = titles[page][0];
  document.getElementById('page-subtitle').textContent = titles[page][1];
  
  renderPage(page);
}

// Run check on load
checkAuth();
