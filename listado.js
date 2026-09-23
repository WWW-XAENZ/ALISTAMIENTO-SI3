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

function getNombreAdicional(c) {
  // Busca la clave de descripción considerando posibles espacios al inicio/final
  const candidatos = ['tipo', 'description', 'descripcion', 'nombre', 'Nombre'];
  for (const key of candidatos) {
    if (c[key] && typeof c[key] === 'string' && c[key].trim()) {
      return c[key].trim();
    }
  }
  // Busca cualquier clave que contenga 'description' o 'nombre'
  for (const key of Object.keys(c)) {
    if (/description|nombre|tipo/i.test(key) && typeof c[key] === 'string' && c[key].trim()) {
      return c[key].trim();
    }
  }
  return 'ADICIONAL';
}

function getComponentes(producto) {
  const todos = Array.isArray(producto.componentes) ? producto.componentes : [];
  const baseComponentes = [];
  const adicionales = [];
  todos.forEach(c => {
    const tipo = (c.tipo || '').toLowerCase();
    if (tipo.includes('base') || tipo.includes('forro')) {
      baseComponentes.push(c);
    } else {
      adicionales.push(c);
    }
  });
  const extras = Array.isArray(producto.componentes_adicionales) ? producto.componentes_adicionales : [];
  const kits = Array.isArray(producto.kits) ? producto.kits : [];
  const anti = Array.isArray(producto.anti_vibrantes) ? producto.anti_vibrantes : [];
  return {
    componentes: baseComponentes,
    adicionales: [...adicionales, ...extras, ...kits, ...anti]
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
      const comps = getComponentes(p);
      const nombre = (p.producto || p.referencia || '').toLowerCase();
      const codigos = comps.componentes.map(c => String(c.codigo || '').toLowerCase()).join(' ');
      const codigosAd = comps.adicionales.map(c => String(c.codigo || '').toLowerCase()).join(' ');
      const tipos = [...comps.componentes, ...comps.adicionales].map(c => String(c.tipo || '').toLowerCase()).join(' ');
      const descripciones = [...comps.componentes, ...comps.adicionales].map(c => String(c.descripcion || '').toLowerCase()).join(' ');
      return nombre.includes(filtro) || codigos.includes(filtro) || codigosAd.includes(filtro) || tipos.includes(filtro) || descripciones.includes(filtro);
    });

    if (filtrados.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'listado-empty';
      empty.textContent = 'SIN REFERENCIAS PARA ESTE FILTRO';
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
          ${escapeHtml((producto.producto || '').toUpperCase())}
        </div>
        <div class="listado-section">
          <div class="listado-section-title">COMPONENTES</div>
          <div>
            ${componentes.map(c => {
              let chipStyle = '';
              const tipo = c.tipo || '';
              if (tipo.toLowerCase().includes('gris-negro')) chipStyle = 'background:linear-gradient(135deg,#1e293b,#334155);color:#e2e8f0;border:1px solid #64748b;font-weight:700;box-shadow:0 4px 12px rgba(30,41,59,0.4),inset 0 1px 0 rgba(255,255,255,0.1);';
              else if (tipo.toLowerCase().includes('rojo')) chipStyle = 'background:linear-gradient(135deg,#991b1b,#dc2626,#ef4444);color:#fecaca;font-weight:800;border:1px solid #7f1d1d;box-shadow:0 4px 14px rgba(220,38,38,0.5),inset 0 1px 0 rgba(255,255,255,0.15);';
              else if (tipo.toLowerCase().includes('ee')) chipStyle = 'background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 30%,#d946ef 60%,#f59e0b 100%);color:#ffffff;font-weight:800;border:1px solid #6d28d9;box-shadow:0 4px 16px rgba(139,92,246,0.5),inset 0 1px 0 rgba(255,255,255,0.2);';
              return `
              <span class="listado-chip" style="${chipStyle}">
                <span class="chip-type">${escapeHtml((c.tipo || '').toUpperCase())}</span>
                <span class="chip-code">${escapeHtml(c.codigo || '')}</span>
                ${c.cantidad_por_base ? `<span style="color:rgba(255,255,255,0.85);font-size:0.82rem;font-weight:600;">x${escapeHtml(String(c.cantidad_por_base))}</span>` : ''}
              </span>
            `}).join('')}
          </div>
        </div>
        ${adicionales.length > 0 ? `
        <div class="listado-section">
          <div class="listado-section-title">ADICIONALES</div>
          <div>
${adicionales.map(c => {
  return `
              <span class="listado-chip">
                <span class="chip-type">${escapeHtml(getNombreAdicional(c).toUpperCase())}</span>
                <span class="chip-code">${escapeHtml(c.codigo || '')}</span>
                ${c.cantidad_por_base ? `<span style="color:#64748b;font-size:0.82rem;">x${escapeHtml(String(c.cantidad_por_base))}</span>` : ''}
              </span>
            `}).join('')}
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
      const href = link.getAttribute('href');
      if (href && href !== '#') {
        window.location.href = href;
      }
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



