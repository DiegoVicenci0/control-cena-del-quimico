import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, QrCode, ScanLine, Settings } from 'lucide-react';
import initialData from './data/initialData.json';
import { createSupabaseFromConfig } from './lib/supabaseClient';
import ScannerCheckin from './components/ScannerCheckin';
import DashboardView from './components/DashboardView';
import QrCardsView from './components/QrCardsView';
import SyncSettingsView from './components/SyncSettingsView';

const LS_DATA_KEY = 'cena_quimico_mesas_v1';
const LS_EVENT_KEY = 'cena_quimico_event_v1';

const DEFAULT_EVENT = {
  titulo: 'Cena del Químico 2026',
  subtitulo: 'Facultad de Ciencias Químicas · UdeC',
  fecha: 'Por confirmar',
  hora: '8:00 PM',
  lugar: 'Salón del Evento',
  vestimenta: 'Formal / Etiqueta',
};

function loadLocalMesas() {
  try {
    const raw = window.localStorage.getItem(LS_DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse error
  }
  return initialData;
}

function loadLocalEvent() {
  try {
    const raw = window.localStorage.getItem(LS_EVENT_KEY);
    if (raw) return { ...DEFAULT_EVENT, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_EVENT;
}

export default function App() {
  const [tab, setTab] = useState('scan'); // scan | dashboard | qrcards | sync
  const [mesas, setMesas] = useState(loadLocalMesas);
  const [eventInfo, setEventInfo] = useState(loadLocalEvent);
  const [selectedMesaNum, setSelectedMesaNum] = useState(null);
  const [supabase, setSupabase] = useState(() => createSupabaseFromConfig());
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  // Detect ?mesa=N in URL when opening a QR link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesaParam = params.get('mesa');
    if (mesaParam) {
      const num = parseInt(mesaParam, 10);
      if (!Number.isNaN(num)) {
        setSelectedMesaNum(num);
        setTab('scan');
      }
    }
  }, []);

  // Persist locally as offline/backup cache
  useEffect(() => {
    window.localStorage.setItem(LS_DATA_KEY, JSON.stringify(mesas));
  }, [mesas]);

  useEffect(() => {
    window.localStorage.setItem(LS_EVENT_KEY, JSON.stringify(eventInfo));
  }, [eventInfo]);

  const fetchFromSupabase = useCallback(async (client) => {
    if (!client) {
      setSupabaseConnected(false);
      return;
    }
    try {
      const [{ data: mData, error: mErr }, { data: iData, error: iErr }, { data: cfgData }] =
        await Promise.all([
          client.from('mesas').select('*').order('mesa_num', { ascending: true }),
          client.from('invitados').select('*').order('asiento', { ascending: true }),
          client.from('evento_config').select('*').eq('id', 1).maybeSingle(),
        ]);

      if (mErr || iErr) {
        setSupabaseConnected(false);
        return;
      }

      setSupabaseConnected(true);
      if (cfgData) {
        setEventInfo((prev) => ({
          ...prev,
          titulo: cfgData.titulo || prev.titulo,
          subtitulo: cfgData.subtitulo || prev.subtitulo,
          fecha: cfgData.fecha || prev.fecha,
          hora: cfgData.hora || prev.hora,
          lugar: cfgData.lugar || prev.lugar,
          vestimenta: cfgData.vestimenta || prev.vestimenta,
        }));
      }

      if (mData && mData.length > 0) {
        const grouped = mData.map((m) => ({
          mesa_num: m.mesa_num,
          nombre_mesa: m.nombre_mesa,
          capacidad: m.capacidad,
          invitados: (iData || [])
            .filter((inv) => inv.mesa_num === m.mesa_num)
            .map((inv) => ({
              id: inv.id,
              asiento: inv.asiento,
              nombre: inv.nombre,
              pago_monto: Number(inv.pago_monto || 0),
              pago_estado: inv.pago_estado,
              nota: inv.nota,
              asistio: Boolean(inv.asistio),
              hora_llegada: inv.hora_llegada,
            })),
        }));
        setMesas(grouped);
      }
    } catch {
      setSupabaseConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setSupabaseConnected(false);
      return;
    }
    fetchFromSupabase(supabase);

    const channel = supabase
      .channel('cena-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitados' }, () => {
        fetchFromSupabase(supabase);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchFromSupabase]);

  const handleToggleAsistencia = async (mesaNum, nombre, nextVal) => {
    const timestamp = nextVal ? new Date().toISOString() : null;
    setMesas((prev) =>
      prev.map((m) =>
        m.mesa_num !== mesaNum
          ? m
          : {
              ...m,
              invitados: m.invitados.map((inv) =>
                inv.nombre === nombre ? { ...inv, asistio: nextVal, hora_llegada: timestamp } : inv
              ),
            }
      )
    );

    if (supabase && supabaseConnected) {
      await supabase
        .from('invitados')
        .update({ asistio: nextVal, hora_llegada: timestamp, updated_at: new Date().toISOString() })
        .eq('mesa_num', mesaNum)
        .eq('nombre', nombre);
    }
  };

  const handleMarkAllMesa = async (mesaNum, nextVal) => {
    const timestamp = nextVal ? new Date().toISOString() : null;
    setMesas((prev) =>
      prev.map((m) =>
        m.mesa_num !== mesaNum
          ? m
          : {
              ...m,
              invitados: m.invitados.map((inv) => ({
                ...inv,
                asistio: nextVal,
                hora_llegada: timestamp,
              })),
            }
      )
    );

    if (supabase && supabaseConnected) {
      await supabase
        .from('invitados')
        .update({ asistio: nextVal, hora_llegada: timestamp, updated_at: new Date().toISOString() })
        .eq('mesa_num', mesaNum);
    }
  };

  const handleImportMesas = async (parsedMesas) => {
    // Preserve existing check-in status by (mesa_num + nombre)
    const existingMap = new Map();
    for (const m of mesas) {
      for (const inv of m.invitados) {
        existingMap.set(`${m.mesa_num}::${inv.nombre.toUpperCase()}`, {
          asistio: inv.asistio,
          hora_llegada: inv.hora_llegada,
        });
      }
    }

    const merged = parsedMesas.map((m) => ({
      ...m,
      invitados: m.invitados.map((inv) => {
        const prev = existingMap.get(`${m.mesa_num}::${inv.nombre.toUpperCase()}`);
        return {
          ...inv,
          asistio: prev ? prev.asistio : false,
          hora_llegada: prev ? prev.hora_llegada : null,
        };
      }),
    }));

    setMesas(merged);

    if (supabase && supabaseConnected) {
      const mesaRows = merged.map((m) => ({
        mesa_num: m.mesa_num,
        nombre_mesa: m.nombre_mesa,
        capacidad: m.capacidad,
      }));
      await supabase.from('mesas').upsert(mesaRows, { onConflict: 'mesa_num' });

      const invRows = [];
      for (const m of merged) {
        for (const inv of m.invitados) {
          invRows.push({
            mesa_num: m.mesa_num,
            asiento: inv.asiento,
            nombre: inv.nombre,
            pago_monto: inv.pago_monto,
            pago_estado: inv.pago_estado,
            nota: inv.nota,
            asistio: inv.asistio,
            hora_llegada: inv.hora_llegada,
          });
        }
      }
      await supabase.from('invitados').upsert(invRows, { onConflict: 'mesa_num,nombre' });
    }
  };

  const handleUpdateEventInfo = async (nextInfo) => {
    setEventInfo(nextInfo);
    if (supabase && supabaseConnected) {
      await supabase.from('evento_config').upsert({ id: 1, ...nextInfo });
    }
  };

  const handleResetLocal = () => {
    setMesas(initialData);
  };

  const handleReconnectSupabase = () => {
    setSupabase(createSupabaseFromConfig());
  };

  const { insideCount, totalCount } = useMemo(() => {
    let inside = 0;
    let total = 0;
    for (const m of mesas) {
      for (const inv of m.invitados) {
        total += 1;
        if (inv.asistio) inside += 1;
      }
    }
    return { insideCount: inside, totalCount: total };
  }, [mesas]);

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <div className="brand">
          <h1>{eventInfo.titulo} · Control de Acceso</h1>
          <p>{eventInfo.subtitulo}</p>
        </div>
        <div className="live-pill">
          <span className={`live-dot ${supabaseConnected ? '' : 'local'}`} />
          <span className="live-count">
            {insideCount} / {totalCount} adentro
          </span>
        </div>
      </header>

      <nav className="nav-tabs no-print">
        <button className={`nav-tab ${tab === 'scan' ? 'active' : ''}`} onClick={() => setTab('scan')}>
          <ScanLine size={17} /> Escáner / Check-in
        </button>
        <button className={`nav-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          <LayoutDashboard size={17} /> Gente Dentro
        </button>
        <button className={`nav-tab ${tab === 'qrcards' ? 'active' : ''}`} onClick={() => setTab('qrcards')}>
          <QrCode size={17} /> Tarjetas QR
        </button>
        <button className={`nav-tab ${tab === 'sync' ? 'active' : ''}`} onClick={() => setTab('sync')}>
          <Settings size={17} /> Excel / Supabase
        </button>
      </nav>

      {tab === 'scan' && (
        <ScannerCheckin
          mesas={mesas}
          selectedMesaNum={selectedMesaNum}
          onSelectMesa={setSelectedMesaNum}
          onToggleAsistencia={handleToggleAsistencia}
          onMarkAllMesa={handleMarkAllMesa}
        />
      )}

      {tab === 'dashboard' && (
        <DashboardView
          mesas={mesas}
          onOpenMesa={(num) => {
            setSelectedMesaNum(num);
            setTab('scan');
          }}
          onToggleAsistencia={handleToggleAsistencia}
        />
      )}

      {tab === 'qrcards' && (
        <QrCardsView
          mesas={mesas}
          eventInfo={eventInfo}
          onUpdateEventInfo={handleUpdateEventInfo}
        />
      )}

      {tab === 'sync' && (
        <SyncSettingsView
          mesas={mesas}
          supabaseConnected={supabaseConnected}
          onImportMesas={handleImportMesas}
          onResetLocal={handleResetLocal}
          onReconnectSupabase={handleReconnectSupabase}
        />
      )}
    </div>
  );
}
