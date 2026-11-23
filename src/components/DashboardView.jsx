import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { PaymentBadge } from './ScannerCheckin';

export default function DashboardView({ mesas, onOpenMesa, onToggleAsistencia }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | inside | pending

  const stats = useMemo(() => {
    let totalRegistered = 0;
    let totalInside = 0;
    let totalPaid = 0;
    for (const m of mesas) {
      for (const inv of m.invitados) {
        totalRegistered += 1;
        if (inv.asistio) totalInside += 1;
        totalPaid += Number(inv.pago_monto || 0);
      }
    }
    return {
      totalRegistered,
      totalInside,
      pendingArrival: totalRegistered - totalInside,
      totalPaid,
    };
  }, [mesas]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [];
    for (const m of mesas) {
      for (const inv of m.invitados) {
        if (filter === 'inside' && !inv.asistio) continue;
        if (filter === 'pending' && inv.asistio) continue;
        if (
          q &&
          !inv.nombre.toLowerCase().includes(q) &&
          !m.nombre_mesa.toLowerCase().includes(q) &&
          !`mesa ${m.mesa_num}`.includes(q)
        ) {
          continue;
        }
        list.push({ mesa: m, inv });
      }
    }
    return list;
  }, [mesas, query, filter]);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Gente Dentro</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {stats.totalInside} <span style={{ fontSize: '1rem', color: 'var(--muted)' }}>/ {stats.totalRegistered}</span>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Faltan por Llegar</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{stats.pendingArrival}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Mesas Activas</div>
          <div className="stat-value">{mesas.filter((m) => m.invitados.length > 0).length} / {mesas.length}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Pagos Registrados</div>
          <div className="stat-value" style={{ color: '#fef08a' }}>
            ${stats.totalPaid.toLocaleString('es-MX')}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Buscar invitado o mesa..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn ${filter === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilter('all')}>
              Todos
            </button>
            <button className={`btn ${filter === 'inside' ? 'btn-green' : ''}`} onClick={() => setFilter('inside')}>
              Adentro
            </button>
            <button className={`btn ${filter === 'pending' ? 'btn-primary' : ''}`} onClick={() => setFilter('pending')}>
              Por llegar
            </button>
          </div>
        </div>

        {(query.trim() || filter !== 'all') ? (
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: 0 }}>
              {searchResults.length} resultados
            </p>
            {searchResults.slice(0, 60).map(({ mesa, inv }) => (
              <div
                key={`${mesa.mesa_num}-${inv.nombre}`}
                className={`guest-row ${inv.asistio ? 'checked' : ''}`}
                onClick={() => onToggleAsistencia(mesa.mesa_num, inv.nombre, !inv.asistio)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="check-circle">{inv.asistio && <Check size={18} strokeWidth={3} />}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{inv.nombre}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Mesa {mesa.mesa_num} · {mesa.nombre_mesa} (Asiento {inv.asiento})
                    </div>
                  </div>
                </div>
                <PaymentBadge inv={inv} />
              </div>
            ))}
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
