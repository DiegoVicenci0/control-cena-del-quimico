import React, { useMemo, useState } from 'react';
import { Clock, LogIn, LogOut, RotateCw, Search } from 'lucide-react';
import { formatExactDateTime, PaymentBadge } from './ScannerCheckin';

export default function DashboardView({ mesas, movimientos, onOpenMesa, onRegistrarMovimiento }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | inside | exited | pending | log

  const movsByGuest = useMemo(() => {
    const map = new Map();
    for (const mv of movimientos) {
      const key = `${mv.mesa_num}::${mv.nombre}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(mv);
    }
    return map;
  }, [movimientos]);

  const stats = useMemo(() => {
    let totalRegistered = 0;
    let totalInside = 0;
    let totalExited = 0;
    let totalPaid = 0;

    for (const m of mesas) {
      for (const inv of m.invitados) {
        totalRegistered += 1;
        const guestMovs = movsByGuest.get(`${m.mesa_num}::${inv.nombre}`) || [];
        const hasEntered = guestMovs.length > 0 || Boolean(inv.hora_llegada);
        if (inv.asistio) totalInside += 1;
        else if (hasEntered) totalExited += 1;
        totalPaid += Number(inv.pago_monto || 0);
      }
    }
    return {
      totalRegistered,
      totalInside,
      totalExited,
      pendingArrival: totalRegistered - totalInside - totalExited,
      totalPaid,
    };
  }, [mesas, movsByGuest]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [];
    for (const m of mesas) {
      for (const inv of m.invitados) {
        const guestMovs = movsByGuest.get(`${m.mesa_num}::${inv.nombre}`) || [];
        const hasEntered = guestMovs.length > 0 || Boolean(inv.hora_llegada);
        if (filter === 'inside' && !inv.asistio) continue;
        if (filter === 'exited' && (inv.asistio || !hasEntered)) continue;
        if (filter === 'pending' && (inv.asistio || hasEntered)) continue;
        if (
          q &&
          !inv.nombre.toLowerCase().includes(q) &&
          !m.nombre_mesa.toLowerCase().includes(q) &&
          !`mesa ${m.mesa_num}`.includes(q)
        ) {
          continue;
        }
        list.push({ mesa: m, inv, guestMovs, hasEntered });
      }
    }
    return list;
  }, [mesas, movsByGuest, query, filter]);

  const mesaNameMap = useMemo(() => new Map(mesas.map((m) => [m.mesa_num, m.nombre_mesa])), [mesas]);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Adentro Ahora</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {stats.totalInside} <span style={{ fontSize: '1rem', color: 'var(--muted)' }}>/ {stats.totalRegistered}</span>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Salieron (Afuera)</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{stats.totalExited}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Sin Llegar</div>
          <div className="stat-value" style={{ color: '#fda4af' }}>{stats.pendingArrival}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Movimientos (Bitácora)</div>
          <div className="stat-value" style={{ color: '#7dd3fc' }}>{movimientos.length}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Buscar invitado o mesa..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilter('all')}>
              Mesas
            </button>
            <button className={`btn btn-sm ${filter === 'inside' ? 'btn-green' : ''}`} onClick={() => setFilter('inside')}>
              Adentro ({stats.totalInside})
            </button>
            <button className={`btn btn-sm ${filter === 'exited' ? 'btn-primary' : ''}`} onClick={() => setFilter('exited')}>
              Salieron ({stats.totalExited})
            </button>
            <button className={`btn btn-sm ${filter === 'pending' ? 'btn-danger' : ''}`} onClick={() => setFilter('pending')}>
              Sin llegar ({stats.pendingArrival})
            </button>
            <button className={`btn btn-sm ${filter === 'log' ? 'btn-primary' : ''}`} onClick={() => setFilter('log')}>
              <Clock size={14} /> Bitácora ({movimientos.length})
            </button>
          </div>
        </div>

        {filter === 'log' ? (
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: 0 }}>
              Historial cronológico con fecha y hora exacta (más reciente arriba):
            </p>
            {movimientos.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Aún no hay entradas o salidas registradas.</p>
            ) : (
              <div className="log-list">
                {movimientos.map((mv) => (
                  <div key={mv.id || `${mv.mesa_num}-${mv.nombre}-${mv.registrado_at}`} className="log-item">
                    <div>
                      <span
                        className={`badge ${
                          mv.tipo === 'entrada'
                            ? 'badge-paid'
                            : mv.tipo === 'salida'
                              ? 'badge-pending'
                              : 'badge-premio'
                        }`}
                        style={{ marginRight: 8 }}
                      >
                        {mv.tipo.toUpperCase()}
                      </span>
                      <strong>{mv.nombre}</strong>
                      <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                        Mesa {mv.mesa_num} ({mesaNameMap.get(mv.mesa_num) || ''})
                      </span>
                    </div>
                    <div style={{ color: '#fef08a', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatExactDateTime(mv.registrado_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (query.trim() || filter !== 'all') ? (
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: 0 }}>
              {searchResults.length} resultados
            </p>
            {searchResults.slice(0, 80).map(({ mesa, inv, guestMovs, hasEntered }) => {
              const lastMov = guestMovs[0];
              return (
                <div
                  key={`${mesa.mesa_num}-${inv.nombre}`}
                  className={`guest-row ${inv.asistio ? 'checked' : hasEntered ? 'exited' : ''}`}
                  style={{ cursor: 'default' }}
                >
                  <div style={{ flex: '1 1 220px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <strong>{inv.nombre}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 3 }}>
                      Mesa {mesa.mesa_num} · {mesa.nombre_mesa} (Asiento {inv.asiento})
                      {lastMov ? ` · ${lastMov.tipo.toUpperCase()} ${formatExactDateTime(lastMov.registrado_at)}` : ''}
                    </div>
                  </div>
                  <div className="guest-actions">
                    {inv.asistio ? (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onRegistrarMovimiento(mesa.mesa_num, inv.nombre, 'salida')}
                      >
                        <LogOut size={14} /> Salida
                      </button>
                    ) : hasEntered ? (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => onRegistrarMovimiento(mesa.mesa_num, inv.nombre, 'reingreso')}
                      >
                        <RotateCw size={14} /> Reingreso
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-green"
                        onClick={() => onRegistrarMovimiento(mesa.mesa_num, inv.nombre, 'entrada')}
                      >
                        <LogIn size={14} /> Entrada
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mesas-grid">
            {mesas.map((m) => {
              const inside = m.invitados.filter((i) => i.asistio).length;
              const total = m.invitados.length;
              const pct = total > 0 ? Math.round((inside / total) * 100) : 0;
              return (
                <div key={m.mesa_num} className="mesa-card" onClick={() => onOpenMesa(m.mesa_num)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-premio">Mesa {m.mesa_num}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: inside > 0 ? 'var(--green)' : 'var(--muted)' }}>
                      {inside} / {total} adentro
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 8, fontSize: '0.96rem' }}>{m.nombre_mesa}</div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
