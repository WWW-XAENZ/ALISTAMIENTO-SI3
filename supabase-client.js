// ============================================
// SUPABASE CLIENT - Sistema de Alistamiento
// ============================================

const SUPABASE_URL = 'https://hvpiuufkjqhqlibippzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cGl1dWZranFocWxpYmlwcHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NzU3NTksImV4cCI6MjEwMzQ1MTc1OX0.nM31zwKAgJoX_tOM0LbJ6g4AXEb2yPEpgk0INhjSCO4';

let supabaseClient = null;
let useSupabase = false;

async function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.warn('Supabase no cargado, usando localStorage');
    return false;
  }

  if (!SUPABASE_URL || SUPABASE_URL.includes('TU_SUPABASE_URL')) {
    console.warn('Supabase no configurado, usando localStorage');
    useSupabase = false;
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    useSupabase = true;
    console.log('Supabase conectado');
    return true;
  } catch (e) {
    console.error('Error conectando Supabase:', e);
    useSupabase = false;
    supabaseClient = null;
    return false;
  }
}

function isSupabaseEnabled() {
  return useSupabase && supabaseClient !== null;
}

// ============================================
// ABSTRACCIÓN DE DATOS
// ============================================

const DB = {
  async getRegistros() {
    if (!isSupabaseEnabled()) return [];
    
    try {
      const { data, error } = await supabaseClient
        .from('registros')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error obteniendo registros:', error);
        return [];
      }
      
      const rows = Array.isArray(data) ? data : [];
      return agruparRegistros(rows);
    } catch (e) {
      console.error('Error en getRegistros():', e);
      return [];
    }
  },

  async saveRegistro(registro) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('registros')
      .insert(registro);
    
    if (error) {
      console.error('Error guardando registro:', error);
      throw error;
    }
  },

  async updateRegistro(id, updates) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('registros')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      console.error('Error actualizando registro:', error);
      throw error;
    }
  },

  async deleteRegistro(id) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('registros')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error eliminando registro:', error);
      throw error;
    }
  },

  async deleteGrupo(grupoId) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('registros')
      .delete()
      .eq('grupo_id', grupoId);
    
    if (error) {
      console.error('Error eliminando grupo:', error);
      throw error;
    }
  },

  async getProductos() {
    if (!isSupabaseEnabled()) return [];
    
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*, producto_componentes(*)')
      .order('nombre');
    
    if (error) {
      console.error('Error obteniendo productos:', error);
      return [];
    }
    
    return data || [];
  },

  async getProductoByReferencia(referencia) {
    if (!isSupabaseEnabled()) return null;
    
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*, producto_componentes(*)')
      .eq('referencia', referencia)
      .single();
    
    if (error) {
      console.error('Error obteniendo producto:', error);
      return null;
    }
    
    return data;
  },

  async getTrazabilidad() {
    if (!isSupabaseEnabled()) return [];
    
    try {
      const { data, error } = await supabaseClient
        .from('trazabilidad')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error obteniendo trazabilidad:', error);
        return [];
      }
      
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error en getTrazabilidad():', e);
      return [];
    }
  },

  async saveTrazabilidad(registro) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('trazabilidad')
      .insert(registro);
    
    if (error) {
      console.error('Error guardando trazabilidad:', error);
      throw error;
    }
  },

  async deleteTrazabilidad(id) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('trazabilidad')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error eliminando trazabilidad:', error);
      throw error;
    }
  },

  onRegistrosChange(callback) {
    if (!isSupabaseEnabled()) return () => {};
    
    const channel = supabaseClient
      .channel('registros-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'registros' },
        callback
      )
      .subscribe();
    
    return () => supabaseClient.removeChannel(channel);
  },

  onTrazabilidadChange(callback) {
    if (!isSupabaseEnabled()) return () => {};
    
    const channel = supabaseClient
      .channel('trazabilidad-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'trazabilidad' },
        callback
      )
      .subscribe();
    
    return () => supabaseClient.removeChannel(channel);
  },

  onBoardFotosChange(callback) {
    if (!isSupabaseEnabled()) return () => {};
    
    const channel = supabaseClient
      .channel('board_fotos-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'board_fotos' },
        callback
      )
      .subscribe();
    
    return () => supabaseClient.removeChannel(channel);
  },

  async getBoardFotos() {
    if (!isSupabaseEnabled()) return [];
    
    try {
      const { data, error } = await supabaseClient
        .from('board_fotos')
        .select('*')
        .order('orden', { ascending: true });
      
      if (error) {
        console.error('Error obteniendo board_fotos:', error);
        return [];
      }
      
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error en getBoardFotos():', e);
      return [];
    }
  },

  async saveBoardFoto(foto) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('board_fotos')
      .insert(foto);
    
    if (error) {
      console.error('Error guardando board_foto:', error);
      throw error;
    }
  },

  async deleteBoardFoto(id) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('board_fotos')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error eliminando board_foto:', error);
      throw error;
    }
  },

  async updateBoardFoto(id, updates) {
    if (!isSupabaseEnabled()) return;
    
    const { error } = await supabaseClient
      .from('board_fotos')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      console.error('Error actualizando board_foto:', error);
      throw error;
    }
  }
};

// ============================================
// HELPERS
// ============================================

function agruparRegistros(registros) {
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

// ============================================
// EXPORTAR
// ============================================

window.SupabaseDB = DB;
window.initSupabase = initSupabase;
window.isSupabaseEnabled = isSupabaseEnabled;
