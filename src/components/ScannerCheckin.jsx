import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Check, CheckCheck, Users, X } from 'lucide-react';

function extractMesaNum(decodedText) {
  const txt = String(decodedText || '').trim();
  const urlMatch = txt.match(/[?&]mesa=(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);
  const tagMatch = txt.match(/MESA[:\s_-]*(\d+)/i);
  if (tagMatch) return parseInt(tagMatch[1], 10);
  if (/^\d+$/.test(txt)) return parseInt(txt, 10);
  return null;
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
  selectedMesaNum,
  onSelectMesa,
  onToggleAsistencia,
  onMarkAllMesa,
}) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [lastScannedMsg, setLastScannedMsg] = useState('');
  const scannerRef = useRef(null);

  const selectedMesa = mesas.find((m) => m.mesa_num === selectedMesaNum) || null;

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
            setLastScannedMsg(`QR detectado: Mesa ${num}. Selecciona quién llegó abajo.`);
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
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Recepción · Escáner QR de Mesa</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--muted)' }}>
              Escanea el QR de la mesa para desplegar a sus invitados y marcar quién llegó antes de registrar su ingreso.
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

        {scanError && (
          <p style={{ color: '#fda4af', fontSize: '0.85rem', marginTop: 10 }}>{scanError}</p>
        )}
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
                {mesaArrived} de {selectedMesa.invitados.length} invitados adentro (capacidad {selectedMesa.capacidad})
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-green"
                onClick={() => onMarkAllMesa(selectedMesa.mesa_num, true)}
                disabled={selectedMesa.invitados.length === 0}
              >
                <CheckCheck size={16} /> Marcar toda la mesa
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
              {selectedMesa.invitados.map((inv) => (
                <div
                  key={`${selectedMesa.mesa_num}-${inv.nombre}`}
                  className={`guest-row ${inv.asistio ? 'checked' : ''}`}
                  onClick={() => onToggleAsistencia(selectedMesa.mesa_num, inv.nombre, !inv.asistio)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="check-circle">
                      {inv.asistio && <Check size={18} strokeWidth={3} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>
                        #{inv.asiento} · {inv.nombre}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
                        {inv.asistio
                          ? `Ingresó ${inv.hora_llegada ? new Date(inv.hora_llegada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'ahora'}`
                          : 'Toca para registrar llegada'}
                        {inv.nota ? ` · Nota: ${inv.nota}` : ''}
                      </div>
                    </div>
                  </div>
                  <PaymentBadge inv={inv} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
