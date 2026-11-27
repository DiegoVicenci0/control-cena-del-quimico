import * as XLSX from 'xlsx';

const QR_TAG_RE = /\s*\((?:presi|grecia)\)\s*/gi;

function cleanPersonName(val) {
  return String(val || '')
    .replace(QR_TAG_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMesaName(val, num) {
  const cleaned = cleanPersonName(val);
  if (!cleaned) return `MESA ${num}`;
  return cleaned.replace(/^MESA(\d+)$/i, 'MESA $1');
}

export async function parseCenaExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames.includes('cena') ? 'cena' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const mesas = [];
  let cur = null;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const colA = row[0];
    const colB = row[1];
    const colC = row[2];
    const colI = row[8];
    const colK = row[10];

    if (typeof colB === 'string' && colB.trim().startsWith('Mesa ')) {
      const num = parseInt(colB.trim().replace('Mesa ', '').trim(), 10);
      if (!Number.isNaN(num)) {
        cur = {
          mesa_num: num,
          nombre_mesa: cleanMesaName(colC, num),
          capacidad: 0,
          invitados: [],
        };
        mesas.push(cur);
        continue;
      }
    }

    if (cur && typeof colA === 'number' && !Number.isNaN(colA)) {
      cur.capacidad += 1;
      const rawName = colB === null || colB === undefined ? '' : String(colB).trim();
      if (!rawName || rawName.toUpperCase() === 'SIN LLENAR') continue;

      const nombre = cleanPersonName(rawName);
      let pagoMonto = 0;
      let pagoEstado = 'pendiente';
      if (typeof colI === 'number' && !Number.isNaN(colI)) {
        pagoMonto = colI;
        pagoEstado = pagoMonto >= 700 ? 'pagado' : pagoMonto > 0 ? 'abono' : 'pendiente';
      } else if (typeof colI === 'string' && colI.trim()) {
        pagoEstado = colI.trim().toLowerCase();
      }

      const notes = [];
      if (typeof colK === 'string' && /vegetar/i.test(colK)) notes.push('Vegetariana');
      if (pagoEstado === 'premio') notes.push('Premio');

      cur.invitados.push({
        asiento: Math.round(colA),
        nombre,
        pago_monto: pagoMonto,
        pago_estado: pagoEstado,
        nota: notes.length ? notes.join(' · ') : null,
        asistio: false,
      });
    }
  }

  return mesas;
}

function formatDateTime(iso) {
  if (!iso) return { fecha: '', hora: '' };
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    hora: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  };
}

export function exportAsistenciaExcel(mesas, movimientos = []) {
  const movByGuest = new Map();
  for (const mv of movimientos) {
    const key = `${mv.mesa_num}::${mv.nombre}`;
    if (!movByGuest.has(key)) movByGuest.set(key, []);
    movByGuest.get(key).push(mv);
  }

  const data = [
    [
      'Mesa',
      'Nombre Mesa',
      'Asiento',
      'Invitado',
      'Estado Actual',
      '1ra Entrada',
      'Última Salida',
      'Último Reingreso',
      'Total Movimientos',
      'Nota',
    ],
  ];

  for (const m of mesas) {
    for (const inv of m.invitados) {
      const list = movByGuest.get(`${m.mesa_num}::${inv.nombre}`) || [];
      const sorted = [...list].sort((a, b) => new Date(a.registrado_at) - new Date(b.registrado_at));
      const firstIn = sorted.find((x) => x.tipo === 'entrada');
      const lastOut = [...sorted].reverse().find((x) => x.tipo === 'salida');
      const lastRe = [...sorted].reverse().find((x) => x.tipo === 'reingreso');

      const estadoActual = inv.asistio
        ? 'ADENTRO'
        : sorted.length > 0
          ? 'AFUERA (Salió)'
          : 'SIN LLEGAR';

      const f1 = firstIn ? formatDateTime(firstIn.registrado_at) : formatDateTime(inv.hora_llegada);
      const fOut = lastOut ? formatDateTime(lastOut.registrado_at) : { fecha: '', hora: '' };
      const fRe = lastRe ? formatDateTime(lastRe.registrado_at) : { fecha: '', hora: '' };

      data.push([
        m.mesa_num,
        m.nombre_mesa,
        inv.asiento,
        inv.nombre,
        estadoActual,
        f1.fecha ? `${f1.fecha} ${f1.hora}` : '',
        fOut.fecha ? `${fOut.fecha} ${fOut.hora}` : '',
        fRe.fecha ? `${fRe.fecha} ${fRe.hora}` : '',
        sorted.length,
        inv.nota || '',
      ]);
    }
  }

  const logRows = [['Fecha', 'Hora Precisa', 'Tipo Movimiento', 'Mesa', 'Nombre Mesa', 'Invitado']];
  const mesaMap = new Map(mesas.map((m) => [m.mesa_num, m.nombre_mesa]));
  const sortedAll = [...movimientos].sort((a, b) => new Date(b.registrado_at) - new Date(a.registrado_at));
  for (const mv of sortedAll) {
    const dt = formatDateTime(mv.registrado_at);
    logRows.push([
      dt.fecha,
      dt.hora,
      mv.tipo.toUpperCase(),
      mv.mesa_num,
      mesaMap.get(mv.mesa_num) || '',
      mv.nombre,
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(data);
  ws1['!cols'] = [
    { wch: 7 }, { wch: 26 }, { wch: 8 }, { wch: 34 }, { wch: 10 }, { wch: 13 },
    { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Asistencia');

  const ws2 = XLSX.utils.aoa_to_sheet(logRows);
  ws2['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 26 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Bitacora Accesos');

  XLSX.writeFile(wb, `Asistencia_Cena_Quimico_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
