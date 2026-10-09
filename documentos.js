const DOCUMENTOS_TIPOS_PERMITIDOS = new Set(['image/png', 'image/jpeg', 'application/pdf', 'text/plain']);

const documentosState = {
  libros: [],
  libroActivo: null,
  archivos: [],
  cargando: false,
  archivoEditando: null,
  proximoOrden: 1,
  lectorIndice: 0,
  lectorToken: 0,
  lectorActivo: false,
  lectorAnimando: false,
  lectorTimer: null,
};

let documentosCargaTimer;

function escaparTextoDocumentos(value) {
  const element = document.createElement('span');
  element.textContent = value == null ? '' : String(value);
  return element.innerHTML;
}

function setDocumentosStatus(message, type = '') {
  const status = document.getElementById('documentosStatus');
  status.textContent = message;
  status.className = `documentos-status${type ? ` documentos-status--${type}` : ''}`;
}

function formatearTamanoArchivo(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function cargarLibrosDocumentos() {
  documentosState.libros = await DB.getLibros();
  renderLibrosDocumentos();
  if (documentosState.libroActivo) {
    const actualizado = documentosState.libros.find(libro => libro.id === documentosState.libroActivo.id);
    if (actualizado) {
      documentosState.libroActivo = actualizado;
      await seleccionarLibroDocumentos(actualizado, false);
    } else {
      documentosState.libroActivo = null;
      renderDetalleLibroDocumentos();
    }
  }
}

function renderLibrosDocumentos() {
  const lista = document.getElementById('librosLista');
  const filtro = document.getElementById('buscarLibro').value.trim().toLocaleLowerCase('es');
  const libros = documentosState.libros.filter(libro => libro.nombre.toLocaleLowerCase('es').includes(filtro));
  document.getElementById('librosCount').textContent = documentosState.libros.length;
  lista.replaceChildren();

  if (!libros.length) {
    const empty = document.createElement('p');
    empty.className = 'documentos-lista-vacia';
    empty.textContent = filtro ? 'No hay carpetas con ese nombre.' : 'Aún no hay carpetas creadas.';
    lista.appendChild(empty);
    return;
  }

  libros.forEach(libro => {
    const row = document.createElement('div');
    row.className = `documentos-libro-item${documentosState.libroActivo?.id === libro.id ? ' documentos-libro-item--activo' : ''}`;

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'documentos-libro-select';
    select.dataset.libroId = libro.id;
    select.setAttribute('aria-current', documentosState.libroActivo?.id === libro.id ? 'true' : 'false');

    const folder = document.createElement('span');
    folder.className = 'documentos-folder-icon';
    folder.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.className = 'documentos-libro-nombre';
    title.textContent = libro.nombre;
    const count = document.createElement('span');
    count.className = 'documentos-libro-cantidad';
    count.textContent = `${libro.documentos_archivos?.length || 0} archivos`;
    const copy = document.createElement('span');
    copy.className = 'documentos-libro-copy';
    copy.append(title, count);
    select.append(folder, copy);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'documentos-icon-button documentos-eliminar-libro';
    remove.dataset.libroId = libro.id;
    remove.setAttribute('aria-label', `Eliminar carpeta ${libro.nombre}`);
    remove.title = 'Eliminar carpeta';
    remove.textContent = '×';
    row.append(select, remove);
    lista.appendChild(row);
  });
}

async function seleccionarLibroDocumentos(libro, cargar = true) {
  documentosState.libroActivo = libro;
  if (cargar) documentosState.archivos = await DB.getArchivosLibro(libro.id);
  documentosState.proximoOrden = Math.max(0, ...documentosState.archivos.map(archivo => Number(archivo.orden) || 0)) + 1;
  document.getElementById('libroTitulo').textContent = libro.nombre;
  document.getElementById('libroDescripcion').textContent = libro.descripcion || '';
  document.getElementById('documentosVacio').hidden = true;
  document.getElementById('libroDetalle').hidden = false;
  renderLibrosDocumentos();
  renderArchivosLibroDocumentos();
}

function renderDetalleLibroDocumentos() {
  const vacio = !documentosState.libroActivo;
  document.getElementById('documentosVacio').hidden = !vacio;
  document.getElementById('libroDetalle').hidden = vacio;
}

function renderArchivosLibroDocumentos() {
  const grid = document.getElementById('archivosGrid');
  const archivos = [...documentosState.archivos];
  document.getElementById('archivosCount').textContent = `${archivos.length} ${archivos.length === 1 ? 'archivo' : 'archivos'}`;
  document.getElementById('btnAbrirLector').disabled = !archivos.length;
  grid.replaceChildren();

  if (!archivos.length) {
    const empty = document.createElement('p');
    empty.className = 'documentos-archivos-vacios';
    empty.textContent = 'Esta carpeta todavía no tiene archivos.';
    grid.appendChild(empty);
    renderMiniaturasLector();
    return;
  }

  archivos.forEach((archivo, index) => {
    const item = document.createElement('article');
    item.className = 'documentos-archivo';
    item.dataset.archivoId = archivo.id;
    item.draggable = true;
    const pageNumber = document.createElement('span');
    pageNumber.className = 'documentos-page-number';
    pageNumber.textContent = `PÁGINA ${String(index + 1).padStart(2, '0')}`;
    const toolbar = document.createElement('div');
    toolbar.className = 'documentos-page-toolbar';
    const dragHandle = document.createElement('span');
    dragHandle.className = 'documentos-drag-handle';
    dragHandle.textContent = '⋮⋮';
    dragHandle.title = 'Arrastrar para cambiar de posición';
    dragHandle.setAttribute('aria-hidden', 'true');
    const moveUp = document.createElement('button');
    moveUp.type = 'button';
    moveUp.className = 'documentos-icon-button documentos-mover-pagina';
    moveUp.dataset.direction = '-1';
    moveUp.disabled = index === 0;
    moveUp.title = 'Subir página';
    moveUp.setAttribute('aria-label', `Subir página ${index + 1}`);
    moveUp.textContent = '↑';
    const moveDown = document.createElement('button');
    moveDown.type = 'button';
    moveDown.className = 'documentos-icon-button documentos-mover-pagina';
    moveDown.dataset.direction = '1';
    moveDown.disabled = index === archivos.length - 1;
    moveDown.title = 'Bajar página';
    moveDown.setAttribute('aria-label', `Bajar página ${index + 1}`);
    moveDown.textContent = '↓';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'documentos-icon-button documentos-editar-archivo';
    edit.setAttribute('aria-label', `Editar o reemplazar ${archivo.nombre}`);
    edit.title = 'Editar o reemplazar';
    edit.textContent = '✎';
    toolbar.append(pageNumber, dragHandle, moveUp, moveDown, edit);
    const preview = document.createElement('a');
    preview.className = 'documentos-archivo-preview';
    preview.href = archivo.url_publica;
    preview.target = '_blank';
    preview.draggable = false;
    preview.rel = 'noopener noreferrer';
    preview.setAttribute('aria-label', `Abrir ${archivo.nombre}`);

    if (archivo.tipo_mime.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = archivo.url_publica;
      image.alt = archivo.nombre;
      image.loading = 'lazy';
      preview.appendChild(image);
    } else {
      const pdfIcon = document.createElement('span');
      pdfIcon.className = `documentos-pdf-icon${archivo.tipo_mime === 'text/plain' ? ' documentos-texto-icon' : ''}`;
      pdfIcon.textContent = archivo.tipo_mime === 'text/plain' ? 'TXT' : 'PDF';
      preview.appendChild(pdfIcon);
    }

    const info = document.createElement('div');
    info.className = 'documentos-archivo-info';
    const name = document.createElement('a');
    name.className = 'documentos-archivo-nombre';
    name.href = archivo.url_publica;
    name.target = '_blank';
    name.draggable = false;
    name.rel = 'noopener noreferrer';
    name.textContent = archivo.nombre;
    name.title = archivo.nombre;
    const meta = document.createElement('span');
    const tipoEtiqueta = archivo.tipo_mime === 'application/pdf' ? 'PDF' : archivo.tipo_mime === 'text/plain' ? 'TEXTO' : 'IMAGEN';
    meta.textContent = `${tipoEtiqueta} · ${formatearTamanoArchivo(archivo.tamano_bytes)}`;
    info.append(name, meta);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'documentos-icon-button documentos-eliminar-archivo';
    remove.dataset.archivoId = archivo.id;
    remove.dataset.archivoPath = archivo.ruta_storage;
    remove.setAttribute('aria-label', `Eliminar archivo ${archivo.nombre}`);
    remove.title = 'Eliminar archivo';
    remove.textContent = '×';
    item.append(toolbar, preview, info, remove);
    grid.appendChild(item);
  });
  if (document.getElementById('lectorDialog').open && documentosState.lectorActivo) renderAperturaLector();
  else renderMiniaturasLector();
}

function obtenerPaginasLector() {
  return [...documentosState.archivos];
}

function crearContenidoHoja(hoja, archivo, index, token) {
  hoja.replaceChildren();
  if (!archivo) return;

  if (archivo.tipo_mime.startsWith('image/')) {
    const image = document.createElement('img');
    image.src = archivo.url_publica;
    image.alt = archivo.nombre;
    image.draggable = false;
    hoja.appendChild(image);
  } else if (archivo.tipo_mime === 'application/pdf') {
    const frame = document.createElement('iframe');
    frame.src = archivo.url_publica;
    frame.title = archivo.nombre;
    frame.loading = 'lazy';
    hoja.appendChild(frame);
  } else {
    const text = document.createElement('pre');
    text.className = 'documentos-lector-texto';
    text.textContent = 'Cargando texto...';
    hoja.appendChild(text);
    fetch(archivo.url_publica)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(content => {
        if (token === documentosState.lectorToken && text.isConnected) text.textContent = content;
      })
      .catch(error => {
        console.error('Error leyendo una página de texto:', error);
        if (token === documentosState.lectorToken && text.isConnected) text.textContent = 'No se pudo cargar esta página.';
      });
  }

  const label = document.createElement('span');
  label.className = 'documentos-lector-etiqueta';
  label.textContent = `${String(index + 1).padStart(2, '0')} · ${archivo.nombre}`;
  hoja.appendChild(label);
}

function renderAperturaLector() {
  documentosState.lectorActivo = true;
  const paginas = obtenerPaginasLector();
  const index = documentosState.lectorIndice;
  const paginasPorApertura = paginasPorAperturaLector();
  const token = ++documentosState.lectorToken;
  const izquierda = paginas[index] || null;
  const derecha = paginas[index + 1] || null;
  document.getElementById('lectorAbierto').hidden = false;
  crearContenidoHoja(document.getElementById('lectorHojaIzquierda'), izquierda, index, token);
  crearContenidoHoja(document.getElementById('lectorHojaDerecha'), derecha, index + 1, token);

  const total = paginas.length;
  const first = index + 1;
  const last = Math.min(index + paginasPorApertura, total);
  document.getElementById('lectorContador').textContent = paginasPorApertura === 1 || first === last
    ? `Página ${first} de ${total}`
    : `Páginas ${first}-${last} de ${total}`;
  document.getElementById('btnPaginaAnterior').disabled = index === 0;
  document.getElementById('btnPaginaSiguiente').disabled = index + paginasPorApertura >= total;
  const spread = document.getElementById('lectorAbierto');
  spread.classList.remove('documentos-lector-pasando');
  void spread.offsetWidth;
  spread.classList.add('documentos-lector-pasando');
  renderMiniaturasLector();
}

function renderMiniaturasLector() {
  const nav = document.getElementById('lectorMiniaturas');
  const paginas = obtenerPaginasLector();
  nav.replaceChildren();
  nav.hidden = !documentosState.lectorActivo;

  paginas.forEach((archivo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'documentos-lector-miniatura';
    button.dataset.paginaIndex = index;
    button.setAttribute('aria-label', `Ir a la página ${index + 1}: ${archivo.nombre}`);
    button.setAttribute('aria-current', index >= documentosState.lectorIndice && index < documentosState.lectorIndice + paginasPorAperturaLector() ? 'true' : 'false');
    if (archivo.tipo_mime.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = archivo.url_publica;
      image.alt = '';
      image.loading = 'lazy';
      button.appendChild(image);
    } else {
      const type = document.createElement('span');
      type.className = 'documentos-lector-miniatura-tipo';
      type.textContent = archivo.tipo_mime === 'application/pdf' ? 'PDF' : 'TXT';
      button.appendChild(type);
    }
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    button.appendChild(number);
    nav.appendChild(button);
  });
}

function paginasPorAperturaLector() {
  return window.matchMedia('(max-width: 760px), (max-height: 500px) and (orientation: landscape)').matches ? 1 : 2;
}

function abrirLectorDocumentos() {
  if (!documentosState.libroActivo || !documentosState.archivos.length) return;
  const dialog = document.getElementById('lectorDialog');
  const libro = documentosState.libroActivo;
  window.clearTimeout(documentosState.lectorTimer);
  documentosState.lectorIndice = 0;
  documentosState.lectorActivo = false;
  documentosState.lectorAnimando = false;
  document.getElementById('lectorTitulo').textContent = libro.nombre;
  document.getElementById('lectorPortadaTitulo').textContent = libro.nombre;
  document.getElementById('lectorPortadaDescripcion').textContent = libro.descripcion || 'Colección de documentos';
  document.getElementById('lectorPortadaCantidad').textContent = `${documentosState.archivos.length} ${documentosState.archivos.length === 1 ? 'ARCHIVO' : 'ARCHIVOS'}`;
  document.getElementById('lectorPortada').hidden = false;
  document.getElementById('lectorAbierto').hidden = true;
  document.getElementById('lectorDialog').classList.add('documentos-lector--portada');
  renderMiniaturasLector();
  dialog.showModal();
  document.getElementById('btnAbrirLibro').focus();
}

function completarAperturaLector() {
  if (!documentosState.lectorAnimando) return;
  window.clearTimeout(documentosState.lectorTimer);
  documentosState.lectorTimer = null;
  documentosState.lectorAnimando = false;
  const dialog = document.getElementById('lectorDialog');
  dialog.classList.remove('documentos-lector--portada');
  const portada = document.getElementById('lectorPortada');
  portada.classList.remove('documentos-lector-portada--abriendo');
  portada.hidden = true;
  renderAperturaLector();
}

function abrirLibroDesdePortada() {
  if (documentosState.lectorActivo || documentosState.lectorAnimando) return;
  const portada = document.getElementById('lectorPortada');
  documentosState.lectorAnimando = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    completarAperturaLector();
    return;
  }
  portada.classList.remove('documentos-lector-portada--abriendo');
  void portada.offsetWidth;
  portada.classList.add('documentos-lector-portada--abriendo');
  documentosState.lectorTimer = window.setTimeout(completarAperturaLector, 700);
}

function avanzarLector(direccion) {
  const paginas = paginasPorAperturaLector();
  const total = obtenerPaginasLector().length;
  const maxIndex = Math.max(0, Math.floor((total - 1) / paginas) * paginas);
  documentosState.lectorIndice = Math.max(0, Math.min(maxIndex, documentosState.lectorIndice + direccion * paginas));
  renderAperturaLector();
}

async function guardarLibroDocumentos(event) {
  event.preventDefault();
  const button = document.getElementById('btnGuardarLibro');
  const errorBox = document.getElementById('libroError');
  const nombre = document.getElementById('nuevoLibroNombre').value.trim();
  const descripcion = document.getElementById('nuevoLibroDescripcion').value.trim();
  errorBox.textContent = '';
  button.disabled = true;

  try {
    const libro = await DB.saveLibro({ nombre, descripcion: descripcion || null });
    document.getElementById('libroDialog').close();
    document.getElementById('libroForm').reset();
    documentosState.libros.unshift({ ...libro, documentos_archivos: [] });
    await seleccionarLibroDocumentos(documentosState.libros[0]);
    setDocumentosStatus('Carpeta creada.', 'success');
  } catch (error) {
    console.error('Error creando la carpeta:', error);
    errorBox.textContent = 'No se pudo crear la carpeta. Revisa la conexión y vuelve a intentarlo.';
  } finally {
    button.disabled = false;
  }
}

function nombreSeguroArchivo(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function guardarArchivoEnLibro(libro, file, nombre = file.name, tipo = file.type, orden = documentosState.proximoOrden) {
  const path = `${libro.id}/${crypto.randomUUID()}-${nombreSeguroArchivo(nombre)}`;
  const ruta = await DB.uploadArchivoLibro(path, file);
  try {
    const url = DB.getUrlArchivoLibro(ruta);
    await DB.saveArchivoLibro({
      libro_id: libro.id,
      nombre,
      ruta_storage: ruta,
      url_publica: url,
      tipo_mime: tipo,
      tamano_bytes: file.size,
      orden
    });
    if (documentosState.libroActivo?.id === libro.id) {
      documentosState.proximoOrden = Math.max(documentosState.proximoOrden, orden + 1);
    }
  } catch (error) {
    await DB.removeArchivoLibro(ruta);
    throw error;
  }
}

async function actualizarArchivosLibro(libro) {
  documentosState.archivos = await DB.getArchivosLibro(libro.id);
  renderArchivosLibroDocumentos();
  await cargarLibrosDocumentos();
}

function actualizarProgresoCarga(actual, total, completados, nombre) {
  const progreso = document.getElementById('documentosUploadProgress');
  const barra = document.getElementById('documentosUploadProgressBar');
  progreso.hidden = false;
  progreso.classList.remove('documentos-upload-progress--completo');
  document.getElementById('documentosUploadProgressTexto').textContent = `Cargando archivo ${actual} de ${total}: ${nombre} · ${completados} completados`;
  barra.max = total;
  barra.value = completados;
}

function finalizarProgresoCarga(completados, total) {
  const progreso = document.getElementById('documentosUploadProgress');
  clearTimeout(documentosCargaTimer);
  progreso.classList.add('documentos-upload-progress--completo');
  document.getElementById('documentosUploadProgressTexto').textContent = `Carga terminada: ${completados} de ${total} archivos`;
  const barra = document.getElementById('documentosUploadProgressBar');
  barra.max = total;
  barra.value = total;
  documentosCargaTimer = setTimeout(() => { progreso.hidden = true; }, 1400);
}

async function adjuntarArchivosLibro(files) {
  const libro = documentosState.libroActivo;
  if (!libro || !files.length || documentosState.cargando) return;

  const archivosValidos = [];
  const archivosInvalidos = [];
  for (const file of Array.from(files)) {
    if (DOCUMENTOS_TIPOS_PERMITIDOS.has(tipoMimeArchivo(file))) archivosValidos.push(file);
    else archivosInvalidos.push(file.name);
  }
  if (!archivosValidos.length) {
    setDocumentosStatus(`${archivosInvalidos.length} archivo(s) no permitido(s). Solo se permiten PNG, JPG, PDF o TXT.`, 'error');
    return;
  }

  documentosState.cargando = true;
  clearTimeout(documentosCargaTimer);
  const button = document.getElementById('btnAgregarArchivos');
  button.disabled = true;
  let adjuntados = 0;
  let fallidos = 0;
  let siguienteOrden = documentosState.proximoOrden;

  try {
    for (const [index, file] of archivosValidos.entries()) {
      actualizarProgresoCarga(index + 1, archivosValidos.length, adjuntados, file.name);
      try {
        await guardarArchivoEnLibro(libro, file, file.name, tipoMimeArchivo(file), siguienteOrden);
        adjuntados++;
        siguienteOrden++;
      } catch (error) {
        console.error(`Error adjuntando ${file.name}:`, error);
        fallidos++;
      }
    }

    await actualizarArchivosLibro(libro);
    if (fallidos || archivosInvalidos.length) {
      setDocumentosStatus(`${adjuntados} archivo(s) adjuntado(s); ${fallidos + archivosInvalidos.length} no se pudieron adjuntar. Solo se permiten PNG, JPG, PDF o TXT.`, 'error');
    } else if (adjuntados) {
      setDocumentosStatus(`${adjuntados} archivo(s) adjuntado(s) en el orden recibido.`, 'success');
    }
  } catch (error) {
    console.error('Error adjuntando documentos:', error);
    setDocumentosStatus('No se pudieron guardar todos los archivos. Revisa la configuración de Supabase Storage.', 'error');
  } finally {
    finalizarProgresoCarga(adjuntados, archivosValidos.length);
    documentosState.cargando = false;
    button.disabled = false;
    document.getElementById('inputArchivos').value = '';
  }
}

function tipoMimeArchivo(file) {
  const extension = file.name.toLowerCase().split('.').pop();
  return file.type || ({ pdf: 'application/pdf', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' })[extension] || '';
}

async function abrirEdicionArchivo(archivo) {
  const dialog = document.getElementById('archivoDialog');
  const contenidoLabel = document.getElementById('archivoContenidoLabel');
  const contenido = document.getElementById('archivoContenido');
  document.getElementById('archivoError').textContent = '';
  document.getElementById('archivoNombre').value = archivo.nombre;
  document.getElementById('archivoReemplazo').value = '';
  documentosState.archivoEditando = archivo;
  contenidoLabel.hidden = archivo.tipo_mime !== 'text/plain';
  contenido.value = '';

  if (archivo.tipo_mime === 'text/plain') {
    try {
      const response = await fetch(archivo.url_publica);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      contenido.value = await response.text();
    } catch (error) {
      console.error('Error cargando el texto:', error);
      setDocumentosStatus('No se pudo cargar el texto para editarlo.', 'error');
      return;
    }
  }

  dialog.showModal();
  document.getElementById('archivoNombre').focus();
}

async function reemplazarArchivoLibro(archivo, file, nombre, tipo) {
  const path = `${archivo.libro_id}/${crypto.randomUUID()}-${nombreSeguroArchivo(nombre)}`;
  const ruta = await DB.uploadArchivoLibro(path, file);
  try {
    await DB.updateArchivoLibro(archivo.id, {
      nombre,
      ruta_storage: ruta,
      url_publica: DB.getUrlArchivoLibro(ruta),
      tipo_mime: tipo,
      tamano_bytes: file.size
    });
  } catch (error) {
    await DB.removeArchivoLibro(ruta);
    throw error;
  }

  try {
    await DB.removeArchivoLibro(archivo.ruta_storage);
  } catch (error) {
    console.warn('No se pudo eliminar el archivo reemplazado:', error);
  }
}

async function guardarEdicionArchivo(event) {
  event.preventDefault();
  const archivo = documentosState.archivoEditando;
  if (!archivo || documentosState.cargando) return;

  const nombre = document.getElementById('archivoNombre').value.trim();
  const contenido = document.getElementById('archivoContenido').value;
  const replacement = document.getElementById('archivoReemplazo').files[0];
  const button = document.getElementById('btnGuardarArchivo');
  const errorBox = document.getElementById('archivoError');
  errorBox.textContent = '';
  if (!nombre) {
    errorBox.textContent = 'Escribe un nombre para esta página.';
    return;
  }

  const tipo = replacement ? tipoMimeArchivo(replacement) : archivo.tipo_mime;
  if (replacement && !DOCUMENTOS_TIPOS_PERMITIDOS.has(tipo)) {
    errorBox.textContent = 'El archivo debe ser PNG, JPG, PDF o TXT.';
    return;
  }

  documentosState.cargando = true;
  button.disabled = true;
  try {
    if (replacement) {
      await reemplazarArchivoLibro(archivo, replacement, nombre, tipo);
    } else if (archivo.tipo_mime === 'text/plain') {
      const nombreTexto = nombre.toLowerCase().endsWith('.txt') ? nombre : `${nombre}.txt`;
      const file = new File([contenido], nombreTexto, { type: 'text/plain' });
      await reemplazarArchivoLibro(archivo, file, nombreTexto, 'text/plain');
    } else {
      await DB.updateArchivoLibro(archivo.id, { nombre });
    }

    document.getElementById('archivoDialog').close();
    await actualizarArchivosLibro(documentosState.libroActivo);
    setDocumentosStatus('Página actualizada.', 'success');
  } catch (error) {
    console.error('Error actualizando la página:', error);
    errorBox.textContent = 'No se pudo guardar el cambio. Revisa la conexión y Supabase Storage.';
  } finally {
    documentosState.cargando = false;
    button.disabled = false;
  }
}

async function guardarOrdenArchivos(archivos) {
  const ordenAnterior = documentosState.archivos;
  documentosState.archivos = archivos;
  renderArchivosLibroDocumentos();
  documentosState.cargando = true;
  try {
    await Promise.all(archivos.map((archivo, index) => DB.updateArchivoLibro(archivo.id, { orden: index + 1 })));
    documentosState.archivos = archivos.map((archivo, index) => ({ ...archivo, orden: index + 1 }));
    setDocumentosStatus('Orden de páginas guardado.', 'success');
  } catch (error) {
    console.error('Error ordenando páginas:', error);
    documentosState.archivos = ordenAnterior;
    renderArchivosLibroDocumentos();
    setDocumentosStatus('No se pudo guardar el orden de las páginas.', 'error');
  } finally {
    documentosState.cargando = false;
  }
}

async function moverArchivoDocumentos(id, delta) {
  if (documentosState.cargando) return;
  const archivos = [...documentosState.archivos];
  const index = archivos.findIndex(archivo => archivo.id === id);
  const destino = index + delta;
  if (index < 0 || destino < 0 || destino >= archivos.length) return;
  [archivos[index], archivos[destino]] = [archivos[destino], archivos[index]];
  await guardarOrdenArchivos(archivos);
}

function recibirArchivosArrastrados(event) {
  event.preventDefault();
  const dropzone = document.getElementById('documentosDropzone');
  dropzone.classList.remove('documentos-dropzone--activo');
  if (event.dataTransfer.files.length) adjuntarArchivosLibro([...event.dataTransfer.files]);
}

function pegarImagenesDocumentos(event) {
  if (!documentosState.libroActivo || document.querySelector('dialog[open]')) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

  const clipboard = event.clipboardData;
  const items = Array.from(clipboard?.items || []);
  const images = items
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => ({ blob: item.getAsFile(), type: item.type }))
    .filter(image => image.blob);
  const pastedImages = images.length
    ? images
    : Array.from(clipboard?.files || [])
      .filter(file => file.type.startsWith('image/'))
      .map(blob => ({ blob, type: blob.type }));
  if (!pastedImages.length) return;

  event.preventDefault();
  const timestamp = Date.now();
  const files = pastedImages.map((image, index) => {
    const type = image.type === 'image/jpg' ? 'image/jpeg' : image.type;
    const extension = type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'img';
    const suffix = index ? `-${index + 1}` : '';
    return new File([image.blob], `Imagen pegada ${timestamp}${suffix}.${extension}`, { type });
  });
  adjuntarArchivosLibro(files);
}

async function guardarTextoDocumentos(event) {
  event.preventDefault();
  const libro = documentosState.libroActivo;
  const nombre = document.getElementById('textoNombre').value.trim();
  const contenido = document.getElementById('textoContenido').value.trim();
  const errorBox = document.getElementById('textoError');
  const button = document.getElementById('btnGuardarTexto');
  errorBox.textContent = '';
  if (!libro || !contenido) {
    errorBox.textContent = 'Escribe el texto antes de guardarlo.';
    return;
  }

  button.disabled = true;
  try {
    const baseNombre = nombre || 'Documento de texto';
    const nombreArchivo = `${baseNombre.replace(/\.txt$/i, '')}.txt`;
    const file = new File([contenido], nombreArchivo, { type: 'text/plain' });
    await guardarArchivoEnLibro(libro, file, nombreArchivo, 'text/plain');
    await actualizarArchivosLibro(libro);
    document.getElementById('textoDialog').close();
    document.getElementById('textoForm').reset();
    setDocumentosStatus('Texto guardado en la carpeta.', 'success');
  } catch (error) {
    console.error('Error guardando texto:', error);
    errorBox.textContent = 'No se pudo guardar el texto. Revisa la conexión y el límite de Supabase Storage.';
  } finally {
    button.disabled = false;
  }
}

async function eliminarLibroDocumentos(id) {
  const libro = documentosState.libros.find(item => item.id === id);
  if (!libro || !confirm(`¿Eliminar la carpeta "${libro.nombre}" y todos sus archivos?`)) return;

  try {
    const archivos = await DB.getArchivosLibro(id);
    await DB.deleteLibro(id, archivos.map(archivo => archivo.ruta_storage));
    if (documentosState.libroActivo?.id === id) {
      documentosState.libroActivo = null;
      documentosState.archivos = [];
      renderDetalleLibroDocumentos();
    }
    await cargarLibrosDocumentos();
    setDocumentosStatus('Carpeta eliminada.', 'success');
  } catch (error) {
    console.error('Error eliminando la carpeta:', error);
    setDocumentosStatus('No se pudo eliminar la carpeta y sus archivos.', 'error');
  }
}

async function eliminarArchivoDocumentos(id, path) {
  try {
    await DB.deleteArchivoLibro(id, path);
    documentosState.archivos = documentosState.archivos.filter(archivo => archivo.id !== id);
    renderArchivosLibroDocumentos();
    await cargarLibrosDocumentos();
    setDocumentosStatus('Archivo eliminado.', 'success');
  } catch (error) {
    console.error('Error eliminando el archivo:', error);
    setDocumentosStatus('No se pudo eliminar el archivo.', 'error');
  }
}

async function iniciarDocumentos() {
  const menu = document.getElementById('menuOverlay');
  document.addEventListener('paste', pegarImagenesDocumentos);
  document.getElementById('btnMenu').addEventListener('click', () => menu.classList.add('open'));
  document.getElementById('btnCerrarMenu').addEventListener('click', () => menu.classList.remove('open'));
  menu.addEventListener('click', event => {
    if (event.target === menu) menu.classList.remove('open');
  });

  const dialog = document.getElementById('libroDialog');
  document.getElementById('btnCrearLibro').addEventListener('click', () => {
    document.getElementById('libroError').textContent = '';
    dialog.showModal();
    document.getElementById('nuevoLibroNombre').focus();
  });
  document.getElementById('btnCerrarLibro').addEventListener('click', () => dialog.close());
  document.getElementById('btnCancelarLibro').addEventListener('click', () => dialog.close());
  document.getElementById('libroForm').addEventListener('submit', guardarLibroDocumentos);
  document.getElementById('buscarLibro').addEventListener('input', renderLibrosDocumentos);
  document.getElementById('btnAgregarArchivos').addEventListener('click', () => document.getElementById('inputArchivos').click());
  document.getElementById('inputArchivos').addEventListener('change', event => adjuntarArchivosLibro([...event.target.files]));
  const textoDialog = document.getElementById('textoDialog');
  document.getElementById('btnAgregarTexto').addEventListener('click', () => {
    document.getElementById('textoError').textContent = '';
    textoDialog.showModal();
    document.getElementById('textoNombre').focus();
  });
  document.getElementById('btnCerrarTexto').addEventListener('click', () => textoDialog.close());
  document.getElementById('btnCancelarTexto').addEventListener('click', () => textoDialog.close());
  document.getElementById('textoForm').addEventListener('submit', guardarTextoDocumentos);

  const archivoDialog = document.getElementById('archivoDialog');
  document.getElementById('archivoForm').addEventListener('submit', guardarEdicionArchivo);
  document.getElementById('btnCerrarArchivo').addEventListener('click', () => archivoDialog.close());
  document.getElementById('btnCancelarArchivo').addEventListener('click', () => archivoDialog.close());

  const lectorDialog = document.getElementById('lectorDialog');
  document.getElementById('btnAbrirLector').addEventListener('click', abrirLectorDocumentos);
  document.getElementById('btnAbrirLibro').addEventListener('click', abrirLibroDesdePortada);
  document.getElementById('btnCerrarLector').addEventListener('click', () => lectorDialog.close());
  lectorDialog.addEventListener('close', () => {
    window.clearTimeout(documentosState.lectorTimer);
    documentosState.lectorTimer = null;
    documentosState.lectorAnimando = false;
    documentosState.lectorActivo = false;
    lectorDialog.classList.remove('documentos-lector--portada');
    document.getElementById('lectorPortada').classList.remove('documentos-lector-portada--abriendo');
    document.getElementById('lectorPortada').hidden = false;
    document.getElementById('lectorAbierto').hidden = true;
    document.getElementById('lectorMiniaturas').hidden = true;
    documentosState.lectorToken++;
  });
  document.getElementById('lectorPortada').addEventListener('animationend', event => {
    if (event.target === event.currentTarget) completarAperturaLector();
  });
  document.getElementById('btnPaginaAnterior').addEventListener('click', () => avanzarLector(-1));
  document.getElementById('btnPaginaSiguiente').addEventListener('click', () => avanzarLector(1));
  document.getElementById('lectorMiniaturas').addEventListener('click', event => {
    const thumbnail = event.target.closest('[data-pagina-index]');
    if (!thumbnail) return;
    const paginas = paginasPorAperturaLector();
    documentosState.lectorIndice = Math.floor(Number(thumbnail.dataset.paginaIndex) / paginas) * paginas;
    renderAperturaLector();
  });
  lectorDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      avanzarLector(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      avanzarLector(-1);
    }
  });
  const lectorEscena = document.getElementById('lectorEscena');
  let lectorPuntoInicial = null;
  lectorEscena.addEventListener('pointerdown', event => { lectorPuntoInicial = event.clientX; });
  lectorEscena.addEventListener('pointerup', event => {
    if (lectorPuntoInicial === null) return;
    const distancia = event.clientX - lectorPuntoInicial;
    lectorPuntoInicial = null;
    if (Math.abs(distancia) > 55) avanzarLector(distancia < 0 ? 1 : -1);
  });
  lectorEscena.addEventListener('pointercancel', () => { lectorPuntoInicial = null; });

  const dropzone = document.getElementById('documentosDropzone');
  dropzone.addEventListener('dragover', event => {
    if (Array.from(event.dataTransfer.types).includes('Files')) {
      event.preventDefault();
      dropzone.classList.add('documentos-dropzone--activo');
    }
  });
  dropzone.addEventListener('dragleave', event => {
    if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('documentos-dropzone--activo');
  });
  dropzone.addEventListener('drop', recibirArchivosArrastrados);

  document.getElementById('librosLista').addEventListener('click', async event => {
    const select = event.target.closest('[data-libro-id].documentos-libro-select');
    const remove = event.target.closest('.documentos-eliminar-libro');
    if (remove) {
      await eliminarLibroDocumentos(remove.dataset.libroId);
      return;
    }
    if (select) {
      try {
        const libro = documentosState.libros.find(item => item.id === select.dataset.libroId);
        if (libro) await seleccionarLibroDocumentos(libro);
      } catch (error) {
        console.error('Error cargando archivos de la carpeta:', error);
        setDocumentosStatus('No se pudieron cargar los archivos de esta carpeta.', 'error');
      }
    }
  });

  const archivosGrid = document.getElementById('archivosGrid');
  archivosGrid.addEventListener('click', async event => {
    const remove = event.target.closest('.documentos-eliminar-archivo');
    const edit = event.target.closest('.documentos-editar-archivo');
    const move = event.target.closest('.documentos-mover-pagina');
    if (remove) {
      await eliminarArchivoDocumentos(remove.dataset.archivoId, remove.dataset.archivoPath);
    } else if (edit) {
      const archivo = documentosState.archivos.find(item => item.id === edit.closest('.documentos-archivo').dataset.archivoId);
      if (archivo) await abrirEdicionArchivo(archivo);
    } else if (move) {
      await moverArchivoDocumentos(move.closest('.documentos-archivo').dataset.archivoId, Number(move.dataset.direction));
    }
  });

  archivosGrid.addEventListener('dragstart', event => {
    const item = event.target.closest('.documentos-archivo');
    if (!item || event.target.closest('button')) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', item.dataset.archivoId);
    event.dataTransfer.effectAllowed = 'move';
    item.classList.add('documentos-archivo--arrastrando');
  });
  archivosGrid.addEventListener('dragend', event => {
    event.target.closest('.documentos-archivo')?.classList.remove('documentos-archivo--arrastrando');
    archivosGrid.querySelectorAll('.documentos-archivo--destino').forEach(item => item.classList.remove('documentos-archivo--destino'));
  });
  archivosGrid.addEventListener('dragover', event => {
    const item = event.target.closest('.documentos-archivo');
    if (!item || !Array.from(event.dataTransfer.types).includes('text/plain')) return;
    event.preventDefault();
    item.classList.add('documentos-archivo--destino');
  });
  archivosGrid.addEventListener('dragleave', event => {
    event.target.closest('.documentos-archivo')?.classList.remove('documentos-archivo--destino');
  });
  archivosGrid.addEventListener('drop', async event => {
    const target = event.target.closest('.documentos-archivo');
    const sourceId = event.dataTransfer.getData('text/plain');
    if (!target || !sourceId || event.dataTransfer.files.length || documentosState.cargando) return;
    event.preventDefault();
    const sourceIndex = documentosState.archivos.findIndex(archivo => archivo.id === sourceId);
    const targetIndex = documentosState.archivos.findIndex(archivo => archivo.id === target.dataset.archivoId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const rect = target.getBoundingClientRect();
    const archivos = [...documentosState.archivos];
    const [moved] = archivos.splice(sourceIndex, 1);
    let insertIndex = targetIndex + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
    if (sourceIndex < insertIndex) insertIndex--;
    archivos.splice(insertIndex, 0, moved);
    await guardarOrdenArchivos(archivos);
  });

  try {
    await initSupabase();
    if (!isSupabaseEnabled()) throw new Error('Supabase no está conectado.');
    await cargarLibrosDocumentos();
    setDocumentosStatus('Biblioteca conectada.', 'success');
  } catch (error) {
    console.error('Error inicializando la biblioteca:', error);
    setDocumentosStatus('No fue posible conectar con la biblioteca. Verifica Supabase y ejecuta documentos-schema.sql.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', iniciarDocumentos);