function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function initAdminMenu() {
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

if (document.getElementById('adminSearch')) {
  document.getElementById('adminSearch').addEventListener('input', renderAdmin);
}

if (document.getElementById('adminDate')) {
  document.getElementById('adminDate').addEventListener('change', renderAdmin);
}

if (document.getElementById('btnClearFilters')) {
  document.getElementById('btnClearFilters').addEventListener('click', () => {
    const searchInput = document.getElementById('adminSearch');
    const dateInput = document.getElementById('adminDate');
    if (searchInput) searchInput.value = '';
    if (dateInput) dateInput.value = '';
    renderAdmin();
  });
}

if (document.getElementById('btnHoy')) {
  document.getElementById('btnHoy').addEventListener('click', () => {
    const dateInput = document.getElementById('adminDate');
    if (dateInput) {
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, '0');
      const dd = String(hoy.getDate()).padStart(2, '0');
      const fechaHoy = `${yyyy}-${mm}-${dd}`;
      dateInput.value = fechaHoy;
      renderAdmin();
    }
  });
}

async function initAdmin() {
  try {
    if (typeof initSupabase === 'function') {
      await initSupabase();
    }
  } catch (error) {
    console.error('Error inicializando Supabase en admin:', error);
  }
  renderAdmin();
  
  if (isSupabaseEnabled() && typeof DB.onTrazabilidadChange === 'function') {
    DB.onTrazabilidadChange(async (payload) => {
      console.log('Cambio en trazabilidad (admin):', payload);
      await renderAdmin();
      await renderTrazabilidad();
    });
  }
}

initAdmin();
initAdminMenu();
