// ===== PAGE RENDERING LOGIC =====

async function renderPage(page) {
  const content = document.getElementById('page-content');
  const actions = document.getElementById('page-actions');
  actions.innerHTML = '';
  
  try {
    if (page === 'dashboard') await renderDashboard(content, actions);
    else if (page === 'products') await renderProducts(content, actions);
    else if (page === 'categories') await renderCategories(content, actions);
    else if (page === 'alerts') await renderAlerts(content, actions);
    else if (page === 'movements') await renderMovements(content, actions);
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-header">Erro</div><div style="padding:2rem">${e.message}</div></div>`;
  }
}

// ===== FORMATTING =====
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtCurrency = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// ===== DASHBOARD =====
async function renderDashboard(el, actions) {
  const stats = await api('/dashboard/stats');
  
  const isStore = state.user.role === 'STORE';
  
  let html = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--primary-light);color:var(--primary)">📦</div>
        <div class="stat-info"><div class="stat-value">${stats.totalProducts}</div><div class="stat-label">Total de Produtos</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--success-light);color:var(--success)">✅</div>
        <div class="stat-info"><div class="stat-value">${stats.totalItems}</div><div class="stat-label">Itens em Estoque</div></div>
      </div>
      ${isStore ? `
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--warning-light);color:var(--warning)">💰</div>
        <div class="stat-info"><div class="stat-value">${fmtCurrency(stats.totalValue)}</div><div class="stat-label">Custo Total</div></div>
      </div>` : ''}
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--danger-light);color:var(--danger)">⚠️</div>
        <div class="stat-info"><div class="stat-value">${stats.lowStock + stats.expired}</div><div class="stat-label">Avisos Pendentes</div></div>
      </div>
    </div>
    
    <div style="display:grid; grid-template-columns: 1fr; gap: 1.5rem;">
      <div class="card">
        <div class="card-header"><h3>Categorias</h3></div>
        <div style="padding:1.5rem; display:flex; flex-wrap:wrap; gap:1rem;">
          ${stats.categories.map(c => `
            <div style="border:1px solid var(--border); padding:1rem; border-radius:var(--radius-sm); min-width:150px;">
              <div style="font-size:1.5rem; margin-bottom:0.5rem">${c.icon}</div>
              <strong style="display:block">${c.name}</strong>
              <small class="text-muted">${c.totalItems} itens</small>
            </div>
          `).join('') || '<p class="text-muted">Nenhuma categoria cadastrada.</p>'}
        </div>
      </div>
    </div>
  `;
  
  el.innerHTML = html;
}

// ===== PRODUCTS =====
async function renderProducts(el, actions) {
  actions.innerHTML = `<button class="btn btn-primary" onclick="openProductModal()">+ Novo Produto</button>`;
  
  const [res, cats] = await Promise.all([api('/products'), api('/categories')]);
  state.categories = cats;
  const isStore = state.user.role === 'STORE';
  
  if (!res.data.length) {
    el.innerHTML = `<div class="card" style="padding:4rem 2rem; text-align:center"><h3 style="margin-bottom:1rem">Nenhum produto cadastrado</h3><p class="text-muted" style="margin-bottom:2rem">Comece adicionando seu primeiro produto ao inventário.</p><button class="btn btn-primary" onclick="openProductModal()">Adicionar Produto</button></div>`;
    return;
  }
  
  let html = `
    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Estoque</th>
              ${isStore ? '<th>SKU</th><th>Custo / Venda</th>' : ''}
              <th>Validade</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${res.data.map(p => `
              <tr>
                <td>
                  <div class="item-name">
                    <div class="item-icon">${p.category?.icon || '📦'}</div>
                    <div><strong>${p.name}</strong></div>
                  </div>
                </td>
                <td><span class="badge" style="background:${p.category?.color}22; color:${p.category?.color}">${p.category?.name}</span></td>
                <td><strong>${p.quantity}</strong> <span class="text-muted">${p.unit}</span></td>
                ${isStore ? `<td>${p.sku || '—'}</td><td>${fmtCurrency(p.costPrice)} / ${fmtCurrency(p.salePrice)}</td>` : ''}
                <td>${fmtDate(p.expirationDate)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="openProductModal(${p.id})">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Excluir</button>
                  ${isStore ? '' : `
                    <button class="btn btn-primary btn-sm" style="margin-left:5px" onclick="quickMove(${p.id}, 1)">+1</button>
                    <button class="btn btn-danger btn-sm" onclick="quickMove(${p.id}, -1)">-1</button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  el.innerHTML = html;
}

async function deleteProduct(id) {
  if(!confirm('Tem certeza que deseja excluir?')) return;
  try {
    await api(`/products/${id}`, { method: 'DELETE' });
    showToast('Produto excluído', 'success');
    renderPage('products');
  } catch(e) { showToast(e.message, 'error'); }
}

async function quickMove(productId, amount) {
  try {
    await api('/movements', {
      method: 'POST',
      body: { productId, type: amount > 0 ? 'IN' : 'OUT', quantity: Math.abs(amount), reason: 'Ajuste rápido' }
    });
    showToast('Estoque atualizado', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== ALERTS =====
async function renderAlerts(el, actions) {
  actions.innerHTML = `<button class="btn btn-secondary" onclick="api('/alerts/read-all', {method:'PATCH'}).then(()=>renderPage('alerts'))">Marcar todos lidos</button>`;
  const alerts = await api('/alerts');
  
  if (!alerts.length) {
    el.innerHTML = `<div class="card" style="padding:4rem 2rem; text-align:center"><h3 style="margin-bottom:1rem">Tudo tranquilo!</h3><p class="text-muted">Você não tem alertas pendentes.</p></div>`;
    return;
  }
  
  el.innerHTML = `
    <div class="card">
      ${alerts.map(a => `
        <div class="alert-item" style="${a.isRead ? 'opacity:0.7' : 'background:var(--primary-light)'}">
          <div class="alert-icon">${a.type === 'LOW_STOCK' ? '📉' : a.type === 'EXPIRED' ? '🚨' : '⏰'}</div>
          <div class="alert-text">
            <p>${a.message}</p>
            <small>${new Date(a.createdAt).toLocaleString('pt-BR')} · ${a.product?.name}</small>
          </div>
          <button class="icon-btn" onclick="api('/alerts/${a.id}/dismiss', {method:'PATCH'}).then(()=>renderPage('alerts'))">✕</button>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== CATEGORIES =====
async function renderCategories(el, actions) {
  actions.innerHTML = `<button class="btn btn-primary" onclick="openCategoryModal()">+ Nova Categoria</button>`;
  const cats = await api('/categories');
  state.categories = cats;
  
  el.innerHTML = `
    <div class="stats-grid">
      ${cats.map(c => `
        <div class="stat-card" style="flex-direction:column; align-items:flex-start">
          <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:1rem">
            <div class="stat-icon" style="background:${c.color}22; color:${c.color}">${c.icon}</div>
            <button class="icon-btn" style="color:var(--danger)" onclick="deleteCategory(${c.id})">🗑️</button>
          </div>
          <h3>${c.name}</h3>
          <small class="text-muted">${c._count?.products || 0} produtos associados</small>
        </div>
      `).join('')}
    </div>
  `;
}

async function deleteCategory(id) {
  if(!confirm('Excluir esta categoria?')) return;
  try {
    await api(`/categories/${id}`, { method: 'DELETE' });
    showToast('Categoria excluída', 'success');
    renderPage('categories');
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== MODALS =====
async function openProductModal(id = null) {
  const sel = document.getElementById('product-category');
  if(!state.categories.length) state.categories = await api('/categories');
  sel.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  document.getElementById('modal-title').textContent = 'Novo Produto';
  
  if (id) {
    document.getElementById('modal-title').textContent = 'Editar Produto';
    const p = await api(`/products/${id}`);
    document.getElementById('product-id').value = p.id;
    document.getElementById('product-name').value = p.name;
    document.getElementById('product-category').value = p.categoryId;
    document.getElementById('product-quantity').value = p.quantity;
    if (p.expirationDate) document.getElementById('product-expiration').value = p.expirationDate.split('T')[0];
    document.getElementById('product-min-qty').value = p.minQuantity;
    
    if (state.user.role === 'STORE') {
      document.getElementById('product-sku').value = p.sku || '';
      document.getElementById('product-cost').value = p.costPrice || '';
      document.getElementById('product-sale').value = p.salePrice || '';
      document.getElementById('product-supplier').value = p.supplier || '';
    }
  }
  document.getElementById('product-modal').classList.remove('hidden');
}

document.getElementById('product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('product-id').value;
  const data = {
    name: document.getElementById('product-name').value,
    categoryId: Number(document.getElementById('product-category').value),
    quantity: Number(document.getElementById('product-quantity').value),
    minQuantity: Number(document.getElementById('product-min-qty').value),
    expirationDate: document.getElementById('product-expiration').value || null
  };
  
  if (state.user.role === 'STORE') {
    data.sku = document.getElementById('product-sku').value || null;
    data.costPrice = Number(document.getElementById('product-cost').value || 0);
    data.salePrice = Number(document.getElementById('product-sale').value || 0);
    data.supplier = document.getElementById('product-supplier').value || null;
  }
  
  try {
    if (id) await api(`/products/${id}`, { method: 'PUT', body: data });
    else await api('/products', { method: 'POST', body: data });
    
    document.getElementById('product-modal').classList.add('hidden');
    showToast(id ? 'Produto atualizado' : 'Produto criado', 'success');
  } catch(e) { showToast(e.message, 'error'); }
});

function openCategoryModal() {
  document.getElementById('category-form').reset();
  document.getElementById('category-modal').classList.remove('hidden');
}

document.getElementById('category-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/categories', { method: 'POST', body: {
      name: document.getElementById('category-name').value,
      icon: document.getElementById('category-icon').value,
      color: document.getElementById('category-color').value
    }});
    document.getElementById('category-modal').classList.add('hidden');
    showToast('Categoria criada', 'success');
    renderPage('categories');
  } catch(e) { showToast(e.message, 'error'); }
});

// Close Modals
['modal-close', 'modal-cancel', 'category-modal-close', 'category-cancel'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById('product-modal').classList.add('hidden');
    document.getElementById('category-modal').classList.add('hidden');
  });
});
