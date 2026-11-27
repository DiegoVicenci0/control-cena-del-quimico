import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Map as MapIcon, QrCode, ScanLine, Settings } from 'lucide-react';
import initialData from './data/initialData.json';
import { createSupabaseFromConfig } from './lib/supabaseClient';
import ScannerCheckin from './components/ScannerCheckin';
import DashboardView from './components/DashboardView';
import AcomodoView from './components/AcomodoView';
import QrCardsView from './components/QrCardsView';
import SyncSettingsView from './components/SyncSettingsView';

const LS_DATA_KEY = 'cena_quimico_mesas_v3';
const LS_MOVS_KEY = 'cena_quimico_movimientos_v1';
const LS_EVENT_KEY = 'cena_quimico_event_v1';

const DEFAULT_EVENT = {
  titulo: 'Cena del Químico 2026',
  subtitulo: 'Facultad de Ciencias Químicas · UdeC',
  fecha: 'Viernes, 27 de noviembre de 2026',
  hora: '8:00 PM',
  lugar: 'Pinacoteca Universitaria',
  vestimenta: 'Formal / Etiqueta',
};

function loadLocalMesas() {
  try {
    const raw = window.localStorage.getItem(LS_DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return initialData;
}

function loadLocalMovs() {
  try {
    const raw = window.localStorage.getItem(LS_MOVS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
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
  const [tab, setTab] = useState('scan');
  const [mesas, setMesas] = useState(loadLocalMesas);
  const [movimientos, setMovimientos] = useState(loadLocalMovs);
  const [eventInfo, setEventInfo] = useState(loadLocalEvent);
  const [selectedMesaNum, setSelectedMesaNum] = useState(null);
  const [supabase, setSupabase] = useState(() => createSupabaseFromConfig());
  const [supabaseConnected, setSupabaseConnected] = useState(false);

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

  useEffect(() => {
    window.localStorage.setItem(LS_DATA_KEY, JSON.stringify(mesas));
  }, [mesas]);

  useEffect(() => {
    window.localStorage.setItem(LS_MOVS_KEY, JSON.stringify(movimientos));
  }, [movimientos]);

  useEffect(() => {
    window.localStorage.setItem(LS_EVENT_KEY, JSON.stringify(eventInfo));
  }, [eventInfo]);

  const fetchFromSupabase = useCallback(async (client) => {
    if (!client) {
      setSupabaseConnected(false);
      return;
    }
    try {
      const [
        { data: mData, error: mErr },
        { data: iData, error: iErr },
        { data: cfgData },
        { data: movData },
      ] = await Promise.all([
        client.from('mesas').select('*').order('mesa_num', { ascending: true }),
        client.from('invitados').select('*').order('asiento', { ascending: true }),
        client.from('evento_config').select('*').eq('id', 1).maybeSingle(),
        client.from('movimientos_acceso').select('*').order('registrado_at', { ascending: false }).limit(500),
      ]);

      if (mErr || iErr) {
        setSupabaseConnected(false);
        return;
      }

      setSupabaseConnected(true);
      if (movData) setMovimientos(movData);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos_acceso' }, () => {
        fetchFromSupabase(supabase);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchFromSupabase]);

  const handleRegistrarMovimiento = async (mesaNum, nombre, tipo) => {
    const nowIso = new Date().toISOString();
    const isInside = tipo === 'entrada' || tipo === 'reingreso';

    const newMov = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mesa_num: mesaNum,
      nombre,
      tipo,
      registrado_at: nowIso,
    };

    setMovimientos((prev) => [newMov, ...prev]);

    setMesas((prev) =>
      prev.map((m) =>
        m.mesa_num !== mesaNum
          ? m
          : {
              ...m,
              invitados: m.invitados.map((inv) =>
                inv.nombre === nombre
                  ? {
                      ...inv,
                      asistio: isInside,
                      hora_llegada: inv.hora_llegada || (isInside ? nowIso : null),
                    }
                  : inv
              ),
            }
      )
    );

    if (supabase && supabaseConnected) {
      await Promise.all([
        supabase.from('movimientos_acceso').insert({
          mesa_num: mesaNum,
          nombre,
          tipo,
          registrado_at: nowIso,
        }),
        supabase
          .from('invitados')
          .update({
            asistio: isInside,
            hora_llegada: isInside ? nowIso : undefined,
            updated_at: nowIso,
          })
          .eq('mesa_num', mesaNum)
          .eq('nombre', nombre),
      ]);
    }
  };

  const handleMarkAllMesa = async (mesaNum) => {
    const mesa = mesas.find((m) => m.mesa_num === mesaNum);
    if (!mesa) return;
    for (const inv of mesa.invitados) {
      if (!inv.asistio) {
        const hasMov = movimientos.some((mv) => mv.mesa_num === mesaNum && mv.nombre === inv.nombre);
        await handleRegistrarMovimiento(mesaNum, inv.nombre, hasMov || inv.hora_llegada ? 'reingreso' : 'entrada');
      }
    }
  };

  const handleImportMesas = async (parsedMesas) => {
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
    setMovimientos([]);
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
        {[
          { id: 'scan', label: 'Escáner', Icon: ScanLine },
          { id: 'plano', label: 'Plano', Icon: MapIcon },
          { id: 'dashboard', label: 'Dentro', Icon: LayoutDashboard },
          { id: 'qrcards', label: 'QR', Icon: QrCode },
          { id: 'sync', label: 'Ajustes', Icon: Settings },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {tab === id && (
              <motion.span
                layoutId="nav-pill"
                className="nav-pill-bg"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        >
          {tab === 'scan' && (
            <ScannerCheckin
              mesas={mesas}
              movimientos={movimientos}
              selectedMesaNum={selectedMesaNum}
              onSelectMesa={setSelectedMesaNum}
              onRegistrarMovimiento={handleRegistrarMovimiento}
              onMarkAllMesa={handleMarkAllMesa}
            />
          )}

          {tab === 'plano' && (
            <AcomodoView
              mesas={mesas}
              onOpenMesa={(num) => {
                setSelectedMesaNum(num);
                setTab('scan');
              }}
            />
          )}

          {tab === 'dashboard' && (
            <DashboardView
              mesas={mesas}
              movimientos={movimientos}
              onOpenMesa={(num) => {
                setSelectedMesaNum(num);
                setTab('scan');
              }}
              onRegistrarMovimiento={handleRegistrarMovimiento}
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
              movimientos={movimientos}
              supabaseConnected={supabaseConnected}
              onImportMesas={handleImportMesas}
              onResetLocal={handleResetLocal}
              onReconnectSupabase={handleReconnectSupabase}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
