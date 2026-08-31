function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTrazabilidad() {
  try {
    const data = localStorage.getItem('trazabilidad_registros');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function renderAdmin() {
  const grid = document.getElementById('adminGrid');
  const searchInput = document.getElementById('adminSearch');
  const dateInput = document.getElementById('adminDate');

  if (!grid) return;

  const registros = getTrazabilidad();
  const filtro = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const fechaFiltro = dateInput ? dateInput.value.trim() : '';

  const filtrados = registros.filter((r) => {
    const coincideBusqueda =
      !filtro ||
      (r.referencia || '').toLowerCase().includes(filtro) ||
      (r.responsable || '').toLowerCase().includes(filtro) ||
      (r.ckd || '').toLowerCase().includes(filtro);

    const coincideFecha = !fechaFiltro || (r.fecha || '') === fechaFiltro;

    return coincideBusqueda && coincideFecha;
  });

  grid.innerHTML = '';

  if (filtrados.length === 0) {
    const mensaje = document.createElement('div');
    mensaje.className = 'admin-empty';
    mensaje.textContent = 'Sin registros para este filtro';
    grid.appendChild(mensaje);
    return;
  }

  filtrados.forEach((registro) => {
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.innerHTML = `
      <div class="admin-card-header">
        <div>
          <div class="admin-card-title">${escapeHtml(registro.referencia || '')}</div>
          <div class="admin-card-meta">${escapeHtml(registro.fecha || '')} - ${escapeHtml(registro.responsable || '')} - ${escapeHtml(registro.ckd || '')}</div>
          ${registro.cantidad ? `<div class="admin-card-meta">Cantidad: ${escapeHtml(registro.cantidad)}</div>` : ''}
          ${registro.novedades ? `<div class="admin-card-meta">Novedades: ${escapeHtml(registro.novedades)}</div>` : ''}
        </div>
      </div>
      <div class="admin-card-body">
        ${registro.foto ? `<img src="${registro.foto}" class="admin-card-img" onerror="this.style.display='none'">` : '<div class="admin-card-empty">Sin foto</div>'}
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.admin-card-img').forEach((img) => {
    img.addEventListener('click', () => {
      const win = window.open('', '_blank', 'width=900,height=700');
      if (win) {
        win.document.write(`<html><head><title>Trazabilidad</title></head><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${img.src}" style="max-width:100%;max-height:100%;"></body></html>`);
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

renderAdmin();
