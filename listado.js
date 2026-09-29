const JSON_PATH = 'Registros.json';
const CATALOGO_MANAGED_KEY = 'catalogo_productos_editados';

const listadoState = {
  productos: [],
  puedeEditar: false,
  productoEditando: null,
  duplicadosEditando: []
};

async function cargarRegistrosJSON() {
  try {
    const response = await fetch(`${JSON_PATH}?t=${Date.now()}`);
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json.materiales) ? json.materiales : [];
  } catch (error) {
    console.warn('No se pudo cargar el catálogo local:', error);
    return [];
  }
}

function escapeHtmlListado(value) {
  const element = document.createElement('span');
  element.textContent = value == null ? '' : String(value);
  return element.innerHTML;
}

function getNombreAdicional(componente) {
  const candidates = ['tipo', 'description', 'descripcion', 'nombre', 'Nombre'];
  for (const key of candidates) {
    if (typeof componente[key] === 'string' && componente[key].trim()) return componente[key].trim();
  }
  return 'ADICIONAL';
}

function inferirCategoria(componente, fallback = 'adicional') {
  const categoria = String(componente.categoria || '').toLowerCase();
  if (['base', 'adicional', 'kit', 'anti_vibrante', 'pin'].includes(categoria)) return categoria;

  const tipo = String(componente.tipo || getNombreAdicional(componente)).toLowerCase();
  if (tipo.includes('kit')) return 'kit';
  if (tipo.includes('anti') || tipo.includes('vibrante')) return 'anti_vibrante';
  if (tipo.includes('pin')) return 'pin';
  if (tipo.includes('base') || tipo.includes('forro')) return 'base';
  return fallback;
}

function getComponentes(producto) {
  if (Array.isArray(producto.producto_componentes)) {
    const rows = [...producto.producto_componentes].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    return {
      componentes: rows.filter(component => ['base', 'pin'].includes(inferirCategoria(component))),
      adicionales: rows.filter(component => !['base', 'pin'].includes(inferirCategoria(component)))
    };
  }

  const componentes = Array.isArray(producto.componentes) ? producto.componentes : [];
  const extras = Array.isArray(producto.componentes_adicionales) ? producto.componentes_adicionales : [];
  const kits = Array.isArray(producto.kits) ? producto.kits : [];
  const anti = Array.isArray(producto.anti_vibrantes) ? producto.anti_vibrantes : [];
  const principales = [];
  const adicionales = [];

  componentes.forEach(component => {
    if (inferirCategoria(component) === 'base' || inferirCategoria(component) === 'pin') {
      principales.push({ ...component, categoria: inferirCategoria(component) });
    } else {
      adicionales.push({ ...component, categoria: inferirCategoria(component, 'adicional') });
    }
  });

  return {
    componentes: principales,
    adicionales: [
      ...extras.map(component => ({ ...component, categoria: inferirCategoria(component, 'adicional') })),
      ...kits.map(component => ({ ...component, categoria: 'kit' })),
      ...anti.map(component => ({ ...component, categoria: 'anti_vibrante' })),
      ...adicionales
    ]
  };
}

function componentesParaEdicion(producto) {
  if (Array.isArray(producto.producto_componentes)) {
    return [...producto.producto_componentes].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }

  const groups = getComponentes(producto);
  return [...groups.componentes, ...groups.adicionales];
}

function normalizarClaveProducto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function obtenerProductosGestionados() {
  try {
    const ids = JSON.parse(localStorage.getItem(CATALOGO_MANAGED_KEY) || '[]');
    return new Set(Array.isArray(ids) ? ids : []);
  } catch (error) {
    return new Set();
  }
}

function actualizarProductosGestionados(ids, quitar = false) {
  try {
    const gestionados = obtenerProductosGestionados();
    ids.filter(Boolean).forEach(id => quitar ? gestionados.delete(id) : gestionados.add(id));
    localStorage.setItem(CATALOGO_MANAGED_KEY, JSON.stringify([...gestionados]));
  } catch (error) {
    console.warn('No se pudo guardar el estado del catálogo local:', error);
  }
}

function puntajeCategoria(componente) {
  const tipo = normalizarClaveProducto(componente.tipo || getNombreAdicional(componente));
  const categoria = inferirCategoria(componente);
  if (tipo.includes('base') || tipo.includes('forro')) return categoria === 'base' ? 4 : 0;
  if (tipo.includes('kit')) return categoria === 'kit' ? 4 : 0;
  if (tipo.includes('anti') || tipo.includes('vibrante')) return categoria === 'anti_vibrante' ? 4 : 0;
  if (tipo.includes('pin')) return categoria === 'pin' ? 4 : 0;
  return categoria === 'adicional' ? 4 : 0;
}

function deduplicarProductos(productos) {
  const groups = new Map();
  productos.forEach(producto => {
    const key = normalizarClaveProducto(productoNombre(producto));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(producto);
  });

  return [...groups.values()].map(group => {
    const score = producto => componentesParaEdicion(producto)
      .reduce((total, componente) => total + puntajeCategoria(componente), 0);
    const ranked = [...group].sort((a, b) => {
      const componentDifference = componentesParaEdicion(b).length - componentesParaEdicion(a).length;
      if (componentDifference) return componentDifference;
      const scoreDifference = score(b) - score(a);
      if (scoreDifference) return scoreDifference;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    const canonical = ranked[0];
    const mergedComponents = new Map();

    ranked.forEach(product => {
      componentesParaEdicion(product).forEach(componente => {
        const key = `${normalizarClaveProducto(componente.tipo || getNombreAdicional(componente))}|${normalizarClaveProducto(componente.codigo)}`;
        const current = mergedComponents.get(key);
        if (!current || puntajeCategoria(componente) > puntajeCategoria(current)) {
          mergedComponents.set(key, { ...componente, categoria: inferirCategoria(componente) });
        }
      });
    });

    return {
      ...canonical,
      producto_componentes: [...mergedComponents.values()],
      duplicateIds: ranked.slice(1).map(product => product.id).filter(Boolean)
    };
  }).sort((a, b) => productoNombre(a).localeCompare(productoNombre(b), 'es'));
}

function completarProductosConLocal(remotos, locales) {
  const gestionados = obtenerProductosGestionados();
  const localesPorNombre = new Map(
    locales.map(producto => [normalizarClaveProducto(productoNombre(producto)), producto])
  );

  return remotos.map(remoto => {
    if (remoto.id && gestionados.has(remoto.id)) return remoto;
    const claveProducto = normalizarClaveProducto(productoNombre(remoto));
    const local = localesPorNombre.get(claveProducto);
    if (!local) return remoto;

    if (claveProducto === 'hunk' || claveProducto === 'fomi') {
      return {
        ...remoto,
        producto_componentes: componentesParaEdicion(local).map(componente => ({
          ...componente,
          categoria: inferirCategoria(componente)
        }))
      };
    }

    const componentes = new Map();
    componentesParaEdicion(remoto).forEach(componente => {
      const key = `${normalizarClaveProducto(componente.tipo || getNombreAdicional(componente))}|${normalizarClaveProducto(componente.codigo)}`;
      componentes.set(key, { ...componente, categoria: inferirCategoria(componente) });
    });
    componentesParaEdicion(local).forEach(componente => {
      const key = `${normalizarClaveProducto(componente.tipo || getNombreAdicional(componente))}|${normalizarClaveProducto(componente.codigo)}`;
      const existente = componentes.get(key);
      if (!existente || puntajeCategoria(componente) > puntajeCategoria(existente)) {
        componentes.set(key, { ...componente, categoria: inferirCategoria(componente) });
      }
    });

    return { ...remoto, producto_componentes: [...componentes.values()] };
  });
}

function getClaseChip(tipo) {
  const value = String(tipo || '').toLowerCase();
  if (value.includes('gris-negro')) return ' listado-chip--gris';
  if (value.includes('rojo')) return ' listado-chip--rojo';
  if (value.includes('ee')) return ' listado-chip--ee';
  return '';
}

function setListadoStatus(message, type = '') {
  const status = document.getElementById('listadoStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `listado-status${type ? ` listado-status--${type}` : ''}`;
}

function productoNombre(producto) {
  return String(producto.nombre || producto.producto || producto.referencia || 'Producto sin nombre');
}

function productoCoincide(producto, filtro) {
  if (!filtro) return true;
  const { componentes, adicionales } = getComponentes(producto);
  const searchable = [
    productoNombre(producto),
    producto.referencia,
    ...componentes.flatMap(component => [component.tipo, component.codigo, component.descripcion]),
    ...adicionales.flatMap(component => [getNombreAdicional(component), component.codigo, component.descripcion])
  ].join(' ').toLowerCase();
  return searchable.includes(filtro);
}

function renderChip(componente) {
  const tipo = componente.tipo || getNombreAdicional(componente);
  const cantidad = Number(componente.cantidad_por_base);
  const cantidadMarkup = Number.isFinite(cantidad) && cantidad > 0
    ? `<span class="listado-chip-quantity">×${escapeHtmlListado(cantidad)}</span>`
    : '';

  return `<span class="listado-chip${getClaseChip(tipo)}">
    <span class="chip-type">${escapeHtmlListado(tipo.toUpperCase())}</span>
    <span class="chip-code">${escapeHtmlListado(componente.codigo || '')}</span>
    ${cantidadMarkup}
  </span>`;
}

function renderListado() {
  const grid = document.getElementById('listadoGrid');
  const searchInput = document.getElementById('listadoSearch');
  const count = document.getElementById('listadoCount');
  if (!grid) return;

  const filter = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const products = listadoState.productos.filter(product => productoCoincide(product, filter));
  if (count) count.textContent = `${products.length} de ${listadoState.productos.length} productos`;
  grid.innerHTML = '';

  if (products.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'listado-empty';
    empty.textContent = listadoState.productos.length ? 'No hay productos para esta búsqueda.' : 'Aún no hay productos en el catálogo.';
    grid.appendChild(empty);
    return;
  }

  products.forEach(product => {
    const { componentes, adicionales } = getComponentes(product);
    const id = product.id ? escapeHtmlListado(product.id) : '';
    const card = document.createElement('article');
    card.className = 'listado-card';
    card.innerHTML = `
      <div class="listado-card-heading">
        <div class="listado-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 7h-4V5l-2-2h-4L8 5v2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
            <path d="M16 7v2"/><path d="M8 7v2"/>
          </svg>
          <span>${escapeHtmlListado(productoNombre(product).toUpperCase())}</span>
        </div>
        <div class="listado-card-actions">
          <button type="button" class="listado-action" data-action="edit" data-id="${id}" ${listadoState.puedeEditar && id ? '' : 'disabled'}>Editar</button>
          <button type="button" class="listado-action listado-action--delete" data-action="delete" data-id="${id}" ${listadoState.puedeEditar && id ? '' : 'disabled'}>Eliminar</button>
        </div>
      </div>
      ${product.referencia ? `<div class="listado-reference">REF. ${escapeHtmlListado(product.referencia)}</div>` : ''}
      ${componentes.length ? `<div class="listado-section">
        <div class="listado-section-title">COMPONENTES</div>
        <div>${componentes.map(renderChip).join('')}</div>
      </div>` : ''}
      ${adicionales.length ? `<div class="listado-section">
        <div class="listado-section-title">ADICIONALES</div>
        <div>${adicionales.map(renderChip).join('')}</div>
      </div>` : ''}
      ${!componentes.length && !adicionales.length ? '<div class="listado-section"><div class="listado-section-title">COMPONENTES</div><div class="listado-no-components">Sin componentes registrados</div></div>' : ''}
    `;
    grid.appendChild(card);
  });
}

async function cargarCatalogo() {
  const createButton = document.getElementById('btnCrearProducto');
  setListadoStatus('Cargando catálogo...');

  try {
    await initSupabase();
    if (isSupabaseEnabled()) {
      const [remotos, locales] = await Promise.all([DB.getCatalogoProductos(), cargarRegistrosJSON()]);
      listadoState.productos = deduplicarProductos(completarProductosConLocal(remotos, locales));
      listadoState.puedeEditar = true;
      if (createButton) createButton.disabled = false;
      setListadoStatus('Cambios sincronizados con Supabase.');
    } else {
      listadoState.productos = deduplicarProductos(await cargarRegistrosJSON());
      listadoState.puedeEditar = false;
      if (createButton) createButton.disabled = true;
      setListadoStatus('Vista de respaldo. Conecta Supabase para editar.', 'warning');
    }
  } catch (error) {
    console.error('Error cargando catálogo:', error);
    listadoState.productos = [];
    listadoState.puedeEditar = false;
    if (createButton) createButton.disabled = true;
    setListadoStatus('No se pudo cargar el catálogo. Revisa la conexión y el SQL.', 'error');
  }

  renderListado();
}

function agregarFilaComponente(componente = {}) {
  const template = document.getElementById('productoComponenteTemplate');
  const rows = document.getElementById('listadoComponentRows');
  if (!template || !rows) return;

  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector('.listado-component-row');
  row.querySelector('[name="tipo"]').value = componente.tipo || '';
  row.querySelector('[name="codigo"]').value = componente.codigo || '';
  row.querySelector('[name="categoria"]').value = inferirCategoria(componente, 'base');
  row.querySelector('[name="descripcion"]').value = componente.descripcion || '';
  row.querySelector('[name="cantidad_por_base"]').value = componente.cantidad_por_base ?? 1;
  row.querySelector('.listado-component-remove').addEventListener('click', () => row.remove());
  rows.appendChild(fragment);
}

function abrirDialogoProducto(producto = null) {
  if (!listadoState.puedeEditar) {
    setListadoStatus('Conecta Supabase para administrar productos.', 'warning');
    return;
  }

  const dialog = document.getElementById('productoDialog');
  const form = document.getElementById('productoForm');
  const rows = document.getElementById('listadoComponentRows');
  const title = document.getElementById('productoDialogTitle');
  const error = document.getElementById('productoFormError');
  if (!dialog || !form || !rows) return;

  listadoState.productoEditando = producto ? producto.id : null;
  listadoState.duplicadosEditando = producto ? [...(producto.duplicateIds || [])] : [];
  form.reset();
  rows.innerHTML = '';
  if (error) error.textContent = '';
  title.textContent = producto ? 'Editar producto' : 'Nuevo producto';
  form.elements.nombre.value = producto ? productoNombre(producto) : '';
  form.elements.referencia.value = producto ? (producto.referencia || '') : '';

  if (producto) {
    componentesParaEdicion(producto).forEach(agregarFilaComponente);
  } else {
    agregarFilaComponente();
  }

  dialog.showModal();
  form.elements.nombre.focus();
}

async function guardarProducto(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const saveButton = document.getElementById('btnGuardarProducto');
  const error = document.getElementById('productoFormError');
  if (!listadoState.puedeEditar || !form.reportValidity()) return;

  const componentes = [...document.querySelectorAll('.listado-component-row')].map((row, orden) => ({
    tipo: row.querySelector('[name="tipo"]').value.trim(),
    codigo: row.querySelector('[name="codigo"]').value.trim(),
    categoria: row.querySelector('[name="categoria"]').value,
    descripcion: row.querySelector('[name="descripcion"]').value.trim(),
    cantidad_por_base: Number(row.querySelector('[name="cantidad_por_base"]').value || 1),
    orden
  }));

  if (componentes.some(component => !component.tipo || !component.codigo || component.cantidad_por_base < 0)) {
    if (error) error.textContent = 'Completa tipo, código y cantidad válida en cada componente.';
    return;
  }

  const nombre = form.elements.nombre.value.trim();
  const referencia = form.elements.referencia.value.trim();
  const duplicateProduct = listadoState.productos.find(product => (
    normalizarClaveProducto(productoNombre(product)) === normalizarClaveProducto(nombre)
      || (referencia && normalizarClaveProducto(product.referencia) === normalizarClaveProducto(referencia))
  ) && product.id !== listadoState.productoEditando);
  if (duplicateProduct) {
    if (error) error.textContent = 'Ya existe un producto con ese nombre o referencia.';
    return;
  }

  saveButton.disabled = true;
  if (error) error.textContent = '';

  try {
    const savedId = await DB.guardarProductoCatalogo({
      id: listadoState.productoEditando,
      nombre,
      referencia,
      componentes
    });
    actualizarProductosGestionados([savedId, ...listadoState.duplicadosEditando]);
    for (const duplicateId of listadoState.duplicadosEditando) {
      await DB.eliminarProductoCatalogo(duplicateId);
    }
    document.getElementById('productoDialog').close();
    const [remotos, locales] = await Promise.all([DB.getCatalogoProductos(), cargarRegistrosJSON()]);
    listadoState.productos = deduplicarProductos(completarProductosConLocal(remotos, locales));
    renderListado();
    setListadoStatus(listadoState.productoEditando ? 'Producto actualizado.' : 'Producto agregado.', 'success');
    listadoState.productoEditando = null;
    listadoState.duplicadosEditando = [];
  } catch (saveError) {
    console.error('Error guardando producto:', saveError);
    if (error) error.textContent = saveError.message || 'No se pudo guardar. Ejecuta catalogo-crud.sql en Supabase.';
  } finally {
    saveButton.disabled = false;
  }
}

async function eliminarProducto(id) {
  const producto = listadoState.productos.find(item => item.id === id);
  if (!producto || !listadoState.puedeEditar) return;
  const ids = [producto.id, ...(producto.duplicateIds || [])].filter(Boolean);
  if (!window.confirm(`¿Eliminar ${productoNombre(producto)} y todos sus componentes?`)) return;

  try {
    for (const productId of ids) await DB.eliminarProductoCatalogo(productId);
    actualizarProductosGestionados(ids, true);
    const [remotos, locales] = await Promise.all([DB.getCatalogoProductos(), cargarRegistrosJSON()]);
    listadoState.productos = deduplicarProductos(completarProductosConLocal(remotos, locales));
    renderListado();
    setListadoStatus('Producto eliminado.', 'success');
  } catch (error) {
    console.error('Error eliminando producto:', error);
    setListadoStatus(error.message || 'No se pudo eliminar el producto.', 'error');
  }
}

function initListado() {
  const searchInput = document.getElementById('listadoSearch');
  const createButton = document.getElementById('btnCrearProducto');
  const closeButton = document.getElementById('btnCerrarProducto');
  const cancelButton = document.getElementById('btnCancelarProducto');
  const addComponentButton = document.getElementById('btnAgregarComponente');
  const form = document.getElementById('productoForm');
  const dialog = document.getElementById('productoDialog');
  const grid = document.getElementById('listadoGrid');

  searchInput?.addEventListener('input', renderListado);
  createButton?.addEventListener('click', () => abrirDialogoProducto());
  closeButton?.addEventListener('click', () => dialog.close());
  cancelButton?.addEventListener('click', () => dialog.close());
  addComponentButton?.addEventListener('click', () => agregarFilaComponente());
  form?.addEventListener('submit', guardarProducto);
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  grid?.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const product = listadoState.productos.find(item => item.id === button.dataset.id);
    if (button.dataset.action === 'edit' && product) abrirDialogoProducto(product);
    if (button.dataset.action === 'delete') eliminarProducto(button.dataset.id);
  });

  cargarCatalogo();
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



