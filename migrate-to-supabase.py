#!/usr/bin/env python3
"""
Migra Registros.json a SQL para Supabase.
Uso: python migrate-to-supabase.py
"""

import json
import os

def main():
    json_path = os.path.join(os.path.dirname(__file__), 'Registros.json')
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    materiales = data.get('materiales', [])
    
    print("-- ============================================")
    print("-- MIGRACIÓN: Catálogo de Productos")
    print("-- ============================================\n")
    
    productos_inserts = []
    componentes_inserts = []
    producto_ids = {}
    
    for mat in materiales:
        nombre = mat.get('producto', '').replace("'", "''")
        # Usar el nombre como referencia por defecto
        referencia = mat.get('referencia', nombre).replace("'", "''")
        
        # Insertar producto
        prod_sql = f"INSERT INTO productos (nombre, referencia) VALUES ('{nombre}', '{referencia}') RETURNING id;"
        productos_inserts.append(prod_sql)
        
        # Como no podemos usar RETURNING en script plano, generamos UUIDs
        import uuid
        prod_id = str(uuid.uuid4())
        producto_ids[nombre] = prod_id
        
        # Componentes base (tipo Base, Forro, Pin, etc.)
        componentes = mat.get('componentes', [])
        for i, comp in enumerate(componentes):
            tipo = comp.get('tipo', '').replace("'", "''")
            codigo = comp.get('codigo', '').replace("'", "''")
            descripcion = comp.get('descripcion', '')
            if descripcion:
                descripcion = descripcion.replace("'", "''")
            
            # Determinar categoría
            tipo_lower = tipo.lower()
            if tipo_lower == 'base':
                categoria = 'base'
            elif tipo_lower == 'pin':
                categoria = 'pin'
            elif 'forro' in tipo_lower:
                categoria = 'base'
            else:
                categoria = 'base'
            
            comp_sql = f"INSERT INTO producto_componentes (id, producto_id, tipo, codigo, descripcion, categoria, orden) VALUES ('{uuid.uuid4()}', '{prod_id}', '{tipo}', '{codigo}', '{descripcion}', '{categoria}', {i});"
            componentes_inserts.append(comp_sql)
        
        # Componentes adicionales
        adicionales = mat.get('componentes_adicionales', [])
        for i, comp in enumerate(adicionales):
            tipo = comp.get('tipo', 'Adicional').replace("'", "''")
            codigo = comp.get('codigo', '').replace("'", "''")
            descripcion = comp.get('descripcion', '')
            if descripcion:
                descripcion = descripcion.replace("'", "''")
            cantidad = comp.get('cantidad_por_base', 1)
            
            comp_sql = f"INSERT INTO producto_componentes (id, producto_id, tipo, codigo, descripcion, cantidad_por_base, categoria, orden) VALUES ('{uuid.uuid4()}', '{prod_id}', '{tipo}', '{codigo}', '{descripcion}', {cantidad}, 'adicional', {len(componentes) + i});"
            componentes_inserts.append(comp_sql)
        
        # Kits
        kits = mat.get('kits', [])
        for i, kit in enumerate(kits):
            tipo = kit.get('tipo', 'Kit').replace("'", "''")
            codigo = kit.get('codigo', '').replace("'", "''")
            cantidad = kit.get('cantidad_por_base', 1)
            
            kit_sql = f"INSERT INTO producto_componentes (id, producto_id, tipo, codigo, cantidad_por_base, categoria, orden) VALUES ('{uuid.uuid4()}', '{prod_id}', '{tipo}', '{codigo}', {cantidad}, 'kit', {len(componentes) + len(adicionales) + i});"
            componentes_inserts.append(kit_sql)
        
        # Anti-vibrantes
        anti = mat.get('anti_vibrantes', [])
        for i, av in enumerate(anti):
            tipo = av.get('tipo', 'Anti-vibrante').replace("'", "''")
            codigo = av.get('codigo', '').replace("'", "''")
            descripcion = av.get('descripcion', '')
            if descripcion:
                descripcion = descripcion.replace("'", "''")
            cantidad = av.get('cantidad_por_base', 1)
            
            av_sql = f"INSERT INTO producto_componentes (id, producto_id, tipo, codigo, descripcion, cantidad_por_base, categoria, orden) VALUES ('{uuid.uuid4()}', '{prod_id}', '{tipo}', '{codigo}', '{descripcion}', {cantidad}, 'anti_vibrante', {len(componentes) + len(adicionales) + len(kits) + i});"
            componentes_inserts.append(av_sql)
    
    # Generar archivo de salida
    output_path = os.path.join(os.path.dirname(__file__), 'supabase-migration.sql')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("-- ============================================\n")
        f.write("-- MIGRACIÓN: Catálogo de Productos y Componentes\n")
        f.write("-- Generado desde Registros.json\n")
        f.write("-- ============================================\n\n")
        
        f.write("-- Limpiar tablas existentes (opcional)\n")
        f.write("-- TRUNCATE producto_componentes, productos CASCADE;\n\n")
        
        f.write("-- Insertar productos\n")
        for sql in productos_inserts:
            f.write(sql + "\n")
        
        f.write("\n-- Insertar componentes\n")
        for sql in componentes_inserts:
            f.write(sql + "\n")
    
    print(f"✅ Migración generada: {output_path}")
    print(f"   - {len(productos_inserts)} productos")
    print(f"   - {len(componentes_inserts)} componentes")
    print(f"\n📋 Siguiente paso:")
    print(f"   1. Crea el schema ejecutando 'supabase-schema.sql' en Supabase SQL Editor")
    print(f"   2. Ejecuta 'supabase-migration.sql' para cargar los datos")
    print(f"   3. Copia tu Supabase URL y ANON KEY a 'config.js'")

if __name__ == '__main__':
    main()
