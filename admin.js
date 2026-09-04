function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

if (isSupabaseEnabled() && typeof DB.onTrazabilidadChange === 'function') {
  DB.onTrazabilidadChange(async (payload) => {
    console.log('Cambio en trazabilidad (admin):', payload);
    await renderAdmin();
    await renderTrazabilidad();
  });
}
