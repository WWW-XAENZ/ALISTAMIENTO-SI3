const STORAGE_KEY = 'alistamiento_registros';
const JSON_PATH = 'Registros.json';

let editIndex = null;
let jsonRegistrosCache = [];

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

function getRegistros() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error al leer registros', e);
    return [];
  }
}

function saveRegistros(registros) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
}

function getFormData() {
  return {
    fecha: document.getElementById('fecha').value.trim(),
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
  document.getElementById('btnGuardar').textContent = 'GUARDAR REGISTRO';
  document.getElementById('btnGuardar').className = 'btn-primary';
  document.getElementById('btnCancelar').style.display = 'none';
  limpiarFirma();
}

function renderTabla() {
  const registros = getRegistros();
  const tbody = document.getElementById('cuerpoTabla');
  tbody.innerHTML = '';

  const countEl = document.getElementById('registroCount');
  if (countEl) {
    countEl.textContent = registros.length;
  }

  if (registros.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="11" class="tabla-empty">Sin registros</td>';
    tbody.appendChild(tr);
    return;
  }

  registros.forEach((registro, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(registro.fecha)}</td>
      <td>${escapeHtml(registro.turno)}</td>
      <td>${escapeHtml(registro.referencia)}</td>
      <td>${escapeHtml(registro.base)}</td>
      <td>${escapeHtml(registro.fomi)}</td>
      <td>${escapeHtml(registro.componentes)}</td>
      <td>${escapeHtml(registro.forro)}</td>
      <td>${registro.recibe ? `<img src="${registro.recibe}" class="registro-firma-img" alt="Firma">` : '<span style="color:var(--text-tertiary);font-size:0.8125rem;">— Sin firma</span>'}</td>
      <td>${escapeHtml(registro.contabilizado)}</td>
      <td>${escapeHtml(registro.responsable)}</td>
      <td>
        <button class="btn-edit" data-index="${index}" title="Editar registro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Editar
        </button>
        <button class="btn-delete" data-index="${index}" title="Eliminar registro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function actualizarDatalistReferencias() {
  const registros = getRegistros();
  const referencias = Array.from(new Set(registros.map(r => r.referencia).filter(Boolean)));
  referencias.sort((a, b) => a.localeCompare(b));

  const datalist = document.getElementById('listaReferencias');
  if (!datalist) return;
  datalist.innerHTML = '';
  referencias.forEach(ref => {
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
    const locales = getRegistros();
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
      const clave = r.referencia || r.producto;
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
      const nombre = r.referencia || r.producto;

      item.innerHTML = `
        <span class="ref-code">${escapeHtml(nombre)}</span>
      `;

      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = nombre;
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
  document.getElementById('referencia').value = producto.referencia || producto.producto || '';
}

function initMultiplicadorComponentes() {
  const baseInput = document.getElementById('base');
  const componentesInput = document.getElementById('componentes');
  const referenciaInput = document.getElementById('referencia');

  if (!baseInput || !componentesInput || !referenciaInput) return;

  let productoSeleccionado = null;

  async function actualizarOpciones() {
    const valor = referenciaInput.value.trim().toLowerCase();
    const locales = getRegistros();
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
      const clave = r.referencia || r.producto;
      if (!unicos.has(clave)) {
        unicos.set(clave, r);
      }
    });

    return Array.from(unicos.values());
  }

  referenciaInput.addEventListener('change', async () => {
    const valor = referenciaInput.value.trim();
    if (!valor) return;

    const resultados = await actualizarOpciones();
    const producto = resultados.find(r => {
      const nombre = r.referencia || r.producto;
      return nombre.toLowerCase() === valor.toLowerCase();
    });

    if (producto) {
      productoSeleccionado = producto;
      autocompletarFormulario(producto);
      multiplicarComponentes();
    }
  });

  baseInput.addEventListener('input', multiplicarComponentes);

  function multiplicarComponentes() {
    if (!productoSeleccionado) return;

    const cantidadBase = parseInt(baseInput.value, 10);
    if (isNaN(cantidadBase) || cantidadBase <= 0) return;

    const adicionales = [
      ...(productoSeleccionado.componentes_adicionales || []),
      ...(productoSeleccionado.kits || []),
      ...(productoSeleccionado.anti_vibrantes || []),
    ];

    if (adicionales.length === 0) return;

    const lineas = adicionales.map(c => {
      const partes = [];
      if (c.codigo) partes.push(c.codigo);
      if (c.descripcion) partes.push(c.descripcion);
      const cantidad = (c.cantidad_por_base || c.cantidad || 0) * cantidadBase;
      if (cantidad > 0) partes.push(`x${cantidad}${c.unidad || ''}`);
      return partes.join(' ');
    });

    componentesInput.value = lineas.join(', ');
  }
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
  return remotos.find(r => {
    const nombre = (r.referencia || r.producto || '').toLowerCase();
    return nombre === referencia.trim().toLowerCase();
  });
}

function multiplicarComponentesGlobal(producto, cantidadBase) {
  const adicionales = [
    ...(producto.componentes_adicionales || []),
    ...(producto.kits || []),
    ...(producto.anti_vibrantes || []),
  ];

  return adicionales.map(c => {
    const partes = [];
    if (c.codigo) partes.push(c.codigo);
    if (c.descripcion) partes.push(c.descripcion);
    const cantidad = (c.cantidad_por_base || c.cantidad || 0) * cantidadBase;
    if (cantidad > 0) partes.push(`x${cantidad}${c.unidad || ''}`);
    return partes.join(' ');
  }).join(', ');
}

async function agregarRegistro(e) {
  e.preventDefault();
  const data = getFormData();
  const firma = getFirmaDataUrl();

  const cantidadBase = parseInt(data.base, 10);
  const producto = await obtenerProductoReferencia(data.referencia);

  const registros = getRegistros();

  if (producto) {
    const componentesBase = producto.componentes || [];
    const baseEncontrada = componentesBase.find(c => (c.tipo || '').toLowerCase() === 'base');
    const cantidadBaseValor = parseInt(data.base, 10);
    const multiplicadorBase = (!isNaN(cantidadBaseValor) && cantidadBaseValor > 0) ? cantidadBaseValor : 1;

    const adicionales = [
      ...(producto.componentes_adicionales || []),
      ...(producto.kits || []),
      ...(producto.anti_vibrantes || []),
    ].filter(c => {
      const tipo = (c.tipo || '').toLowerCase();
      return tipo !== 'base' && tipo !== 'forro' && tipo !== 'forro ee';
    });

    if (baseEncontrada || adicionales.length > 0) {
      const componentesTexto = adicionales.map(c => {
        const desc = c.descripcion ? ` (${c.descripcion})` : '';
        const cantidad = (c.cantidad_por_base || c.cantidad || 1) * multiplicadorBase;
        const unidad = c.unidad || 'und';
        const codigo = c.codigo ? `${c.codigo}` : '';
        return `${codigo}${desc} x${cantidad}${unidad}`;
      }).join(', ');

      registros.push({
        fecha: data.fecha,
        turno: data.turno,
        referencia: data.referencia,
        base: baseEncontrada ? `${multiplicadorBase} und` : '',
        forro: '',
        componentes: componentesTexto,
        descripcion: '',
        fomi: data.fomi,
        contabilizado: data.contabilizado,
        responsable: data.responsable,
        recibe: firma,
      });
    } else {
      registros.push({
        ...data,
        recibe: firma,
      });
    }
  } else {
    registros.push({
      ...data,
      recibe: firma,
    });
  }

  saveRegistros(registros);
  limpiarFormulario();
  renderTabla();
  actualizarDatalistReferencias();
  showToast('REGISTRO GUARDADO CORRECTAMENTE', 'success');
}

function editarRegistro(index) {
  const registros = getRegistros();
  const registro = registros[index];
  if (!registro) return;

  document.getElementById('fecha').value = registro.fecha || '';
  document.getElementById('turno').value = registro.turno || '';
  document.getElementById('referencia').value = registro.referencia || '';
  document.getElementById('base').value = registro.base || '';
  document.getElementById('fomi').value = registro.fomi || '';
  document.getElementById('componentes').value = registro.componentes || '';
  document.getElementById('forro').value = registro.forro || '';
  document.getElementById('contabilizado').value = registro.contabilizado !== undefined && registro.contabilizado !== null ? registro.contabilizado : '';
  document.getElementById('responsable').value = registro.responsable || '';

  if (registro.recibe) {
    cargarFirmaEnCanvas(registro.recibe);
  } else {
    limpiarFirma();
  }

  editIndex = index;
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
  if (editIndex === null) return;

  const data = getFormData();
  const firma = getFirmaDataUrl();

  const cantidadBase = parseInt(data.base, 10);
  const producto = await obtenerProductoReferencia(data.referencia);

  let componentesFinal = data.componentes;
  if (producto && !isNaN(cantidadBase) && cantidadBase > 0) {
    componentesFinal = multiplicarComponentesGlobal(producto, cantidadBase);
  }

  const registros = getRegistros();
  registros[editIndex] = { ...registros[editIndex], ...data, recibe: firma, componentes: componentesFinal };
  saveRegistros(registros);
  limpiarFormulario();
  renderTabla();
  actualizarDatalistReferencias();
  showToast('REGISTRO ACTUALIZADO CORRECTAMENTE', 'success');
}

function eliminarRegistro(index) {
  if (!confirm('¿Deseas eliminar este registro?')) {
    return;
  }
  const registros = getRegistros();
  registros.splice(index, 1);
  saveRegistros(registros);
  if (editIndex === index) {
    limpiarFormulario();
  } else if (editIndex !== null && editIndex > index) {
    editIndex--;
  }
  renderTabla();
  actualizarDatalistReferencias();
  showToast('REGISTRO ELIMINADO', 'info');
}

document.getElementById('formAlistamiento').addEventListener('submit', function(e) {
  if (editIndex !== null) {
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
  if (e.target.classList.contains('btn-delete')) {
    const index = parseInt(e.target.getAttribute('data-index'), 10);
    if (!isNaN(index)) {
      eliminarRegistro(index);
    }
  } else if (e.target.classList.contains('btn-edit')) {
    const index = parseInt(e.target.getAttribute('data-index'), 10);
    if (!isNaN(index)) {
      editarRegistro(index);
    }
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

function getTrazabilidad() {
  try {
    const data = localStorage.getItem('trazabilidad_registros');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveTrazabilidad(registros) {
  localStorage.setItem('trazabilidad_registros', JSON.stringify(registros));
}

function renderTrazabilidad() {
  const tbody = document.getElementById('cuerpoTablaTrazabilidad');
  if (!tbody) return;
  const registros = getTrazabilidad();
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
        <button class="btn-delete" data-index="${index}" title="Eliminar registro">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (!isNaN(idx)) {
        if (!confirm('¿Deseas eliminar este registro de trazabilidad?')) return;
        const lista = getTrazabilidad();
        lista.splice(idx, 1);
        saveTrazabilidad(lista);
        renderTrazabilidad();
        showToast('REGISTRO DE TRAZABILIDAD ELIMINADO', 'info');
      }
    });
  });
}

function renderAdmin() {
  const grid = document.getElementById('adminGrid');
  if (!grid) return;
  const registros = getTrazabilidad();
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

  formTrazabilidad.addEventListener('submit', (e) => {
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

      const registros = getTrazabilidad();
      registros.push({
        fecha,
        referencia,
        ckd,
        responsable,
        cantidad: cantidad || '',
        novedades: novedades || '',
        foto: tzFotoDataUrl
      });
      try {
        saveTrazabilidad(registros);
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          showToast('ALMACENAMIENTO LLENO. ELIMINA REGISTROS ANTIGUOS.', 'error');
          return;
        }
        throw e;
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

function init() {
  autoAsignarTurno();

  const boardFecha = document.getElementById('boardFecha');
  if (boardFecha) {
    boardFecha.textContent = formatearFechaEspanol(new Date());
  }

  renderTabla();
  actualizarDatalistReferencias();
  initFirma();
  initReferenciaDropdown();
  initMultiplicadorComponentes();
  initBoard();
  initMenu();
  initTrazabilidadForm();
  renderTrazabilidad();
}

init();