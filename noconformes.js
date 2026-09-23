const NC_STORAGE_KEY = 'noconformes_registros';

let editNCId = null;
let paginaNCActual = 1;
const NC_POR_PAGINA = 34;
let guardandoNC = false;
let previewNCDataUrl = '';
let ncSupabaseReady = null;

const NC_BADGES = {
  CORTADO: 'nc-badge-cortado',
  ROTO: 'nc-badge-roto',
  PARTIDO: 'nc-badge-partido',
  DEFECTO: 'nc-badge-defecto',
  MANCHADO: 'nc-badge-manchado',
  DESALINEADO: 'nc-badge-desalineado',
  DETERIORADO: 'nc-badge-deteriorado',
  OTRO: 'nc-badge-otro',
};

const NC_TIPO_BADGES = {
  FORROS: 'nc-tipo-badge',
  BASES: 'nc-tipo-badge',
  USB: 'nc-tipo-badge',
  'MATERIA PRIMA': 'nc-tipo-badge',
  IOT: 'nc-tipo-badge',
};

function getTodayString() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toUpper(text) {
  if (!text) return '';
  return text.toUpperCase();
}

function getTipoClass(tipo) {
  return NC_BADGES[tipo] || 'nc-badge-otro';
}

async function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

async function getNoConformes() {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase no está conectado en No Conformes');
  }
  const data = await DB.getNoConformes();
  return data || [];
}

async function saveNoConformes(registros) {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase no está conectado en No Conformes');
  }
  for (const reg of registros) {
    await DB.saveNoConforme(reg);
  }
}

function getNCFormData() {
  const tipoNC = document.getElementById('nc_accion').value;
  let tipoFinal = tipoNC;
  if (tipoNC === 'OTRO') {
    tipoFinal = document.getElementById('nc_otro').value.trim() || 'OTRO';
  }
  return {
    fecha: toUpper(document.getElementById('nc_fecha').value.trim()) || getTodayString(),
    codigo: toUpper(document.getElementById('nc_codigo').value.trim()),
    tipo: toUpper(document.getElementById('nc_tipo').value),
    proveedor: toUpper(document.getElementById('nc_proveedor').value.trim()),
    descripcion: toUpper(document.getElementById('nc_descripcion').value.trim()),
    cantidad: document.getElementById('nc_cantidad').value,
    responsable: toUpper(document.getElementById('nc_responsable').value.trim()),
    accion: toUpper(tipoFinal),
    doc_bloqueado: toUpper(document.getElementById('nc_doc_bloqueado').value.trim()),
  };
}

function limpiarFormularioNC() {
  document.getElementById('nc_fecha').value = '';
  document.getElementById('nc_codigo').value = '';
  document.getElementById('nc_tipo').value = '';
  document.getElementById('nc_proveedor').value = '';
  document.getElementById('nc_descripcion').value = '';
  document.getElementById('nc_cantidad').value = '';
  document.getElementById('nc_responsable').value = '';
  document.getElementById('nc_accion').value = '';
  document.getElementById('nc_otro').value = '';
  document.getElementById('nc_otro_group').style.display = 'none';
  document.getElementById('nc_doc_bloqueado').value = '';
  const preview = document.getElementById('nc_preview');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  previewNCDataUrl = '';
  const imagenInput = document.getElementById('nc_imagen');
  if (imagenInput) imagenInput.value = '';
  editNCId = null;
  document.getElementById('btnGuardarNC').textContent = 'GUARDAR NO CONFORME';
  document.getElementById('btnGuardarNC').className = 'btn-primary';
  document.getElementById('btnCancelarNC').style.display = 'none';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function renderTablaNC() {
  const registros = await getNoConformes();
  const tbody = document.getElementById('cuerpoTablaNC');
  if (!tbody) return;
  tbody.innerHTML = '';

  let totalRows = 0;

  if (registros.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="12" class="tabla-empty">Sin no conformes registrados</td>';
    tbody.appendChild(tr);
    const countEl = document.getElementById('nc_count');
    if (countEl) countEl.textContent = 0;
    actualizarPaginacionNC(0);
    return;
  }

  registros.forEach((registro) => {
    totalRows++;
    const numeroRegistro = totalRows;
    const tr = document.createElement('tr');

    const tipoClass = getTipoClass(registro.accion);
    const tipoBadge = registro.accion ? '<span class="nc-badge ' + tipoClass + '">' + escapeHtml(registro.accion) + '</span>' : '—';
    const tipoNcBadge = registro.tipo ? '<span class="nc-tipo-badge">' + escapeHtml(registro.tipo) + '</span>' : '—';
    const docBloqueadoHtml = registro.doc_bloqueado ? '<span class="nc-doc-blocked">' + escapeHtml(registro.doc_bloqueado) + '</span>' : '—';
    const rowBg = registro.doc_bloqueado ? 'style="background:var(--danger-50);"' : '';

    const imagenHtml = registro.imagen ? '<img src="' + registro.imagen + '" class="tabla-foto-img nc-img-view" data-img="' + registro.imagen + '" style="height:36px;cursor:pointer;" alt="Imagen" title="Clic para ver">' : '<span style="color:var(--text-tertiary);">—</span>';

    tr.innerHTML = '<td class="registro-numero">' + numeroRegistro + '</td>' +
      '<td>' + escapeHtml(registro.fecha) + '</td>' +
      '<td>' + escapeHtml(registro.codigo) + '</td>' +
      '<td>' + tipoNcBadge + '</td>' +
      '<td>' + escapeHtml(registro.proveedor) + '</td>' +
      '<td>' + escapeHtml(registro.descripcion) + '</td>' +
      '<td>' + tipoBadge + '</td>' +
      '<td>' + escapeHtml(registro.cantidad) + '</td>' +
      '<td>' + escapeHtml(registro.responsable) + '</td>' +
      '<td>' + docBloqueadoHtml + '</td>' +
      '<td>' + imagenHtml + '</td>' +
      '<td><div class="registro-actions">' +
        '<button class="btn-edit" data-id="' + registro.id + '" title="Editar">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Editar' +
        '</button>' +
        '<button class="btn-delete" data-id="' + registro.id + '" title="Eliminar">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Eliminar' +
        '</button>' +
      '</div></td>';
    if (rowBg) { tr.setAttribute('data-bg', 'blocked'); }
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.nc-img-view').forEach((img) => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      openModalImagen(e.target.dataset.img);
    });
  });

  const countEl = document.getElementById('nc_count');
  if (countEl) countEl.textContent = totalRows;
  actualizarPaginacionNC(totalRows);
}

function openModalImagen(src) {
  const modal = document.getElementById('modalImagenNC');
  const modalImg = document.getElementById('modal_img_nc');
  if (!modal || !modalImg) return;
  modalImg.src = src;
  modal.style.display = 'flex';
}

function closeModalImagen() {
  const modal = document.getElementById('modalImagenNC');
  if (!modal) return;
  modal.style.display = 'none';
  document.getElementById('modal_img_nc').src = '';
}

function actualizarPaginacionNC(totalFilas) {
  const paginacion = document.getElementById('nc_paginacion');
  const tbody = document.getElementById('cuerpoTablaNC');
  if (!paginacion || !tbody) return;

  const totalPaginas = Math.max(1, Math.ceil(totalFilas / NC_POR_PAGINA));
  paginaNCActual = Math.min(Math.max(paginaNCActual, 1), totalPaginas);

  tbody.querySelectorAll('tr[data-pagina]').forEach((fila) => {
    const pagina = Number(fila.dataset.pagina);
    fila.hidden = pagina !== paginaNCActual;
  });

  if (totalFilas <= NC_POR_PAGINA) {
    paginacion.innerHTML = '';
    return;
  }

  const botones = [];
  botones.push('<button type="button" class="pagina-btn pagina-anterior" data-pagina="' + (paginaNCActual - 1) + '" ' + (paginaNCActual === 1 ? 'disabled' : '') + '>‹</button>');
  for (let p = 1; p <= totalPaginas; p++) {
    botones.push('<button type="button" class="pagina-btn' + (p === paginaNCActual ? ' activa' : '') + '" data-pagina="' + p + '" aria-current="' + (p === paginaNCActual ? 'page' : 'false') + '">' + p + '</button>');
  }
  botones.push('<button type="button" class="pagina-btn pagina-siguiente" data-pagina="' + (paginaNCActual + 1) + '" ' + (paginaNCActual === totalPaginas ? 'disabled' : '') + '>›</button>');
  paginacion.innerHTML = botones.join('');
  paginacion.querySelectorAll('[data-pagina]').forEach((btn) => {
    btn.addEventListener('click', () => {
      paginaNCActual = Number(btn.dataset.pagina);
      actualizarPaginacionNC(totalFilas);
    });
  });
}

async function agregarNoConforme(e) {
  e.preventDefault();
  if (guardandoNC) return;

  const btnGuardar = document.getElementById('btnGuardarNC');
  guardandoNC = true;
  if (btnGuardar) { btnGuardar.disabled = true; }

  try {
    await ncSupabaseReady;
    if (!isSupabaseEnabled()) {
      throw new Error('Supabase no está conectado. El registro no se guardó.');
    }
    const data = getNCFormData();
    let imagenData = previewNCDataUrl || '';

    const imagenInput = document.getElementById('nc_imagen');
    if (imagenInput && imagenInput.files && imagenInput.files[0]) {
      try {
        imagenData = await compressImage(imagenInput.files[0]);
      } catch (err) {
        showToast('ERROR AL PROCESAR LA IMAGEN', 'error');
        return;
      }
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));

    const registro = {
      id: id,
      fecha: data.fecha,
      codigo: data.codigo,
      tipo: data.tipo,
      proveedor: data.proveedor,
      descripcion: data.descripcion,
      cantidad: data.cantidad,
      responsable: data.responsable,
      accion: data.accion,
      doc_bloqueado: data.doc_bloqueado,
      imagen: imagenData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await DB.saveNoConforme(registro);

    limpiarFormularioNC();
    await renderTablaNC();
    showToast('NO CONFORME REGISTRADO CORRECTAMENTE', 'success');
  } catch (error) {
    console.error('Error al guardar no conforme:', error);
    showToast('ERROR AL GUARDAR', 'error');
  } finally {
    guardandoNC = false;
    if (btnGuardar) { btnGuardar.disabled = false; }
  }
}

async function editarNoConforme(id) {
  await ncSupabaseReady;
  if (!isSupabaseEnabled()) {
    showToast('SUPABASE NO ESTÁ CONECTADO', 'error');
    return;
  }
  const registros = await getNoConformes();
  const registro = registros.find(r => r.id === id);
  if (!registro) return;

  document.getElementById('nc_fecha').value = registro.fecha || '';
  document.getElementById('nc_codigo').value = registro.codigo || '';
  document.getElementById('nc_tipo').value = registro.tipo || '';
  document.getElementById('nc_proveedor').value = registro.proveedor || '';
  document.getElementById('nc_descripcion').value = registro.descripcion || '';
  document.getElementById('nc_cantidad').value = registro.cantidad || '';
  document.getElementById('nc_responsable').value = registro.responsable || '';
  document.getElementById('nc_accion').value = registro.accion || '';
  document.getElementById('nc_doc_bloqueado').value = registro.doc_bloqueado || '';

  const tipoVal = registro.accion || '';
  if (tipoVal === 'OTRO') {
    document.getElementById('nc_otro').value = registro.accion || '';
    document.getElementById('nc_otro_group').style.display = '';
  } else {
    document.getElementById('nc_otro_group').style.display = 'none';
  }

  previewNCDataUrl = registro.imagen || '';
  const preview = document.getElementById('nc_preview');
  if (preview && registro.imagen) {
    preview.src = registro.imagen;
    preview.style.display = 'block';
  } else if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }

  editNCId = id;
  document.getElementById('btnGuardarNC').textContent = 'ACTUALIZAR';
  document.getElementById('btnGuardarNC').className = 'btn-update';
  document.getElementById('btnCancelarNC').style.display = 'inline-block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function actualizarNoConforme(e) {
  e.preventDefault();
  if (!editNCId) return;
  if (guardandoNC) return;

  const btnGuardar = document.getElementById('btnGuardarNC');
  guardandoNC = true;
  if (btnGuardar) { btnGuardar.disabled = true; }

  try {
    await ncSupabaseReady;
    if (!isSupabaseEnabled()) {
      throw new Error('Supabase no está conectado. El registro no se actualizó.');
    }
    const data = getNCFormData();

    let imagenData = previewNCDataUrl || '';
    const imagenInput = document.getElementById('nc_imagen');
    if (imagenInput && imagenInput.files && imagenInput.files[0]) {
      try {
        imagenData = await compressImage(imagenInput.files[0]);
      } catch (err) {
        showToast('ERROR AL PROCESAR LA IMAGEN', 'error');
        return;
      }
    }

    const updates = {
      fecha: data.fecha,
      codigo: data.codigo,
      tipo: data.tipo,
      proveedor: data.proveedor,
      descripcion: data.descripcion,
      cantidad: data.cantidad,
      responsable: data.responsable,
      accion: data.accion,
      doc_bloqueado: data.doc_bloqueado,
      imagen: imagenData,
      updated_at: new Date().toISOString(),
    };

    await DB.updateNoConforme(editNCId, updates);

    limpiarFormularioNC();
    await renderTablaNC();
    showToast('NO CONFORME ACTUALIZADO CORRECTAMENTE', 'success');
  } catch (error) {
    console.error('Error actualizando no conforme:', error);
    showToast('ERROR AL ACTUALIZAR', 'error');
  } finally {
    guardandoNC = false;
    if (btnGuardar) { btnGuardar.disabled = false; }
  }
}

async function eliminarNoConforme(id) {
  if (!confirm('¿Deseas eliminar este no conforme?')) return;

  await ncSupabaseReady;
  if (!isSupabaseEnabled()) {
    showToast('SUPABASE NO ESTÁ CONECTADO', 'error');
    return;
  }

  await DB.deleteNoConforme(id);

  await renderTablaNC();
  showToast('NO CONFORME ELIMINADO', 'info');
}

function initImagenNC() {
  const btnAdjuntar = document.getElementById('btnAdjuntarFotoNC');
  const btnTomar = document.getElementById('btnTomarFotoNC');
  const inputImagen = document.getElementById('nc_imagen');
  const inputCamara = document.getElementById('nc_imagen_camara');
  const preview = document.getElementById('nc_preview');

  if (btnAdjuntar && inputImagen) { btnAdjuntar.addEventListener('click', () => inputImagen.click()); }
  if (btnTomar && inputCamara) { btnTomar.addEventListener('click', () => inputCamara.click()); }

  if (inputImagen) {
    inputImagen.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file);
        previewNCDataUrl = dataUrl;
        if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
      } catch (err) { showToast('ERROR AL CARGAR IMAGEN', 'error'); }
    });
  }

  if (inputCamara) {
    inputCamara.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file);
        previewNCDataUrl = dataUrl;
        if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
      } catch (err) { showToast('ERROR AL CARGAR IMAGEN', 'error'); }
    });
  }
}

function initAccionSelect() {
  const accionSelect = document.getElementById('nc_accion');
  const otroGroup = document.getElementById('nc_otro_group');
  if (!accionSelect || !otroGroup) return;

  accionSelect.addEventListener('change', () => {
    if (accionSelect.value === 'OTRO') {
      otroGroup.style.display = '';
      document.getElementById('nc_otro').focus();
    } else {
      otroGroup.style.display = 'none';
      document.getElementById('nc_otro').value = '';
    }
  });
}

function exportarNoConformesExcel() {
  getNoConformes().then((registros) => {
    if (registros.length === 0) {
      showToast('NO HAY NO CONFORMES PARA EXPORTAR', 'info');
      return;
    }

    if (typeof XLSX !== 'undefined') {
      const wsData = [
        ['N.', 'FECHA', 'CODIGO', 'TIPO', 'PROVEEDOR', 'DESCRIPCION', 'TIPO NC', 'CANTIDAD', 'RESPONSABLE', 'DOC BLOQUEADO', 'IMAGEN'],
      ];
      registros.forEach((r, i) => {
        wsData.push([
          i + 1,
          r.fecha || '',
          r.codigo || '',
          r.tipo || '',
          r.proveedor || '',
          r.descripcion || '',
          r.accion || '',
          r.cantidad || '',
          r.responsable || '',
          r.doc_bloqueado || '',
          r.imagen ? 'SÍ' : 'NO',
        ]);
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const colWidths = [5, 12, 12, 14, 18, 30, 14, 10, 16, 18, 10];
      if (!ws['!cols']) ws['!cols'] = [];
      colWidths.forEach((w, idx) => { ws['!cols'][idx] = { wch: w }; });
      XLSX.utils.book_append_sheet(wb, ws, 'No Conformes');
      XLSX.writeFile(wb, 'NoConformes_' + getTodayString() + '.xlsx');
      showToast('EXCEL EXPORTADO: ' + registros.length + ' NO CONFORMES', 'success');
    } else {
      const encabezados = ['N', 'FECHA', 'CODIGO', 'TIPO', 'PROVEEDOR', 'DESCRIPCION', 'TIPO NC', 'CANTIDAD', 'RESPONSABLE', 'DOC BLOQUEADO', 'IMAGEN'];
      const lineas = [encabezados.map((h) => '"' + h + '"').join(';')];
      registros.forEach((r, i) => {
        const fila = [
          (i + 1),
          (r.fecha || '').replace(/"/g, '""'),
          (r.codigo || '').replace(/"/g, '""'),
          (r.tipo || '').replace(/"/g, '""'),
          (r.proveedor || '').replace(/"/g, '""'),
          (r.descripcion || '').replace(/"/g, '""'),
          (r.accion || '').replace(/"/g, '""'),
          (r.cantidad || '').replace(/"/g, '""'),
          (r.responsable || '').replace(/"/g, '""'),
          (r.doc_bloqueado || '').replace(/"/g, '""'),
          r.imagen ? 'SÍ' : 'NO',
        ];
        lineas.push(fila.map((c) => '"' + c + '"').join(';'));
      });
      const csv = '\uFEFF' + lineas.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'NoConformes_' + getTodayString() + '.csv';
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('ARCHIVO EXPORTADO: ' + registros.length + ' NO CONFORMES', 'success');
    }
  });
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message.toUpperCase();
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.add('show'); });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) { toast.parentNode.removeChild(toast); } }, 300);
  }, 2500);
}

function initMenuNoConformes() {
  const btnMenu = document.getElementById('btnMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  const btnCerrarMenu = document.getElementById('btnCerrarMenu');
  const menuInicio = document.getElementById('menuInicio');
  const menuTrazabilidad = document.getElementById('menuTrazabilidad');
  const menuNoConformes = document.getElementById('menuNoConformes');
  const menuListado = document.getElementById('menuListado');

  function abrirMenu() { if (menuOverlay) menuOverlay.classList.add('open'); }
  function cerrarMenu() { if (menuOverlay) menuOverlay.classList.remove('open'); }

  if (btnMenu) btnMenu.addEventListener('click', abrirMenu);
  if (btnCerrarMenu) btnCerrarMenu.addEventListener('click', cerrarMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', (e) => { if (e.target === menuOverlay) cerrarMenu(); });

  [menuInicio, menuTrazabilidad, menuNoConformes, menuListado].forEach((link) => {
    if (!link) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarMenu();
      const href = link.getAttribute('href');
      if (href && href !== '#') { window.location.href = href; }
    });
  });
}

document.getElementById('formNoConformes').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (editNCId) { await actualizarNoConforme(e); } else { await agregarNoConforme(e); }
});

document.getElementById('btnLimpiarNC').addEventListener('click', function(e) {
  e.preventDefault();
  e.stopPropagation();
  limpiarFormularioNC();
});

document.getElementById('btnCancelarNC').addEventListener('click', limpiarFormularioNC);
document.getElementById('btnExportarNC').addEventListener('click', exportarNoConformesExcel);

document.getElementById('cuerpoTablaNC').addEventListener('click', function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  if (!id) return;
  if (btn.classList.contains('btn-delete')) { eliminarNoConforme(id); }
  else if (btn.classList.contains('btn-edit')) { editarNoConforme(id); }
});

document.getElementById('modalCloseNC').addEventListener('click', closeModalImagen);
document.getElementById('modalImagenNC').addEventListener('click', function(e) { if (e.target === this) closeModalImagen(); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModalImagen(); });

initImagenNC();
initAccionSelect();
initMenuNoConformes();

async function initNoConformes() {
  const btnGuardar = document.getElementById('btnGuardarNC');
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.setAttribute('aria-busy', 'true');
  }

  try {
    await initSupabase();
    if (!isSupabaseEnabled()) {
      throw new Error('Supabase no está disponible');
    }
    await renderTablaNC();

    if (isSupabaseEnabled() && DB.onNoConformesChange) {
      DB.onNoConformesChange(async () => {
        await renderTablaNC();
      });
    }
  } catch (error) {
    console.error('Error inicializando No Conformes:', error);
    showToast('NO SE PUDO CONECTAR CON SUPABASE. NO SE GUARDARÁ EN LOCAL.', 'error');
  } finally {
    if (btnGuardar) {
      btnGuardar.disabled = !isSupabaseEnabled();
      btnGuardar.removeAttribute('aria-busy');
    }
  }
}

ncSupabaseReady = initNoConformes();
