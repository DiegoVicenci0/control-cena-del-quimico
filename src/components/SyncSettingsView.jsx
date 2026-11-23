import React, { useState } from 'react';
import { Database, Download, FileSpreadsheet, RotateCcw, Save } from 'lucide-react';
import { exportAsistenciaExcel, parseCenaExcel } from '../lib/excelSync';
import { clearSupabaseConfig, getSupabaseConfig, saveSupabaseConfig } from '../lib/supabaseClient';

export default function SyncSettingsView({
  mesas,
  supabaseConnected,
  onImportMesas,
  onResetLocal,
  onReconnectSupabase,
}) {
  const cfg = getSupabaseConfig();
  const [url, setUrl] = useState(cfg.url);
  const [anonKey, setAnonKey] = useState(cfg.anonKey);
  const [statusMsg, setStatusMsg] = useState('');

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseCenaExcel(file);
      if (!parsed.length) {
        setStatusMsg('No se detectaron mesas en ese Excel. Verifica que la hoja se llame "cena".');
        return;
      }
      await onImportMesas(parsed);
      const count = parsed.reduce((acc, m) => acc + m.invitados.length, 0);
      setStatusMsg(`Excel sincronizado: ${parsed.length} mesas y ${count} invitados actualizados (se conservaron las asistencias previas).`);
    } catch (err) {
      setStatusMsg(`Error leyendo Excel: ${err.message}`);
    }
    e.target.value = '';
  };

  const handleSaveSupabase = () => {
    saveSupabaseConfig(url, anonKey);
    onReconnectSupabase();
    setStatusMsg('Configuración de Supabase guardada. Recargando datos...');
  };

  const handleClearSupabase = () => {
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    onReconnectSupabase();
    setStatusMsg('Conexión local limpiada.');
  };

  return (
    <div>
      <div className="card">
        <h2 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>
          <FileSpreadsheet size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Sincronizar con Excel (`Cena del quimico acomodo.xlsx`)
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Sube tu archivo `.xlsx` actualizado para cargar cambios de nombres, mesas o pagos sin perder quién ya registró entrada. También puedes descargar el reporte de asistencia en Excel.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            <FileSpreadsheet size={16} /> Cargar / Actualizar desde Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display: 'none' }} />
          </label>
          <button className="btn btn-green" onClick={() => exportAsistenciaExcel(mesas)}>
            <Download size={16} /> Descargar Asistencia en Excel
          </button>
          <button className="btn" onClick={onResetLocal}>
            <RotateCcw size={16} /> Restaurar respaldo inicial
          </button>
        </div>

        {statusMsg && (
          <p style={{ marginTop: 12, fontSize: '0.88rem', color: '#6ee7b7', fontWeight: 600 }}>{statusMsg}</p>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>
          <Database size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Conexión a Supabase (Base independiente del evento)
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Estado actual:{' '}
          <strong style={{ color: supabaseConnected ? 'var(--green)' : 'var(--amber)' }}>
            {supabaseConnected ? 'Conectado en tiempo real a Supabase' : 'Modo respaldo local (sin Supabase conectado aún)'}
          </strong>
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Supabase Project URL</label>
            <input
              className="input"
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={cfg.fromEnv}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Supabase Anon Public Key</label>
            <input
              className="input"
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              disabled={cfg.fromEnv}
            />
          </div>
          {!cfg.fromEnv && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSaveSupabase}>
                <Save size={16} /> Guardar y conectar
              </button>
              <button className="btn" onClick={handleClearSupabase}>
                Desconectar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
