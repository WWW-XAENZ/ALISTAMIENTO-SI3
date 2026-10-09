const DOCUMENTOS_MAX_FILE_SIZE = 20 * 1024 * 1024;
const DOCUMENTOS_TIPOS_PERMITIDOS = new Set(['image/png', 'image/jpeg', 'application/pdf']);

const documentosState = {
  libros: [],
  libroActivo: null,
  archivos: [],
  cargando: false
};

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
    empty.textContent = filtro ? 'No hay libros con ese nombre.' : 'Aún no hay libros creados.';
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
    remove.setAttribute('aria-label', `Eliminar libro ${libro.nombre}`);
    remove.title = 'Eliminar libro';
    remove.textContent = '×';
    row.append(select, remove);
    lista.appendChild(row);
  });
}

async function seleccionarLibroDocumentos(libro, cargar = true) {
  documentosState.libroActivo = libro;
  if (cargar) documentosState.archivos = await DB.getArchivosLibro(libro.id);
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
  grid.replaceChildren();

  if (!archivos.length) {
    const empty = document.createElement('p');
    empty.className = 'documentos-archivos-vacios';
    empty.textContent = 'Este libro todavía no tiene archivos.';
    grid.appendChild(empty);
    return;
  }

  archivos.forEach((archivo, index) => {
    const item = document.createElement('article');
    item.className = 'documentos-archivo';
    const pageNumber = document.createElement('span');
    pageNumber.className = 'documentos-page-number';
    pageNumber.textContent = `PÁGINA ${String(index + 1).padStart(2, '0')}`;
    const preview = document.createElement('a');
    preview.className = 'documentos-archivo-preview';
    preview.href = archivo.url_publica;
    preview.target = '_blank';
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
      pdfIcon.className = 'documentos-pdf-icon';
      pdfIcon.textContent = 'PDF';
      preview.appendChild(pdfIcon);
    }

    const info = document.createElement('div');
    info.className = 'documentos-archivo-info';
    const name = document.createElement('a');
    name.className = 'documentos-archivo-nombre';
    name.href = archivo.url_publica;
    name.target = '_blank';
    name.rel = 'noopener noreferrer';
    name.textContent = archivo.nombre;
    name.title = archivo.nombre;
    const meta = document.createElement('span');
    meta.textContent = `${archivo.tipo_mime === 'application/pdf' ? 'PDF' : 'IMAGEN'} · ${formatearTamanoArchivo(archivo.tamano_bytes)}`;
    info.append(name, meta);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'documentos-icon-button documentos-eliminar-archivo';
    remove.dataset.archivoId = archivo.id;
    remove.dataset.archivoPath = archivo.ruta_storage;
    remove.setAttribute('aria-label', `Eliminar archivo ${archivo.nombre}`);
    remove.title = 'Eliminar archivo';
    remove.textContent = '×';
    item.append(pageNumber, preview, info, remove);
    grid.appendChild(item);
  });
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
    setDocumentosStatus('Libro creado.', 'success');
  } catch (error) {
    console.error('Error creando el libro:', error);
    errorBox.textContent = 'No se pudo crear el libro. Revisa la conexión y vuelve a intentarlo.';
  } finally {
    button.disabled = false;
  }
}

function nombreSeguroArchivo(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function adjuntarArchivosLibro(files) {
  const libro = documentosState.libroActivo;
  if (!libro || !files.length || documentosState.cargando) return;

  documentosState.cargando = true;
  const button = document.getElementById('btnAgregarArchivos');
  button.disabled = true;
  let adjuntados = 0;

  try {
    for (const file of files) {
      const tipo = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
      if (!DOCUMENTOS_TIPOS_PERMITIDOS.has(tipo)) {
        setDocumentosStatus(`${file.name}: solo se permiten archivos PNG, JPG o PDF.`, 'error');
        continue;
      }
      if (file.size > DOCUMENTOS_MAX_FILE_SIZE) {
        setDocumentosStatus(`${file.name}: supera el límite de 20 MB.`, 'error');
        continue;
      }

      const path = `${libro.id}/${crypto.randomUUID()}-${nombreSeguroArchivo(file.name)}`;
      const ruta = await DB.uploadArchivoLibro(path, file);
      try {
        const url = DB.getUrlArchivoLibro(ruta);
        await DB.saveArchivoLibro({
          libro_id: libro.id,
          nombre: file.name,
          ruta_storage: ruta,
          url_publica: url,
          tipo_mime: tipo,
          tamano_bytes: file.size
        });
        adjuntados++;
      } catch (error) {
        await DB.removeArchivoLibro(ruta);
        throw error;
      }
    }

    documentosState.archivos = await DB.getArchivosLibro(libro.id);
    renderArchivosLibroDocumentos();
    await cargarLibrosDocumentos();
    if (adjuntados) setDocumentosStatus(`${adjuntados} archivo(s) adjuntado(s).`, 'success');
  } catch (error) {
    console.error('Error adjuntando documentos:', error);
    setDocumentosStatus('No se pudieron guardar todos los archivos. Revisa la configuración de Supabase Storage.', 'error');
  } finally {
    documentosState.cargando = false;
    button.disabled = false;
    document.getElementById('inputArchivos').value = '';
  }
}

async function eliminarLibroDocumentos(id) {
  const libro = documentosState.libros.find(item => item.id === id);
  if (!libro || !confirm(`¿Eliminar el libro "${libro.nombre}" y todos sus archivos?`)) return;

  try {
    const archivos = await DB.getArchivosLibro(id);
    await DB.deleteLibro(id, archivos.map(archivo => archivo.ruta_storage));
    if (documentosState.libroActivo?.id === id) {
      documentosState.libroActivo = null;
      documentosState.archivos = [];
      renderDetalleLibroDocumentos();
    }
    await cargarLibrosDocumentos();
    setDocumentosStatus('Libro eliminado.', 'success');
  } catch (error) {
    console.error('Error eliminando el libro:', error);
    setDocumentosStatus('No se pudo eliminar el libro y sus archivos.', 'error');
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
        console.error('Error cargando archivos del libro:', error);
        setDocumentosStatus('No se pudieron cargar los archivos de este libro.', 'error');
      }
    }
  });

  document.getElementById('archivosGrid').addEventListener('click', async event => {
    const remove = event.target.closest('.documentos-eliminar-archivo');
    if (!remove) return;
    await eliminarArchivoDocumentos(remove.dataset.archivoId, remove.dataset.archivoPath);
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