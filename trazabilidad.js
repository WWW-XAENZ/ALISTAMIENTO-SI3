function aplicarRevisadosLocales(registros) {
  try {
    const revisados = JSON.parse(localStorage.getItem('trazabilidad_revisados') || '{}');
    return registros.map(registro => ({
      ...registro,
      revisado: Boolean(registro.revisado || (registro.id && revisados[registro.id]))
    }));
  } catch (error) {
    return registros;
  }
}

function guardarRevisadoLocal(id) {
  if (!id) return;
  try {
    const revisados = JSON.parse(localStorage.getItem('trazabilidad_revisados') || '{}');
    revisados[id] = true;
    localStorage.setItem('trazabilidad_revisados', JSON.stringify(revisados));
  } catch (error) {
    console.error('No se pudo guardar respaldo local de revisado:', error);
  }
}

async function saveTrazabilidad(registros) {
  if (isSupabaseEnabled()) {
    for (const registro of registros) {
      await DB.saveTrazabilidad(registro);
    }
    return;
  }
  localStorage.setItem('trazabilidad_registros', JSON.stringify(registros));
}

async function getTrazabilidad() {
  if (isSupabaseEnabled()) {
    try {
      const registros = await DB.getTrazabilidad();
      if (Array.isArray(registros) && registros.length > 0) {
        return aplicarRevisadosLocales(registros);
      }
    } catch (error) {
      console.error('Error obteniendo trazabilidad desde Supabase:', error);
    }
  }
  try {
    const data = localStorage.getItem('trazabilidad_registros');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

async function renderTrazabilidad() {
  const tbody = document.getElementById('cuerpoTablaTrazabilidad');
  if (!tbody) return;
  const registros = await getTrazabilidad();
  tbody.innerHTML = '';

  if (registros.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8" class="tabla-empty">Sin registros</td>';
    tbody.appendChild(tr);
    return;
  }

  registros.forEach((registro, index) => {
    const tr = document.createElement('tr');
    if (registro.revisado) {
      tr.className = 'tabla-row--revisado';
    }
    tr.innerHTML = `
      <td>${escapeHtml(registro.fecha || '')}</td>
      <td>${escapeHtml(registro.referencia || '')}</td>
      <td>${escapeHtml(registro.ckd || '')}</td>
      <td>${escapeHtml(registro.responsable || '')}</td>
      <td>${escapeHtml(registro.cantidad || '')}</td>
      <td>${registro.foto ? `<img src="${registro.foto}" class="tabla-foto-img" style="height:32px;vertical-align:middle;border-radius:4px;${registro.revisado ? 'border:2px solid #22c55e;' : 'background:#f9fafb;padding:2px;'}" onerror="this.style.display='none'">` : ''}</td>
      <td>${escapeHtml(registro.novedades || '')}</td>
      <td>
        ${registro.revisado ? '<span style="color:#22c55e;font-weight:600;">✓ Revisado</span>' : ''}
        <button class="btn-delete" data-index="${index}" data-id="${registro.id || ''}" title="Eliminar registro">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.tabla-foto-img').forEach((img, index) => {
    img.addEventListener('click', async (e) => {
      e.stopPropagation();
      const win = window.open('', '_blank', 'width=900,height=700');
      if (win) {
        win.document.write(`<html><head><title>Trazabilidad</title></head><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${img.src}" style="max-width:100%;max-height:100%;"></body></html>`);
      }
      const registros = await getTrazabilidad();
      const registroActual = registros[index];
      if (registroActual && !registroActual.revisado) {
        registroActual.revisado = true;
        let supabaseOk = false;
        if (isSupabaseEnabled() && registroActual.id) {
          try {
            await DB.updateTrazabilidad(registroActual.id, { revisado: true });
            supabaseOk = true;
          } catch (error) {
            const esColumnaFaltante = error && error.code === 'PGRST204';
            if (!esColumnaFaltante) {
              console.error('Error marcando trazabilidad como revisada:', error);
            }
          }
        }
        if (!supabaseOk) {
          guardarRevisadoLocal(registroActual.id);
        }
        const row = img.closest('tr');
        if (row) {
          row.classList.add('tabla-row--revisado');
          img.style.border = '2px solid #22c55e';
          const lastCell = row.querySelector('td:last-child');
          if (lastCell && !lastCell.querySelector('.revisado-badge')) {
            const badge = document.createElement('span');
            badge.className = 'revisado-badge';
            badge.style.color = '#22c55e';
            badge.style.fontWeight = '600';
            badge.textContent = '✓ Revisado';
            lastCell.insertBefore(badge, lastCell.firstChild);
          }
        }
      }
    });
  });

  tbody.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const id = btn.getAttribute('data-id');
      if (!confirm('¿Deseas eliminar este registro de trazabilidad?')) return;
      
      if (isSupabaseEnabled() && id) {
        await DB.deleteTrazabilidad(id);
      } else {
        const lista = await getTrazabilidad();
        lista.splice(idx, 1);
        saveTrazabilidad(lista);
      }
      renderTrazabilidad();
      renderAdmin();
      showToast('REGISTRO DE TRAZABILIDAD ELIMINADO', 'info');
    });
  });
}

async function renderAdmin() {
  const grid = document.getElementById('adminGrid');
  if (!grid) return;
  let registros = await getTrazabilidad();
  grid.innerHTML = '';

  const filtroFecha = document.getElementById('admin_fecha') || document.getElementById('adminDate');
  if (filtroFecha && filtroFecha.value) {
    registros = registros.filter(r => r.fecha === filtroFecha.value);
  }

  const searchInput = document.getElementById('adminSearch');
  if (searchInput && searchInput.value.trim()) {
    const filtro = searchInput.value.trim().toLowerCase();
    registros = registros.filter((r) => {
      return (r.referencia || '').toLowerCase().includes(filtro) ||
             (r.responsable || '').toLowerCase().includes(filtro) ||
             (r.ckd || '').toLowerCase().includes(filtro);
    });
  }

  if (registros.length === 0) {
    grid.innerHTML = '<div class="admin-empty">Sin registros</div>';
    return;
  }

  registros.forEach((registro, index) => {
    const card = document.createElement('div');
    card.className = 'admin-card' + (registro.revisado ? ' admin-card--revisado' : '');
    card.innerHTML = `
      <div class="admin-card-header">
        <div>
          <div class="admin-card-title">${escapeHtml(registro.referencia || '')}</div>
          <div class="admin-card-meta">${escapeHtml(registro.fecha || '')} - ${escapeHtml(registro.responsable || '')}</div>
          <div class="admin-card-info">
          ${registro.cantidad ? `<div class="admin-card-meta">Cantidad: ${escapeHtml(registro.cantidad)}</div>` : ''}
          ${registro.novedades ? `<div class="admin-card-novedades">${escapeHtml(registro.novedades)}</div>` : ''}
          </div>
        </div>
        ${registro.revisado ? '<span class="admin-card-check">✓</span>' : ''}
      </div>
        ${registro.foto ? `<img src="${registro.foto}" class="admin-card-img${registro.revisado ? ' admin-img--revisada' : ''}" onerror="this.style.display='none'">` : '<div class="admin-card-empty">Sin foto</div>'}
    `;
    grid.appendChild(card);

    const img = card.querySelector('.admin-card-img');
    if (!img) return;
    img.addEventListener('click', async () => {
      const win = window.open('', '_blank', 'width=900,height=700');
      if (win) {
        win.document.write(`<html><head><title>Trazabilidad</title></head><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${img.src}" style="max-width:100%;max-height:100%;"></body></html>`);
      }
      const registros = await getTrazabilidad();
      const registroActual = registro.id
        ? registros.find(item => item.id === registro.id)
        : registros[index];
      if (registroActual && !registroActual.revisado) {
        registroActual.revisado = true;
        try {
          if (isSupabaseEnabled() && registroActual.id) {
            await DB.updateTrazabilidad(registroActual.id, { revisado: true });
          }
        } catch (error) {
          const esColumnaFaltante = error && error.code === 'PGRST204';
          if (!esColumnaFaltante) {
            console.error('Error marcando trazabilidad como revisada:', error);
          }
        } finally {
          guardarRevisadoLocal(registroActual.id);
        }
        const card = img.closest('.admin-card');
        if (card) {
          card.classList.add('admin-card--revisado');
          const header = card.querySelector('.admin-card-header');
          if (header && !header.querySelector('.admin-card-check')) {
            const check = document.createElement('span');
            check.className = 'admin-card-check';
            check.textContent = '✓';
            header.appendChild(check);
          }
        }
        img.classList.add('admin-img--revisada');
        await renderTrazabilidad();
    });
  });
}
