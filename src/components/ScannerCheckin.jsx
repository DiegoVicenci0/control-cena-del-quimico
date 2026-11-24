import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCheck, Clock, LogIn, LogOut, RotateCw, Users, X } from 'lucide-react';

function extractMesaNum(decodedText) {
  const txt = String(decodedText || '').trim();
  const urlMatch = txt.match(/[?&]mesa=(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);
  const tagMatch = txt.match(/MESA[:\s_-]*(\d+)/i);
  if (tagMatch) return parseInt(tagMatch[1], 10);
  if (/^\d+$/.test(txt)) return parseInt(txt, 10);
  return null;
}

export function formatExactDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function PaymentBadge({ inv }) {
  if (inv.pago_estado === 'premio' || inv.pago_estado === 'sit') {
    return <span className="badge badge-premio">{inv.pago_estado.toUpperCase()}</span>;
  }
  if (inv.pago_monto >= 700) {
    return <span className="badge badge-paid">${inv.pago_monto} · Pagado</span>;
  }
  if (inv.pago_monto > 0) {
    return <span className="badge badge-abono">${inv.pago_monto} · Abono</span>;
  }
  return <span className="badge badge-pending">$0 · Pendiente</span>;
}

export default function ScannerCheckin({
  mesas,
  movimientos,
  selectedMesaNum,
  onSelectMesa,
  onRegistrarMovimiento,
  onMarkAllMesa,
}) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [lastScannedMsg, setLastScannedMsg] = useState('');
  const scannerRef = useRef(null);

  const selectedMesa = mesas.find((m) => m.mesa_num === selectedMesaNum) || null;

  const movsByGuest = useMemo(() => {
    const map = new Map();
    for (const mv of movimientos) {
      const key = `${mv.mesa_num}::${mv.nombre}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(mv);
    }
    return map;
  }, [movimientos]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startScanner = async () => {
    setScanError('');
    setLastScannedMsg('');
    try {
      const qr = new Html5Qrcode('qr-reader-region');
      scannerRef.current = qr;
      setScanning(true);
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        async (decodedText) => {
          const num = extractMesaNum(decodedText);
          if (num && mesas.some((m) => m.mesa_num === num)) {
            onSelectMesa(num);
            setLastScannedMsg(`QR detectado: Mesa ${num}. Registra entrada, salida o reingreso abajo.`);
            await stopScanner();
          } else {
            setScanError(`QR leído ("${decodedText}"), pero no corresponde a una mesa válida.`);
          }
        },
        () => {}
      );
    } catch (err) {
      setScanning(false);
      setScanError(
        err?.message || 'No se pudo abrir la cámara. Verifica permisos del navegador o selecciona la mesa manualmente.'
      );
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const mesaArrived = selectedMesa ? selectedMesa.invitados.filter((i) => i.asistio).length : 0;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Recepción · Escáner QR y Control de Acceso</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--muted)' }}>
              Escanea el QR de la mesa para desplegar sus invitados y registrar <strong>Entrada</strong>, <strong>Salida</strong> o <strong>Reingreso</strong> con fecha y hora exacta.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!scanning ? (
              <button className="btn btn-primary" onClick={startScanner}>
                <Camera size={18} /> Escanear QR
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopScanner}>
                <CameraOff size={18} /> Detener cámara
              </button>
            )}
          </div>
        </div>

        <div
          id="qr-reader-region"
          style={{
            marginTop: scanning ? 14 : 0,
            maxWidth: 380,
            marginLeft: 'auto',
            marginRight: 'auto',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        />

        {scanError && <p style={{ color: '#fda4af', fontSize: '0.85rem', marginTop: 10 }}>{scanError}</p>}
        {lastScannedMsg && (
          <p style={{ color: '#6ee7b7', fontSize: '0.88rem', marginTop: 10, fontWeight: 600 }}>
            {lastScannedMsg}
          </p>
        )}

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 6 }}>
            O selecciona una mesa manualmente:
          </label>
          <select
            className="select"
            value={selectedMesaNum || ''}
            onChange={(e) => onSelectMesa(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">-- Elegir mesa --</option>
            {mesas.map((m) => {
              const inside = m.invitados.filter((i) => i.asistio).length;
              return (
                <option key={m.mesa_num} value={m.mesa_num}>
                  Mesa {m.mesa_num} — {m.nombre_mesa} ({inside}/{m.invitados.length} adentro)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {selectedMesa && (
        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <span className="badge badge-premio" style={{ marginBottom: 6 }}>
                MESA {selectedMesa.mesa_num}
              </span>
              <h3 style={{ margin: '2px 0', fontSize: '1.2rem' }}>{selectedMesa.nombre_mesa}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {mesaArrived} de {selectedMesa.invitados.length} invitados dentro ahora (capacidad {selectedMesa.capacidad})
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-green"
                onClick={() => onMarkAllMesa(selectedMesa.mesa_num)}
                disabled={selectedMesa.invitados.length === 0}
              >
                <CheckCheck size={16} /> Entrada a faltantes
              </button>
              <button className="btn" onClick={() => onSelectMesa(null)}>
                <X size={16} /> Cerrar
              </button>
            </div>
          </div>

          {selectedMesa.invitados.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Esta mesa está marcada como <strong>SIN ASIGNAR</strong> (0 invitados registrados).
            </p>
          ) : (
            <div>
              {selectedMesa.invitados.map((inv) => {
                const guestMovs = movsByGuest.get(`${selectedMesa.mesa_num}::${inv.nombre}`) || [];
                const hasEverEntered = guestMovs.length > 0 || Boolean(inv.hora_llegada);
                const lastMov = guestMovs[0];
                const isInside = inv.asistio;
                const rowClass = isInside ? 'checked' : hasEverEntered ? 'exited' : '';

                return (
                  <div key={`${selectedMesa.mesa_num}-${inv.nombre}`} className={`guest-row ${rowClass}`} style={{ cursor: 'default' }}>
                    <div style={{ flex: '1 1 240px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.96rem' }}>
                          #{inv.asiento} · {inv.nombre}
                        </span>
                        {isInside ? (
                          <span className="badge badge-paid">ADENTRO</span>
                        ) : hasEverEntered ? (
                          <span className="badge badge-abono">AFUERA (Salió)</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
                        <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {lastMov
                          ? `Último registro: ${lastMov.tipo.toUpperCase()} · ${formatExactDateTime(lastMov.registrado_at)}`
                          : inv.hora_llegada
                            ? `Entrada: ${formatExactDateTime(inv.hora_llegada)}`
                            : 'Sin registro de ingreso aún'}
                        {guestMovs.length > 1 ? ` (${guestMovs.length} movs.)` : ''}
                        {inv.nota ? ` · Nota: ${inv.nota}` : ''}
                      </div>
                    </div>

                    <div className="guest-actions">
                      {isInside ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => onRegistrarMovimiento(selectedMesa.mesa_num, inv.nombre, 'salida')}
                        >
                          <LogOut size={15} /> Registrar Salida
                        </button>
                      ) : hasEverEntered ? (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => onRegistrarMovimiento(selectedMesa.mesa_num, inv.nombre, 'reingreso')}
                        >
                          <RotateCw size={15} /> Registrar Reingreso
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-green"
                          onClick={() => onRegistrarMovimiento(selectedMesa.mesa_num, inv.nombre, 'entrada')}
                        >
                          <LogIn size={15} /> Registrar Entrada
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
