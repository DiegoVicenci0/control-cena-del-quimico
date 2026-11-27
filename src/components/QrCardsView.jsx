import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer } from 'lucide-react';

function QrCard({ mesa, eventInfo, baseUrl }) {
  const [dataUrl, setDataUrl] = useState('');
  const targetUrl = `${baseUrl.replace(/\/$/, '')}/?mesa=${mesa.mesa_num}`;

  useEffect(() => {
    QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(setDataUrl);
  }, [targetUrl]);

  const downloadPng = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_Mesa_${mesa.mesa_num}_${mesa.nombre_mesa.replace(/\s+/g, '_')}.png`;
    link.click();
  };

  return (
    <div className="qr-invite-card">
      <div className="kicker">Pase de Acceso · Mesa Asignada</div>
      <div className="ev-title">{eventInfo.titulo}</div>
      <div className="ev-sub">{eventInfo.subtitulo}</div>

      <div className="mesa-badge">MESA {mesa.mesa_num}</div>
      {mesa.nombre_mesa && mesa.nombre_mesa.toUpperCase() !== `MESA ${mesa.mesa_num}` && (
        <div className="mesa-subname">{mesa.nombre_mesa}</div>
      )}

      <div className="qr-box">
        {dataUrl && <img src={dataUrl} alt={`QR Mesa ${mesa.mesa_num}`} style={{ width: 170, height: 170, display: 'block' }} />}
      </div>

      <div className="ev-meta">
        <div><strong>Fecha:</strong> {eventInfo.fecha} · <strong>Hora:</strong> {eventInfo.hora}</div>
        <div><strong>Lugar:</strong> {eventInfo.lugar}</div>
        <div><strong>Vestimenta:</strong> {eventInfo.vestimenta}</div>
        <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#64748b' }}>
          Presenta este QR en recepción ({mesa.invitados.length} invitados / cap. {mesa.capacidad})
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 12 }}>
        <button className="btn" style={{ width: '100%', background: '#0f172a', color: '#fef08a' }} onClick={downloadPng}>
          <Download size={15} /> Descargar QR (PNG)
        </button>
      </div>
    </div>
  );
}

export default function QrCardsView({ mesas, eventInfo, onUpdateEventInfo }) {
  const defaultBase = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const [baseUrl, setBaseUrl] = useState(defaultBase);

  return (
    <div>
      <div className="card no-print">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Tarjetas QR por Mesa (Invitación + Recepción)</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--muted)' }}>
              Personaliza los datos del evento e imprime en PDF o descarga cada QR para enviarlo a tus invitados.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / Guardar PDF ({mesas.length} tarjetas)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Título del evento</label>
            <input
              className="input"
              value={eventInfo.titulo}
              onChange={(e) => onUpdateEventInfo({ ...eventInfo, titulo: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Subtítulo</label>
            <input
              className="input"
              value={eventInfo.subtitulo}
              onChange={(e) => onUpdateEventInfo({ ...eventInfo, subtitulo: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Fecha</label>
            <input
              className="input"
              value={eventInfo.fecha}
              onChange={(e) => onUpdateEventInfo({ ...eventInfo, fecha: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Hora</label>
            <input
              className="input"
              value={eventInfo.hora}
              onChange={(e) => onUpdateEventInfo({ ...eventInfo, hora: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Lugar / Salón</label>
            <input
              className="input"
              value={eventInfo.lugar}
              onChange={(e) => onUpdateEventInfo({ ...eventInfo, lugar: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Vestimenta</label>
            <input
              className="input"
              value={eventInfo.vestimenta}
              onChange={(e) => onUpdateEventInfo({ ...eventInfo, vestimenta: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
            URL base de la app en GitHub Pages (el QR apuntará a <code>?mesa=N</code>)
          </label>
          <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
      </div>

      <div className="qr-grid">
        {mesas.map((mesa) => (
          <QrCard key={mesa.mesa_num} mesa={mesa} eventInfo={eventInfo} baseUrl={baseUrl} />
        ))}
      </div>
    </div>
  );
}
