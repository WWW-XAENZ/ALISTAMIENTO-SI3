const DOCUMENTOS_TIPOS_PERMITIDOS = new Set(['image/png', 'image/jpeg', 'application/pdf', 'text/plain']);

const documentosState = {
  libros: [],
  libroActivo: null,
  archivos: [],
  cargando: false,
  escaneo: null
};

let documentosOpenCvPromise;

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

async function guardarArchivoEnLibro(libro, file, nombre = file.name, tipo = file.type) {
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
      tamano_bytes: file.size
    });
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

async function adjuntarArchivosLibro(files) {
  const libro = documentosState.libroActivo;
  if (!libro || !files.length || documentosState.cargando) return;

  documentosState.cargando = true;
  const button = document.getElementById('btnAgregarArchivos');
  button.disabled = true;
  let adjuntados = 0;

  try {
    for (const file of files) {
      const extension = file.name.toLowerCase().split('.').pop();
      const tipo = file.type || ({ pdf: 'application/pdf', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' })[extension] || '';
      if (!DOCUMENTOS_TIPOS_PERMITIDOS.has(tipo)) {
        setDocumentosStatus(`${file.name}: solo se permiten archivos PNG, JPG, PDF o TXT.`, 'error');
        continue;
      }
      await guardarArchivoEnLibro(libro, file, file.name, tipo);
      adjuntados++;
    }

    await actualizarArchivosLibro(libro);
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
    setDocumentosStatus('Texto guardado en el libro.', 'success');
  } catch (error) {
    console.error('Error guardando texto:', error);
    errorBox.textContent = 'No se pudo guardar el texto. Revisa la conexión y el límite de Supabase Storage.';
  } finally {
    button.disabled = false;
  }
}

function cargarOpenCv() {
  if (window.cv?.Mat) return Promise.resolve(window.cv);
  if (documentosOpenCvPromise) return documentosOpenCvPromise;

  documentosOpenCvPromise = new Promise((resolve, reject) => {
    const moduloPrevio = window.Module || {};
    window.Module = {
      ...moduloPrevio,
      onRuntimeInitialized() {
        moduloPrevio.onRuntimeInitialized?.();
        resolve(window.cv);
      }
    };
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.async = true;
    script.onerror = () => reject(new Error('No se pudo cargar OpenCV.'));
    document.head.appendChild(script);
  });

  return documentosOpenCvPromise;
}

async function crearLienzoEscaneo(file) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

function ordenarPuntosDocumento(points) {
  const suma = point => point.x + point.y;
  const diferencia = point => point.y - point.x;
  return [
    points.reduce((best, point) => suma(point) < suma(best) ? point : best),
    points.reduce((best, point) => diferencia(point) < diferencia(best) ? point : best),
    points.reduce((best, point) => suma(point) > suma(best) ? point : best),
    points.reduce((best, point) => diferencia(point) > diferencia(best) ? point : best)
  ];
}

function distanciaPuntos(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function recortarPerspectivaDocumento(cv, sourceCanvas) {
  const source = cv.imread(sourceCanvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 60, 180);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const candidatos = [];
    for (let index = 0; index < contours.size(); index++) {
      const contour = contours.get(index);
      candidatos.push({ index, area: cv.contourArea(contour) });
      contour.delete();
    }
    candidatos.sort((first, second) => second.area - first.area);

    let esquinas = null;
    for (const candidato of candidatos.slice(0, 20)) {
      const contour = contours.get(candidato.index);
      const aproximado = new cv.Mat();
      const perimetro = cv.arcLength(contour, true);
      cv.approxPolyDP(contour, aproximado, 0.02 * perimetro, true);
      if (aproximado.rows === 4 && candidato.area > sourceCanvas.width * sourceCanvas.height * 0.12) {
        const points = Array.from({ length: 4 }, (_, index) => ({
          x: aproximado.data32S[index * 2],
          y: aproximado.data32S[index * 2 + 1]
        }));
        esquinas = ordenarPuntosDocumento(points);
        aproximado.delete();
        contour.delete();
        break;
      }
      aproximado.delete();
      contour.delete();
    }

    if (!esquinas) return null;

    const [topLeft, topRight, bottomRight, bottomLeft] = esquinas;
    const width = Math.round(Math.max(distanciaPuntos(topLeft, topRight), distanciaPuntos(bottomLeft, bottomRight)));
    const height = Math.round(Math.max(distanciaPuntos(topLeft, bottomLeft), distanciaPuntos(topRight, bottomRight)));
    if (width < 100 || height < 100) return null;

    const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, esquinas.flatMap(point => [point.x, point.y]));
    const destinationPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width - 1, 0, width - 1, height - 1, 0, height - 1]);
    const transform = cv.getPerspectiveTransform(sourcePoints, destinationPoints);
    const corrected = new cv.Mat();
    cv.warpPerspective(source, corrected, transform, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));
    const canvas = document.createElement('canvas');
    cv.imshow(canvas, corrected);
    sourcePoints.delete();
    destinationPoints.delete();
    transform.delete();
    corrected.delete();
    return canvas;
  } finally {
    source.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function dibujarVistaEscaneo() {
  const escaneo = documentosState.escaneo;
  if (!escaneo) return;
  const canvas = document.getElementById('escaneoPreview');
  const visible = escaneo.usarOriginal ? escaneo.original : escaneo.corregido;
  canvas.width = visible.width;
  canvas.height = visible.height;
  canvas.getContext('2d').drawImage(visible, 0, 0);
  document.getElementById('btnAlternarEscaneo').textContent = escaneo.usarOriginal ? 'Ver documento corregido' : 'Ver foto original';
}

async function escanearDocumento(file) {
  const libro = documentosState.libroActivo;
  if (!libro || !file || documentosState.cargando) return;
  if (!DOCUMENTOS_TIPOS_PERMITIDOS.has(file.type)) {
    setDocumentosStatus('La cámara debe entregar una imagen PNG o JPG.', 'error');
    return;
  }

  documentosState.cargando = true;
  const button = document.getElementById('btnEscanear');
  button.disabled = true;
  try {
    setDocumentosStatus('Detectando los bordes y enderezando el documento...');
    const original = await crearLienzoEscaneo(file);
    let corregido = original;
    let mensaje = 'No se detectó una hoja con suficiente claridad. Puedes usar la foto original o volver a tomarla con los cuatro bordes visibles.';
    try {
      corregido = recortarPerspectivaDocumento(await cargarOpenCv(), original) || original;
      if (corregido !== original) mensaje = 'Se detectaron los bordes y se corrigió la perspectiva. Revisa el resultado antes de transcribir.';
    } catch (error) {
      console.warn('No fue posible corregir la perspectiva:', error);
      mensaje = 'No se pudo cargar la corrección automática. Puedes continuar con la foto original.';
    }

    documentosState.escaneo = { libro, file, original, corregido, usarOriginal: corregido === original };
    document.getElementById('escaneoEstado').textContent = mensaje;
    document.getElementById('btnAlternarEscaneo').hidden = corregido === original ? true : false;
    dibujarVistaEscaneo();
    document.getElementById('escanerDialog').showModal();
  } catch (error) {
    console.error('Error preparando el escaneo:', error);
    setDocumentosStatus('No se pudo abrir la imagen. Prueba con una foto JPG o PNG.', 'error');
  } finally {
    documentosState.cargando = false;
    button.disabled = false;
    document.getElementById('inputEscaneo').value = '';
  }
}

async function guardarEscaneoDocumentos() {
  const escaneo = documentosState.escaneo;
  if (!escaneo || documentosState.cargando) return;
  if (!window.Tesseract) {
    document.getElementById('escaneoEstado').textContent = 'No se pudo cargar el lector OCR. Comprueba tu conexión a internet.';
    return;
  }

  documentosState.cargando = true;
  const guardar = document.getElementById('btnGuardarEscaneo');
  guardar.disabled = true;
  try {
    let imagen = escaneo.file;
    if (!escaneo.usarOriginal) {
      const blob = await new Promise((resolve, reject) => escaneo.corregido.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo preparar la imagen corregida.')), 'image/jpeg', 0.92));
      const nombreBase = (escaneo.file.name || `Escaneo-${Date.now()}`).replace(/\.[^.]+$/, '');
      imagen = new File([blob], `${nombreSeguroArchivo(nombreBase)}-escaneado.jpg`, { type: 'image/jpeg' });
    }

    document.getElementById('escaneoEstado').textContent = 'Transcribiendo el documento en español...';
    const resultado = await Tesseract.recognize(imagen, 'spa', {
      logger: info => {
        if (info.status === 'recognizing text' && Number.isFinite(info.progress)) {
          document.getElementById('escaneoEstado').textContent = `Transcribiendo documento: ${Math.round(info.progress * 100)}%`;
        }
      }
    });
    const texto = resultado.data.text.trim();
    await guardarArchivoEnLibro(escaneo.libro, imagen, imagen.name, imagen.type);
    if (texto) {
      const nombreBase = (imagen.name || `Escaneo-${Date.now()}`).replace(/\.[^.]+$/, '');
      const transcripcion = new File([texto], `${nombreSeguroArchivo(nombreBase)}-transcripcion.txt`, { type: 'text/plain' });
      await guardarArchivoEnLibro(escaneo.libro, transcripcion, transcripcion.name, 'text/plain');
    }
    await actualizarArchivosLibro(escaneo.libro);
    document.getElementById('escanerDialog').close();
    setDocumentosStatus(texto ? 'Escaneo guardado junto con su transcripción en español.' : 'Escaneo guardado, pero no se detectó texto legible.', texto ? 'success' : '');
  } catch (error) {
    console.error('Error escaneando documento:', error);
    document.getElementById('escaneoEstado').textContent = 'No se pudo escanear o guardar. Revisa la conexión y el límite de Supabase Storage.';
  } finally {
    documentosState.cargando = false;
    guardar.disabled = false;
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
  const textoDialog = document.getElementById('textoDialog');
  document.getElementById('btnAgregarTexto').addEventListener('click', () => {
    document.getElementById('textoError').textContent = '';
    textoDialog.showModal();
    document.getElementById('textoNombre').focus();
  });
  document.getElementById('btnCerrarTexto').addEventListener('click', () => textoDialog.close());
  document.getElementById('btnCancelarTexto').addEventListener('click', () => textoDialog.close());
  document.getElementById('textoForm').addEventListener('submit', guardarTextoDocumentos);
  document.getElementById('btnEscanear').addEventListener('click', () => document.getElementById('inputEscaneo').click());
  document.getElementById('inputEscaneo').addEventListener('change', event => escanearDocumento(event.target.files[0]));
  const escanerDialog = document.getElementById('escanerDialog');
  document.getElementById('btnCerrarEscaneo').addEventListener('click', () => escanerDialog.close());
  document.getElementById('btnCancelarEscaneo').addEventListener('click', () => escanerDialog.close());
  document.getElementById('btnAlternarEscaneo').addEventListener('click', () => {
    documentosState.escaneo.usarOriginal = !documentosState.escaneo.usarOriginal;
    dibujarVistaEscaneo();
  });
  document.getElementById('btnGuardarEscaneo').addEventListener('click', guardarEscaneoDocumentos);
  escanerDialog.addEventListener('close', () => { documentosState.escaneo = null; });

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