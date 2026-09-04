const JSON_PATH = 'Registros.json';

async function cargarRegistrosJSON() {
  try {
    const response = await fetch(JSON_PATH + '?t=' + Date.now());
    if (!response.ok) return [];
    const json = await response.json();
    if (json && Array.isArray(json.materiales)) return json.materiales;
    return [];
  } catch (e) {
    return [];
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getComponentes(producto) {
  const componentes = Array.isArray(producto.componentes) ? producto.componentes : [];
  const adicionales = Array.isArray(producto.componentes_adicionales) ? producto.componentes_adicionales : [];
  const kits = Array.isArray(producto.kits) ? producto.kits : [];
  const anti = Array.isArray(producto.anti_vibrantes) ? producto.anti_vibrantes : [];
  return {
    componentes,
    adicionales: [...adicionales, ...kits, ...anti]
  };
}

function renderListado() {
  const grid = document.getElementById('listadoGrid');
  const searchInput = document.getElementById('listadoSearch');
  if (!grid) return;

  cargarRegistrosJSON().then((productos) => {
    const filtro = searchInput ? searchInput.value.trim().toLowerCase() : '';
    grid.innerHTML = '';

    const filtrados = productos.filter((p) => {
      if (!filtro) return true;
      const nombre = (p.producto || '').toLowerCase();
      const codigos = getComponentes(p).componentes.map(c => (c.codigo || '').toLowerCase()).join(' ');
      const codigosAd = getComponentes(p).adicionales.map(c => (c.codigo || '').toLowerCase()).join(' ');
      return nombre.includes(filtro) || codigos.includes(filtro) || codigosAd.includes(filtro);
    });

    if (filtrados.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'listado-empty';
      empty.textContent = 'Sin referencias para este filtro';
      grid.appendChild(empty);
      return;
    }

    filtrados.forEach((producto) => {
      const { componentes, adicionales } = getComponentes(producto);
      const card = document.createElement('div');
      card.className = 'listado-card';
      card.innerHTML = `
        <div class="listado-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 7h-4V5l-2-2h-4L8 5v2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
            <path d="M16 7v2"/>
            <path d="M8 7v2"/>
          </svg>
          ${escapeHtml(producto.producto || '')}
        </div>
        <div class="listado-section">
          <div class="listado-section-title">Componentes</div>
          <div>
            ${componentes.map(c => `
              <span class="listado-chip">
                <span class="chip-type">${escapeHtml(c.tipo || '')}</span>
                <span class="chip-code">${escapeHtml(c.codigo || '')}</span>
              </span>
            `).join('')}
          </div>
        </div>
        ${adicionales.length > 0 ? `
        <div class="listado-section">
          <div class="listado-section-title">Adicionales</div>
          <div>
            ${adicionales.map(c => `
              <span class="listado-chip">
                <span class="chip-type">${escapeHtml(c.tipo || c.descripcion || 'Adicional')}</span>
                <span class="chip-code">${escapeHtml(c.codigo || '')}</span>
                ${c.cantidad_por_base ? `<span style="color:#64748b;font-size:0.82rem;">x${escapeHtml(String(c.cantidad_por_base))}</span>` : ''}
              </span>
            `).join('')}
          </div>
        </div>
        ` : ''}
      `;
      grid.appendChild(card);
    });
  });
}

function initListado() {
  const searchInput = document.getElementById('listadoSearch');
  if (searchInput) {
    searchInput.addEventListener('input', renderListado);
  }
  renderListado();
}

function initMenuListado() {
  const btnMenu = document.getElementById('btnMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  const btnCerrarMenu = document.getElementById('btnCerrarMenu');
  const menuInicio = document.getElementById('menuInicio');
  const menuTrazabilidad = document.getElementById('menuTrazabilidad');
  const menuAdmin = document.getElementById('menuAdmin');
  const menuListado = document.getElementById('menuListado');

  function abrirMenu() {
    if (menuOverlay) menuOverlay.classList.add('open');
  }

  function cerrarMenu() {
    if (menuOverlay) menuOverlay.classList.remove('open');
  }

  if (btnMenu) btnMenu.addEventListener('click', abrirMenu);
  if (btnCerrarMenu) btnCerrarMenu.addEventListener('click', cerrarMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', (e) => { if (e.target === menuOverlay) cerrarMenu(); });

  [menuInicio, menuTrazabilidad, menuAdmin, menuListado].forEach((link) => {
    if (!link) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarMenu();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initListado();
    initMenuListado();
  });
} else {
  initListado();
  initMenuListado();
}
