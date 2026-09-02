const STORAGE_KEY = 'alistamiento_registros';
const JSON_PATH = 'Registros.json';

let editIndex = null;
let editRegistroId = null;
let editTipo = null;
let jsonRegistrosCache = [];
let productoSeleccionado = null;
let componentesEditadoManualmente = false;

function getTodayString() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function compressImage(file, maxWidth = 800, quality = 0.7) {
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
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
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

async function cargarRegistrosJSON() {
  try {
    if (isSupabaseEnabled()) {
      const productos = await DB.getProductos();
      if (Array.isArray(productos) && productos.length > 0) {
        return productos.map(p => ({
          producto: p.nombre,
          referencia: p.referencia,
          componentes: (p.producto_componentes || [])
            .filter(c => c.categoria === 'base' || c.categoria === 'pin')
            .map(c => ({ tipo: c.tipo, codigo: c.codigo, descripcion: c.descripcion })),
          componentes_adicionales: (p.producto_componentes || [])
            .filter(c => c.categoria === 'adicional')
            .map(c => ({ tipo: c.tipo, codigo: c.codigo, descripcion: c.descripcion, cantidad_por_base: c.cantidad_por_base })),
          kits: (p.producto_componentes || [])
            .filter(c => c.categoria === 'kit')
            .map(c => ({ tipo: c.tipo, codigo: c.codigo, cantidad_por_base: c.cantidad_por_base })),
          anti_vibrantes: (p.producto_componentes || [])
            .filter(c => c.categoria === 'anti_vibrante')
            .map(c => ({ tipo: c.tipo, codigo: c.codigo, descripcion: c.descripcion, cantidad_por_base: c.cantidad_por_base })),
        }));
      }
    }
    const response = await fetch(JSON_PATH + '?t=' + Date.now());
    if (!response.ok) return [];
    const json = await response.json();
    if (json && Array.isArray(json.materiales)) return json.materiales;
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.registros)) return json.registros;
    return [];
  } catch (e) {
    return [];
  }
}

async function getRegistros() {
  if (isSupabaseEnabled()) {
    return await DB.getRegistros();
  }
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const registros = data ? JSON.parse(data) : [];
    return agruparRegistrosLocal(registros);
  } catch (e) {
    console.error('Error al leer registros', e);
    return [];
  }
}

function agruparRegistrosLocal(registros) {
  const grupos = new Map();
  
  registros.forEach(r => {
    const gid = r.grupo_id || r.id;
    const isHeader = !r.componentes && !r.descripcion;
    
    if (!grupos.has(gid)) {
      grupos.set(gid, {
        grupo_id: gid,
        id: r.id,
        fecha: r.fecha,
        turno: r.turno,
        referencia: r.referencia,
        base: r.base,
        fomi: r.fomi,
        forro: r.forro,
        contabilizado: r.contabilizado,
        responsable: r.responsable,
        recibe: r.recibe,
        items: []
      });
    }
    
    const grupo = grupos.get(gid);
    
    if (isHeader) {
      grupo.id = r.id;
      grupo.fecha = r.fecha;
      grupo.turno = r.turno;
      grupo.referencia = r.referencia;
      grupo.base = r.base;
      grupo.fomi = r.fomi;
      grupo.forro = r.forro;
      grupo.contabilizado = r.contabilizado;
      grupo.responsable = r.responsable;
      grupo.recibe = r.recibe;
    } else {
      grupo.items.push({
        id: r.id,
        fecha: r.fecha,
        turno: r.turno,
        referencia: r.referencia,
        base: '',
        fomi: '',
        forro: '',
        componentes: r.componentes,
        descripcion: r.descripcion,
        contabilizado: r.contabilizado,
        responsable: r.responsable,
        recibe: r.recibe,
      });
    }
  });
  
  return Array.from(grupos.values());
}

async function saveRegistros(registros) {
  if (isSupabaseEnabled()) {
    // En Supabase, saveRegistros se usa solo para reemplazar todo
    // No es común, pero lo mantenemos por compatibilidad
    console.warn('saveRegistros masivo no implementado en Supabase');
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
}

function getFormData() {
  return {
    fecha: document.getElementById('fecha').value.trim() || new Date().toISOString().split('T')[0],
    turno: document.getElementById('turno').value,
    referencia: document.getElementById('referencia').value.trim(),
    base: document.getElementById('base').value.trim(),
    fomi: document.getElementById('fomi').value.trim(),
    componentes: document.getElementById('componentes').value.trim(),
    forro: document.getElementById('forro').value.trim(),
    contabilizado: document.getElementById('contabilizado').value,
    responsable: document.getElementById('responsable').value.trim(),
  };
}

function limpiarFormulario() {
  document.getElementById('fecha').value = '';
  document.getElementById('turno').value = '';
  document.getElementById('referencia').value = '';
  document.getElementById('base').value = '';
  document.getElementById('fomi').value = '';
  document.getElementById('componentes').value = '';
  document.getElementById('forro').value = '';
  document.getElementById('contabilizado').value = '';
  document.getElementById('responsable').value = '';
  editIndex = null;
  editRegistroId = null;
  editTipo = null;
  productoSeleccionado = null;
  componentesEditadoManualmente = false;
  document.getElementById('btnGuardar').textContent = 'GUARDAR REGISTRO';
  document.getElementById('btnGuardar').className = 'btn-primary';
  document.getElementById('btnCancelar').style.display = 'none';
  limpiarFirma();
}

async function renderTabla() {
  const registros = await getRegistros();
  const tbody = document.getElementById('cuerpoTabla');
  tbody.innerHTML = '';

  let totalRows = 0;

  if (registros.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="11" class="tabla-empty">Sin registros</td>';
    tbody.appendChild(tr);
    const countEl = document.getElementById('registroCount');
    if (countEl) countEl.textContent = 0;
    return;
  }

  registros.forEach((grupo, index) => {
    const items = grupo.items || [];
    const esGrupo = items.length > 0;
    
    totalRows++;
    const tr = document.createElement('tr');
    tr.className = esGrupo ? 'header-row' : '';
    tr.innerHTML = `
      <td>${escapeHtml(grupo.fecha)}</td>
      <td>${escapeHtml(grupo.turno)}</td>
      <td>${escapeHtml(grupo.referencia)}</td>
      <td>${escapeHtml(grupo.base)}</td>
      <td>${escapeHtml(grupo.fomi)}</td>
      <td>${esGrupo ? '<span style="color:var(--text-tertiary);font-style:italic;">Ver componentes ↓</span>' : escapeHtml(grupo.componentes || '').replace(/\n/g, '<br>')}</td>
      <td>${escapeHtml(grupo.forro)}</td>
      <td>${grupo.recibe ? `<img src="${grupo.recibe}" class="registro-firma-img" alt="Firma">` : '<span style="color:var(--text-tertiary);font-size:0.8125rem;">— Sin firma</span>'}</td>
      <td>${escapeHtml(grupo.contabilizado)}</td>
      <td>${escapeHtml(grupo.responsable)}</td>
      <td>
        <button class="btn-edit" data-id="${grupo.id}" data-tipo="header" title="Editar registro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Editar
        </button>
        <button class="btn-delete" data-id="${grupo.grupo_id || grupo.id}" data-tipo="header" title="Eliminar registro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);

    if (esGrupo) {
      items.forEach(item => {
        totalRows++;
        const itemTr = document.createElement('tr');
        itemTr.className = 'item-row';
        itemTr.innerHTML = `
          <td>${escapeHtml(item.fecha || grupo.fecha || '')}</td>
          <td>${escapeHtml(item.turno || grupo.turno || '')}</td>
          <td>${escapeHtml(item.referencia)}</td>
          <td></td>
          <td></td>
          <td>${escapeHtml(item.componentes || '').replace(/\n/g, '<br>')}</td>
          <td></td>
          <td>${item.recibe ? `<img src="${item.recibe}" class="registro-firma-img" alt="Firma">` : (grupo.recibe ? `<img src="${grupo.recibe}" class="registro-firma-img" alt="Firma">` : '<span style="color:var(--text-tertiary);font-size:0.8125rem;">— Sin firma</span>')}</td>
          <td>${escapeHtml(item.contabilizado || grupo.contabilizado || '')}</td>
          <td>${escapeHtml(item.responsable || grupo.responsable || '')}</td>
          <td>
            <button class="btn-edit" data-id="${item.id}" data-tipo="item" title="Editar componente">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Editar
            </button>
            <button class="btn-delete" data-id="${item.id}" data-tipo="item" title="Eliminar componente">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Eliminar
            </button>
          </td>
        `;
        tbody.appendChild(itemTr);
      });
    }
  });

  const countEl = document.getElementById('registroCount');
  if (countEl) {
    countEl.textContent = totalRows;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function actualizarDatalistReferencias() {
  const datalist = document.getElementById('listaReferencias');
  if (!datalist) return;
  datalist.innerHTML = '';

  const productos = await cargarRegistrosJSON();
  const refs = new Set();

  if (Array.isArray(productos)) {
    productos.forEach(p => {
      const ref = p.referencia || p.producto;
      if (ref) refs.add(ref.toUpperCase());
    });
  }

  const refsArray = Array.from(refs).sort((a, b) => a.localeCompare(b));

  refsArray.forEach(ref => {
    const option = document.createElement('option');
    option.value = ref;
    datalist.appendChild(option);
  });
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message.toUpperCase();
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2500);
}

function initReferenciaDropdown() {
  const input = document.getElementById('referencia');
  const dropdown = document.getElementById('referenciaDropdown');
  if (!input || !dropdown) return;

  async function actualizarOpciones() {
    const valor = input.value.trim().toLowerCase();
    const locales = await getRegistros();
    const remotos = await cargarRegistrosJSON();
    const todos = [...locales, ...remotos];

    const filtrados = todos.filter(r => {
      if (!r.referencia && !r.producto) return false;
      const nombre = (r.referencia || r.producto || '').toLowerCase();
      if (!valor) return true;
      return nombre.includes(valor);
    });

    const unicos = new Map();
    filtrados.forEach(r => {
      const clave = r.producto || r.referencia;
      if (!unicos.has(clave)) {
        unicos.set(clave, r);
      }
    });

    const resultados = Array.from(unicos.values());
    dropdown.innerHTML = '';

    if (resultados.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    resultados.forEach(r => {
      const item = document.createElement('div');
      item.className = 'referencia-item';
      const nombre = r.producto || r.referencia;

      const componentesList = [];
      if (Array.isArray(r.componentes)) {
        r.componentes.forEach(c => {
          const codigo = c.codigo || '';
          const tipo = c.tipo || '';
          if (tipo && codigo) componentesList.push(`${tipo}: ${codigo}`);
          else if (codigo) componentesList.push(codigo);
        });
      }
      if (Array.isArray(r.componentes_adicionales)) {
        r.componentes_adicionales.forEach(c => {
          const codigo = c.codigo || '';
          const tipo = c.tipo || '';
          const qty = c.cantidad_por_base || c.cantidad || 1;
          if (tipo && codigo) componentesList.push(`${tipo}: ${codigo} (x${qty})`);
          else if (codigo) componentesList.push(`${codigo} (x${qty})`);
        });
      }

      const refMeta = componentesList.length
        ? `<span class="ref-meta">${escapeHtml(componentesList.join(', '))}</span>`
        : '<span class="ref-meta">Sin componentes</span>';

      item.innerHTML = `
        <span class="ref-code">${escapeHtml(nombre.toUpperCase())}</span>
        ${refMeta}
      `;

      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = nombre.toUpperCase();
        dropdown.style.display = 'none';
        autocompletarFormulario(r);
      });
      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
  }

  input.addEventListener('input', actualizarOpciones);
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 0) {
      actualizarOpciones();
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) {
      dropdown.style.display = 'none';
    }
  });
}

function autocompletarFormulario(producto) {
  productoSeleccionado = producto;
  componentesEditadoManualmente = false;
  const ref = (producto.referencia || producto.producto || '').toUpperCase();
  document.getElementById('referencia').value = ref;
  if (producto.base) document.getElementById('base').value = producto.base;
  if (producto.fomi) document.getElementById('fomi').value = producto.fomi;
  if (producto.forro) document.getElementById('forro').value = producto.forro;
}

function multiplicarComponentes() {
  if (!productoSeleccionado) return;
  if (componentesEditadoManualmente) return;

  const baseInput = document.getElementById('base');
  const componentesInput = document.getElementById('componentes');
  if (!baseInput || !componentesInput) return;

  const cantidadBase = parseInt(baseInput.value, 10);
  if (isNaN(cantidadBase) || cantidadBase <= 0) return;

  const adicionales = [
    ...(productoSeleccionado.componentes_adicionales || []),
    ...(productoSeleccionado.kits || []),
    ...(productoSeleccionado.anti_vibrantes || []),
  ];

  const componentesBase = Array.isArray(productoSeleccionado.componentes) ? productoSeleccionado.componentes : [];
  const pins = componentesBase.filter(c => {
    const tipo = (c.tipo || '').toLowerCase();
    return tipo.includes('pin');
  }).map(c => ({
    ...c,
    cantidad_por_base: c.cantidad_por_base || c.cantidad || 1
  }));
  adicionales.push(...pins);

  if (adicionales.length === 0) return;

  const lineas = adicionales.map(c => {
    const cantidad = (c.cantidad_por_base || c.cantidad || 0) * cantidadBase;
    const codigo = c.codigo || '';
    if (cantidad > 0 && codigo) return `${codigo} ${cantidad}`;
    return '';
  }).filter(v => v);

  componentesInput.value = lineas.join('\n');
}

function initMultiplicadorComponentes() {
  const baseInput = document.getElementById('base');
  const referenciaInput = document.getElementById('referencia');

  if (!baseInput || !referenciaInput) return;

  const componentesInput = document.getElementById('componentes');
  if (componentesInput) {
    componentesInput.addEventListener('input', () => {
      componentesEditadoManualmente = true;
    });
  }

  baseInput.addEventListener('input', multiplicarComponentes);

  referenciaInput.addEventListener('change', async () => {
    const valor = referenciaInput.value.trim();
    if (!valor) {
      productoSeleccionado = null;
      return;
    }

    const locales = await getRegistros();
    const remotos = await cargarRegistrosJSON();
    const todos = [...locales, ...remotos];

    const filtrados = todos.filter(r => {
      if (!r.referencia && !r.producto) return false;
      const nombre = (r.referencia || r.producto || '').toLowerCase();
      return nombre === valor.toLowerCase();
    });

    const unicos = new Map();
    filtrados.forEach(r => {
      const clave = r.referencia || r.producto;
      if (!unicos.has(clave)) {
        unicos.set(clave, r);
      }
    });

    const productos = Array.from(unicos.values());
    if (productos.length > 0) {
      productoSeleccionado = productos[0];
      multiplicarComponentes();
    }
  });
}

function initFirma() {
  const canvas = document.getElementById('firmaRecibe');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0f172a';

  let drawing = false;
  let lastPos = null;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function startDraw(e) {
    drawing = true;
    const pos = getPos(e);
    lastPos = { x: pos.x, y: pos.y };
    ctx.beginPath();
    canvas.classList.add('drawing');
    e.preventDefault();
  }

  function draw(e) {
    if (!drawing || !lastPos) return;
    const pos = getPos(e);
    const dx = pos.x - lastPos.x;
    const dy = pos.y - lastPos.y;
    if (Math.sqrt(dx * dx + dy * dy) < 5) {
      e.preventDefault();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos = { x: pos.x, y: pos.y };
    e.preventDefault();
  }

  function stopDraw() {
    drawing = false;
    lastPos = null;
    canvas.classList.remove('drawing');
    checkFirmaContent();
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw);
  canvas.addEventListener('touchcancel', stopDraw);

  const firmaCard = document.getElementById('firmaCard');
  const firmaWrap = document.getElementById('firmaWrap');
  let expanded = false;

  function toggleFirmaActiva(hasContent) {
    if (firmaCard) {
      if (hasContent) {
        firmaCard.classList.add('activa');
      } else {
        firmaCard.classList.remove('activa');
      }
    }
  }

  function checkFirmaContent() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let hasContent = false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
        hasContent = true;
        break;
      }
    }
    toggleFirmaActiva(hasContent);
  }

  function expandirFirma() {
    if (expanded) return;
    expanded = true;
    if (firmaWrap) firmaWrap.classList.add('expandido');
  }

  function contraerFirma() {
    if (!expanded) return;
    expanded = false;
    if (firmaWrap) firmaWrap.classList.remove('expandido');
  }

  const btnConfirmarFirma = document.getElementById('btnConfirmarFirma');
  if (btnConfirmarFirma) {
    btnConfirmarFirma.addEventListener('click', () => {
      contraerFirma();
      showToast('FIRMA CONFIRMADA', 'success');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expanded) {
      contraerFirma();
    }
  });
}

function limpiarFirma() {
  const canvas = document.getElementById('firmaRecibe');
  if (!canvas) return;
  canvas.classList.add('clearing');
  setTimeout(() => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.remove('clearing');
    const card = document.getElementById('firmaCard');
    if (card) card.classList.remove('activa');
    document.getElementById('recibe').value = '';
    showToast('Firma limpiada', 'info');
  }, 150);
}

function getFirmaDataUrl() {
  const canvas = document.getElementById('firmaRecibe');
  if (!canvas) return '';
  return canvas.toDataURL('image/png');
}

async function obtenerProductoReferencia(referencia) {
  const remotos = await cargarRegistrosJSON();
  const valor = (referencia || '').trim().toLowerCase();
  if (!valor) return null;

  let producto = remotos.find(r => {
    const nombre = (r.referencia || r.producto || '').toLowerCase();
    return nombre === valor;
  });

  if (!producto) {
    producto = remotos.find(r => {
      const nombre = (r.referencia || r.producto || '').toLowerCase();
      return nombre.includes(valor);
    });
  }

  return producto || null;
}

function multiplicarComponentesGlobal(producto, cantidadBase) {
  const componentesBase = Array.isArray(producto.componentes) ? producto.componentes : [];
  const adicionales = [
    ...(producto.componentes_adicionales || []),
    ...(producto.kits || []),
    ...(producto.anti_vibrantes || []),
    ...(componentesBase.filter(c => {
      const tipo = (c.tipo || '').toLowerCase();
      return tipo.includes('pin');
    }).map(c => ({
      ...c,
      cantidad_por_base: c.cantidad_por_base || c.cantidad || 1
    }))),
  ];

  return adicionales.map(c => {
    const codigo = c.codigo || '';
    const cantidad = (c.cantidad_por_base || c.cantidad || 0) * cantidadBase;
    return `${codigo} ${cantidad}`;
  }).join('\n');
}

async function agregarRegistro(e) {
  e.preventDefault();
  const data = getFormData();
  const firma = getFirmaDataUrl();

  const cantidadBase = parseInt(data.base, 10);
  const producto = await obtenerProductoReferencia(data.referencia);

  const grupoId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  if (!data.fecha) {
    data.fecha = new Date().toISOString().split('T')[0];
  }

  if (producto) {
    const componentesBase = producto.componentes || [];
    const baseEncontrada = componentesBase.find(c => (c.tipo || '').toLowerCase() === 'base');
    const cantidadBaseValor = parseInt(data.base, 10);
    const multiplicadorBase = (!isNaN(cantidadBaseValor) && cantidadBaseValor > 0) ? cantidadBaseValor : 1;

    const adicionales = [
      ...(producto.componentes_adicionales || []),
      ...(producto.kits || []),
      ...(producto.anti_vibrantes || []),
      ...(componentesBase.filter(c => {
        const t = (c.tipo || '').toLowerCase();
        return t.includes('pin');
      }).map(c => {
        return {
          ...c,
          cantidad_por_base: c.cantidad_por_base || c.cantidad || 1
        };
      })),
    ];

    if (isSupabaseEnabled()) {
      const header = {
        grupo_id: grupoId,
        fecha: data.fecha,
        turno: data.turno,
        referencia: data.referencia,
        base: data.base || '',
        forro: data.forro || '',
        componentes: '',
        descripcion: '',
        fomi: data.fomi,
        contabilizado: data.contabilizado,
        responsable: data.responsable,
        recibe: firma,
      };
      await DB.saveRegistro(header);

      for (const c of adicionales) {
        const cantidad = (c.cantidad_por_base || c.cantidad || 1) * multiplicadorBase;
        const codigo = c.codigo || '';
        const tipo = c.tipo || '';
        if (codigo && cantidad > 0) {
          await DB.saveRegistro({
            grupo_id: grupoId,
            fecha: data.fecha,
            turno: data.turno,
            referencia: codigo,
            base: '',
            forro: '',
            componentes: String(cantidad),
            descripcion: tipo,
            fomi: '',
            contabilizado: data.contabilizado,
            responsable: data.responsable,
            recibe: firma,
          });
        }
      }
    } else {
      const registros = await getRegistros();
      if (baseEncontrada || adicionales.length > 0) {
        const headerId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        registros.push({
          id: headerId,
          grupo_id: grupoId,
          fecha: data.fecha,
          turno: data.turno,
          referencia: data.referencia,
          base: data.base || '',
          forro: data.forro || '',
          componentes: '',
          descripcion: '',
          fomi: data.fomi,
          contabilizado: data.contabilizado,
          responsable: data.responsable,
          recibe: firma,
        });

        adicionales.forEach(c => {
          const cantidad = (c.cantidad_por_base || c.cantidad || 1) * multiplicadorBase;
          const codigo = c.codigo || '';
          const tipo = c.tipo || '';
          if (codigo && cantidad > 0) {
            registros.push({
              id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              grupo_id: grupoId,
              fecha: data.fecha,
              turno: data.turno,
              referencia: codigo,
              base: '',
              forro: '',
              componentes: String(cantidad),
              descripcion: tipo,
              fomi: '',
              contabilizado: data.contabilizado,
              responsable: data.responsable,
              recibe: firma,
            });
          }
        });
      } else {
        const fallbackId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        registros.push({
          id: fallbackId,
          grupo_id: grupoId,
          ...data,
          recibe: firma,
        });
      }
      await saveRegistros(registros);
    }
  } else {
    if (isSupabaseEnabled()) {
      await DB.saveRegistro({
        grupo_id: grupoId,
        fecha: data.fecha,
        turno: data.turno,
        referencia: data.referencia,
        base: data.base,
        fomi: data.fomi,
        componentes: data.componentes,
        forro: data.forro,
        contabilizado: data.contabilizado,
        responsable: data.responsable,
        descripcion: '',
        recibe: firma,
      });
    } else {
      const registros = await getRegistros();
      registros.push({
        ...data,
        recibe: firma,
      });
      await saveRegistros(registros);
    }
  }

  limpiarFormulario();
  renderTabla();
  actualizarDatalistReferencias();
  showToast('REGISTRO GUARDADO CORRECTAMENTE', 'success');
}

async function editarRegistroPorId(id, tipo) {
  let registro;

  if (tipo === 'header') {
    const registros = await getRegistros();
    const grupo = registros.find(g => g.grupo_id === id || g.id === id);
    if (!grupo) return;
    registro = grupo;
  } else if (tipo === 'item') {
    if (isSupabaseEnabled()) {
      const { data, error } = await supabaseClient
        .from('registros')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Error obteniendo item:', error);
        showToast('ERROR AL CARGAR EL REGISTRO', 'error');
        return;
      }
      registro = data;
    } else {
      const registros = await getRegistros();
      for (const grupo of registros) {
        const item = (grupo.items || []).find(i => i.id === id);
        if (item) {
          registro = { ...grupo, ...item };
          break;
        }
      }
    }
  }

  if (!registro) return;

  document.getElementById('fecha').value = registro.fecha || '';
  document.getElementById('turno').value = registro.turno || '';
  document.getElementById('referencia').value = registro.referencia || '';
  document.getElementById('componentes').value = registro.componentes || '';
  document.getElementById('contabilizado').value = registro.contabilizado !== undefined && registro.contabilizado !== null ? registro.contabilizado : '';
  document.getElementById('responsable').value = registro.responsable || '';

  if (tipo === 'header') {
    document.getElementById('base').value = registro.base || '';
    document.getElementById('fomi').value = registro.fomi || '';
    document.getElementById('forro').value = registro.forro || '';
  } else {
    document.getElementById('base').value = '';
    document.getElementById('fomi').value = '';
    document.getElementById('forro').value = '';
  }

  if (registro.recibe) {
    cargarFirmaEnCanvas(registro.recibe);
  } else {
    limpiarFirma();
  }

  editIndex = null;
  editRegistroId = id;
  editTipo = tipo;
  componentesEditadoManualmente = true;
  productoSeleccionado = null;
  document.getElementById('btnGuardar').textContent = 'ACTUALIZAR';
  document.getElementById('btnGuardar').className = 'btn-update';
  document.getElementById('btnCancelar').style.display = 'inline-block';
}

function cargarFirmaEnCanvas(dataUrl) {
  const canvas = document.getElementById('firmaRecibe');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const card = document.getElementById('firmaCard');
    if (card) card.classList.add('activa');
  };
  img.src = dataUrl;
}

async function actualizarRegistro(e) {
  e.preventDefault();
  if (!editRegistroId) return;

  const data = getFormData();
  const firma = getFirmaDataUrl();

  const cantidadBase = parseInt(data.base, 10);
  const producto = await obtenerProductoReferencia(data.referencia);

  let componentesFinal = data.componentes;
  if (producto && !isNaN(cantidadBase) && cantidadBase > 0 && !componentesEditadoManualmente) {
    componentesFinal = multiplicarComponentesGlobal(producto, cantidadBase);
  }

  if (isSupabaseEnabled() && editRegistroId) {
    if (editTipo === 'header') {
      const headerUpdates = {
        fecha: data.fecha,
        turno: data.turno,
        referencia: data.referencia,
        base: data.base,
        fomi: data.fomi,
        forro: data.forro,
        contabilizado: data.contabilizado,
        responsable: data.responsable,
        recibe: firma,
      };
      const { error } = await supabaseClient
        .from('registros')
        .update(headerUpdates)
        .eq('id', editRegistroId);
      if (error) {
        console.error('Error actualizando header:', error);
        showToast('ERROR AL ACTUALIZAR', 'error');
        return;
      }
    } else {
      const itemUpdates = {
        fecha: data.fecha,
        turno: data.turno,
        referencia: data.referencia,
        componentes: componentesFinal,
        contabilizado: data.contabilizado,
        responsable: data.responsable,
        recibe: firma,
      };
      await DB.updateRegistro(editRegistroId, itemUpdates);
    }
  } else if (!isSupabaseEnabled()) {
    const registros = await getRegistros();
    if (editTipo === 'header') {
      const grupo = registros.find(g => g.grupo_id === editRegistroId || g.id === editRegistroId);
      if (grupo) {
        grupo.fecha = data.fecha;
        grupo.turno = data.turno;
        grupo.referencia = data.referencia;
        grupo.base = data.base;
        grupo.fomi = data.fomi;
        grupo.forro = data.forro;
        grupo.contabilizado = data.contabilizado;
        grupo.responsable = data.responsable;
        grupo.recibe = firma;
      }
    } else if (editTipo === 'item') {
      for (const grupo of registros) {
        const item = (grupo.items || []).find(i => i.id === editRegistroId);
        if (item) {
          item.fecha = data.fecha;
          item.turno = data.turno;
          item.referencia = data.referencia;
          item.componentes = componentesFinal;
          item.contabilizado = data.contabilizado;
          item.responsable = data.responsable;
          item.recibe = firma;
          break;
        }
      }
    }
    const flatList = [];
    registros.forEach(grupo => {
      flatList.push({
        id: grupo.id,
        grupo_id: grupo.grupo_id,
        fecha: grupo.fecha,
        turno: grupo.turno,
        referencia: grupo.referencia,
        base: grupo.base,
        fomi: grupo.fomi,
        forro: grupo.forro,
        componentes: grupo.componentes,
        contabilizado: grupo.contabilizado,
        responsable: grupo.responsable,
        recibe: grupo.recibe,
      });
      (grupo.items || []).forEach(item => {
        flatList.push({
          id: item.id,
          grupo_id: grupo.grupo_id,
          fecha: item.fecha || grupo.fecha,
          turno: item.turno || grupo.turno,
          referencia: item.referencia,
          base: '',
          fomi: '',
          forro: '',
          componentes: item.componentes,
          descripcion: item.descripcion,
          contabilizado: item.contabilizado || '',
          responsable: item.responsable || '',
          recibe: item.recibe || grupo.recibe,
        });
      });
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flatList));
  }

  limpiarFormulario();
  await renderTabla();
  actualizarDatalistReferencias();
  showToast('REGISTRO ACTUALIZADO CORRECTAMENTE', 'success');
}

async function eliminarRegistro(id, tipo) {
  if (!confirm('¿Deseas eliminar este registro?')) {
    return;
  }

  if (isSupabaseEnabled()) {
    if (tipo === 'header') {
      await DB.deleteGrupo(id);
    } else {
      await DB.deleteRegistro(id);
    }
  } else {
    const registros = await getRegistros();
    
    if (tipo === 'header') {
      const index = registros.findIndex(g => g.grupo_id === id || g.id === id);
      if (index !== -1) {
        registros.splice(index, 1);
      }
    } else {
      let encontrado = false;
      for (const grupo of registros) {
        const itemIndex = (grupo.items || []).findIndex(i => i.id === id);
        if (itemIndex !== -1) {
          grupo.items.splice(itemIndex, 1);
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        const index = registros.findIndex(g => g.id === id);
        if (index !== -1) {
          registros.splice(index, 1);
        }
      }
    }
    
    const flatList = [];
    registros.forEach(grupo => {
      flatList.push({
        id: grupo.id,
        grupo_id: grupo.grupo_id,
        fecha: grupo.fecha,
        turno: grupo.turno,
        referencia: grupo.referencia,
        base: grupo.base,
        fomi: grupo.fomi,
        forro: grupo.forro,
        componentes: grupo.componentes,
        contabilizado: grupo.contabilizado,
        responsable: grupo.responsable,
        recibe: grupo.recibe,
      });
      (grupo.items || []).forEach(item => {
        flatList.push({
          id: item.id,
          grupo_id: grupo.grupo_id,
          fecha: item.fecha || grupo.fecha,
          turno: item.turno || grupo.turno,
          referencia: item.referencia,
          base: '',
          fomi: '',
          forro: '',
          componentes: item.componentes,
          descripcion: item.descripcion,
          contabilizado: item.contabilizado || '',
          responsable: item.responsable || '',
          recibe: item.recibe || grupo.recibe,
        });
      });
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flatList));
  }

  await renderTabla();
  actualizarDatalistReferencias();
  showToast('REGISTRO ELIMINADO', 'info');
}



document.getElementById('formAlistamiento').addEventListener('submit', function(e) {
  if (editRegistroId) {
    actualizarRegistro(e);
  } else {
    agregarRegistro(e);
  }
});
document.getElementById('btnLimpiar').addEventListener('click', function(e) {
  e.preventDefault();
  e.stopPropagation();
  limpiarFormulario();
});
document.getElementById('btnCancelar').addEventListener('click', limpiarFormulario);
document.getElementById('btnLimpiarFirma').addEventListener('click', limpiarFirma);

document.getElementById('cuerpoTabla').addEventListener('click', function (e) {
  const btn = e.target.closest('button');
  if (!btn) return;

  const id = btn.getAttribute('data-id');
  const tipo = btn.getAttribute('data-tipo');

  if (!id) return;

  if (btn.classList.contains('btn-delete')) {
    eliminarRegistro(id, tipo);
  } else if (btn.classList.contains('btn-edit')) {
    editarRegistroPorId(id, tipo);
  }
});

function formatearFechaEspanol(fecha) {
  const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return fecha.toLocaleDateString('es-CO', opciones).toUpperCase();
}

function autoAsignarTurno() {
  const ahora = new Date();
  const dia = ahora.getDay();
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  let turno = '';

  if (dia === 6) {
    if (minutos >= 6 * 60 && minutos < 10 * 60 + 30) turno = '1';
    else if (minutos >= 10 * 60 + 30 && minutos < 15 * 60) turno = '2';
  } else {
    if (minutos >= 6 * 60 && minutos < 14 * 60) turno = '1';
    else if (minutos >= 14 * 60 && minutos < 22 * 60) turno = '2';
  }

  if (turno) {
    document.getElementById('turno').value = turno;
  }
}

function initBoard() {
  const btnAdicionar = document.getElementById('btnAdicionarFoto');
  const inputFoto = document.getElementById('inputFotoBoard');
  const grid = document.getElementById('tableroGrid');
  const btnTomarFoto = document.getElementById('btnTomarFoto');
  const inputFotoCamara = document.getElementById('inputFotoCamara');

  if (!btnAdicionar || !inputFoto || !grid || !btnTomarFoto || !inputFotoCamara) return;

  function getFotos() {
    try {
      const data = localStorage.getItem('board_fotos');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFotos(fotos) {
    localStorage.setItem('board_fotos', JSON.stringify(fotos));
  }

  function renderTablero() {
    const fotos = getFotos();
    grid.innerHTML = '';

    if (fotos.length === 0) {
      grid.innerHTML = '<div class="board-empty">No hay fotos en el tablero. Pulsa "Adicionar Foto" para agregar una imagen.</div>';
      return;
    }

    fotos.forEach((foto, index) => {
      const card = document.createElement('div');
      card.className = 'foto-card';

      const img = document.createElement('img');
      img.src = foto.src;
      img.alt = `Foto ${index + 1}`;

      const actions = document.createElement('div');
      actions.className = 'foto-actions';

      const btnUpdate = document.createElement('button');
      btnUpdate.className = 'btn-foto btn-foto-update';
      btnUpdate.textContent = 'ACTUALIZAR';
      btnUpdate.addEventListener('click', (e) => {
        e.stopPropagation();
        const newInput = document.createElement('input');
        newInput.type = 'file';
        newInput.accept = 'image/*';
        newInput.style.display = 'none';
        document.body.appendChild(newInput);

        newInput.addEventListener('change', (ev) => {
          const file = ev.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
            const nuevasFotos = getFotos();
            nuevasFotos[index].src = event.target.result;
            saveFotos(nuevasFotos);
            renderTablero();
            showToast('FOTO ACTUALIZADA CORRECTAMENTE', 'success');
          };
          reader.readAsDataURL(file);
          document.body.removeChild(newInput);
        });

        newInput.click();
      });

      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-foto btn-foto-delete';
      btnDelete.textContent = 'ELIMINAR';
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('¿Deseas eliminar esta foto?')) return;
        const nuevasFotos = getFotos();
        nuevasFotos.splice(index, 1);
        saveFotos(nuevasFotos);
        renderTablero();
        showToast('FOTO ELIMINADA', 'info');
      });

      actions.appendChild(btnUpdate);
      actions.appendChild(btnDelete);
      card.appendChild(img);
      card.appendChild(actions);

      card.addEventListener('click', () => {
        card.classList.toggle('show-actions');
      });

      grid.appendChild(card);
    });
  }

  btnAdicionar.addEventListener('click', () => {
    inputFoto.click();
  });

  if (btnTomarFoto && inputFotoCamara) {
    btnTomarFoto.addEventListener('click', () => {
      inputFotoCamara.click();
    });

    inputFotoCamara.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      compressImage(file, 800, 0.7).then((compressedDataUrl) => {
        const fotos = getFotos();
        fotos.push({ src: compressedDataUrl });
        saveFotos(fotos);
        renderTablero();
        showToast('FOTO TOMADA CORRECTAMENTE', 'success');
      }).catch((error) => {
        console.error('Error al procesar foto de camara:', error);
        showToast('ERROR AL PROCESAR LA IMAGEN', 'error');
      });
      inputFotoCamara.value = '';
    });
  }

  inputFoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    compressImage(file, 800, 0.7).then((compressedDataUrl) => {
      const fotos = getFotos();
      fotos.push({ src: compressedDataUrl });
      saveFotos(fotos);
      renderTablero();
      showToast('FOTO AGREGADA AL TABLERO', 'success');
    }).catch((error) => {
      console.error('Error al procesar imagen del tablero:', error);
      showToast('ERROR AL PROCESAR LA IMAGEN', 'error');
    });
    inputFoto.value = '';
  });

  renderTablero();
}

function initMenu() {
  const btnMenu = document.getElementById('btnMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  const btnCerrarMenu = document.getElementById('btnCerrarMenu');
  const menuInicio = document.getElementById('menuInicio');
  const menuTrazabilidad = document.getElementById('menuTrazabilidad');
  const menuAdmin = document.getElementById('menuAdmin');
  const seccionTrazabilidad = document.getElementById('seccionTrazabilidad');
  const seccionAdmin = document.getElementById('seccionAdmin');
  const btnVolverInicio = document.getElementById('btnVolverInicio');
  const btnVolverInicioAdmin = document.getElementById('btnVolverInicioAdmin');

  const inicioSection = document.getElementById('inicio');

  function mostrarSeccion(seccion) {
    if (!inicioSection || !seccionTrazabilidad || !seccionAdmin) return;
    inicioSection.style.display = 'none';
    const boardBanner = document.querySelector('.board-banner');
    if (boardBanner) boardBanner.style.display = 'none';
    seccionTrazabilidad.style.display = 'none';
    seccionAdmin.style.display = 'none';

    if (seccion === 'inicio') {
      inicioSection.style.display = 'block';
      if (boardBanner) boardBanner.style.display = 'flex';
    } else if (seccion === 'trazabilidad') {
      seccionTrazabilidad.style.display = 'block';
      const tzFecha = document.getElementById('tz_fecha');
      if (tzFecha) tzFecha.value = getTodayString();
    } else if (seccion === 'admin') {
      seccionAdmin.style.display = 'block';
      renderAdmin();
    }
  }

  function abrirMenu() {
    if (menuOverlay) menuOverlay.classList.add('open');
  }

  function cerrarMenu() {
    if (menuOverlay) menuOverlay.classList.remove('open');
  }

  if (btnMenu) btnMenu.addEventListener('click', abrirMenu);
  if (btnCerrarMenu) btnCerrarMenu.addEventListener('click', cerrarMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', (e) => { if (e.target === menuOverlay) cerrarMenu(); });

  if (menuInicio) {
    menuInicio.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarMenu();
      mostrarSeccion('inicio');
    });
  }

  if (menuTrazabilidad) {
    menuTrazabilidad.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarMenu();
      mostrarSeccion('trazabilidad');
    });
  }

  if (menuAdmin) {
    menuAdmin.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarMenu();
      mostrarSeccion('admin');
    });
  }

  if (btnVolverInicioAdmin) {
    btnVolverInicioAdmin.addEventListener('click', () => mostrarSeccion('inicio'));
  }
}

async function getTrazabilidad() {
  if (isSupabaseEnabled()) {
    const registros = await DB.getTrazabilidad();
    if (Array.isArray(registros) && registros.length > 0) {
      return registros;
    }
  }
  try {
    const data = localStorage.getItem('trazabilidad_registros');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
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
    tr.innerHTML = `
      <td>${escapeHtml(registro.fecha || '')}</td>
      <td>${escapeHtml(registro.referencia || '')}</td>
      <td>${escapeHtml(registro.ckd || '')}</td>
      <td>${escapeHtml(registro.responsable || '')}</td>
      <td>${escapeHtml(registro.cantidad || '')}</td>
      <td>${registro.foto ? `<img src="${registro.foto}" style="height:32px;vertical-align:middle;border-radius:4px;background:#f9fafb;padding:2px;" onerror="this.style.display='none'">` : ''}</td>
      <td>${escapeHtml(registro.novedades || '')}</td>
      <td>
        <button class="btn-delete" data-index="${index}" data-id="${registro.id || ''}" title="Eliminar registro">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
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
  const registros = await getTrazabilidad();
  grid.innerHTML = '';

  if (registros.length === 0) {
    grid.innerHTML = '<div class="admin-empty">Sin registros</div>';
    return;
  }

  registros.forEach((registro, index) => {
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.innerHTML = `
      <div class="admin-card-header">
        <div>
          <div class="admin-card-title">${escapeHtml(registro.referencia || '')}</div>
          <div class="admin-card-meta">${escapeHtml(registro.fecha || '')} - ${escapeHtml(registro.responsable || '')}</div>
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

function initTrazabilidadForm() {
  const tz_foto = document.getElementById('tz_foto');
  const tz_foto_camara = document.getElementById('tz_foto_camara');
  const tz_preview = document.getElementById('tz_preview');
  const btnTomar = document.getElementById('btnTomarFotoTz');
  const btnAdjuntar = document.getElementById('btnAdjuntarFotoTz');
  let tzFotoDataUrl = null;

  function procesarArchivoTz(file) {
    if (!file) return;
    compressImage(file, 800, 0.7).then((compressedDataUrl) => {
      tzFotoDataUrl = compressedDataUrl;
      if (tz_preview) {
        tz_preview.src = compressedDataUrl;
        tz_preview.style.display = 'block';
      }
    }).catch((error) => {
      console.error('Error al procesar imagen de trazabilidad:', error);
      showToast('ERROR AL PROCESAR LA IMAGEN', 'error');
    });
  }

  if (btnTomar && tz_foto_camara) {
    btnTomar.addEventListener('click', () => {
      tz_foto_camara.click();
    });
  }

  if (btnAdjuntar && tz_foto) {
    btnAdjuntar.addEventListener('click', () => {
      tz_foto.click();
    });
  }

  if (tz_foto && tz_preview) {
    tz_foto.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      procesarArchivoTz(file);
    });
  }

  if (tz_foto_camara && tz_preview) {
    tz_foto_camara.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      procesarArchivoTz(file);
    });
  }

  const formTrazabilidad = document.getElementById('formTrazabilidad');
  if (!formTrazabilidad) {
    console.log('formTrazabilidad not found');
    return;
  }

  formTrazabilidad.addEventListener('submit', async (e) => {
    try {
      console.log('Form trazabilidad submit');
      e.preventDefault();
      const fecha = document.getElementById('tz_fecha').value.trim();
      const referencia = document.getElementById('tz_referencia').value.trim();
      const ckd = document.getElementById('tz_ckd').value.trim();
      const responsable = document.getElementById('tz_responsable').value.trim();
      const cantidad = document.getElementById('tz_cantidad').value.trim();
      const novedades = document.getElementById('tz_novedades').value.trim();

      console.log('Form values:', { fecha, referencia, ckd, responsable, cantidad, novedades, foto: tzFotoDataUrl ? 'si' : 'no' });

      if (!fecha || !referencia || !ckd || !responsable || !tzFotoDataUrl) {
        showToast('COMPLETA FECHA, REFERENCIA, CKD, RESPONSABLE Y FOTO', 'error');
        return;
      }

      const registros = await getTrazabilidad();
      
      const nuevoRegistro = {
        fecha,
        referencia,
        ckd,
        responsable,
        cantidad: cantidad || '',
        novedades: novedades || '',
        foto: tzFotoDataUrl
      };

      if (isSupabaseEnabled()) {
        try {
          await DB.saveTrazabilidad(nuevoRegistro);
        } catch (error) {
          console.error('Error guardando trazabilidad en Supabase:', error);
          showToast('ERROR AL GUARDAR TRAZABILIDAD', 'error');
          return;
        }
      } else {
        registros.push(nuevoRegistro);
        try {
          saveTrazabilidad(registros);
        } catch (e) {
          if (e.name === 'QuotaExceededError') {
            showToast('ALMACENAMIENTO LLENO. ELIMINA REGISTROS ANTIGUOS.', 'error');
            return;
          }
          throw e;
        }
      }
      formTrazabilidad.reset();
      tzFotoDataUrl = null;
      if (tz_preview) {
        tz_preview.style.display = 'none';
        tz_preview.src = '';
      }
      const tzFecha = document.getElementById('tz_fecha');
      if (tzFecha) tzFecha.value = getTodayString();
      showToast('TRAZABILIDAD GUARDADA CORRECTAMENTE', 'success');
    } catch (error) {
      console.error('Error al enviar trazabilidad:', error);
      showToast('ERROR AL ENVIAR TRAZABILIDAD', 'error');
    }
  });

  console.log('submit listener attached to formTrazabilidad');
}

async function init() {
  autoAsignarTurno();

  if (typeof initSupabase === 'function') {
    await initSupabase();
  }

  const boardFecha = document.getElementById('boardFecha');
  if (boardFecha) {
    boardFecha.textContent = formatearFechaEspanol(new Date());
  }

  await renderTabla();
  await actualizarDatalistReferencias();
  initFirma();
  initReferenciaDropdown();
  initMultiplicadorComponentes();
  initBoard();
  initMenu();
  initTrazabilidadForm();
  await renderTrazabilidad();
}

init();