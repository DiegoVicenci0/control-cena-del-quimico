import * as XLSX from 'xlsx';

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
    const colJ = row[9];

    if (typeof colB === 'string' && colB.trim().startsWith('Mesa ')) {
      const num = parseInt(colB.trim().replace('Mesa ', '').trim(), 10);
      if (!Number.isNaN(num)) {
        cur = {
          mesa_num: num,
          nombre_mesa: String(colC || '').trim() || `Mesa ${num}`,
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

      let pagoMonto = 0;
      let pagoEstado = 'pendiente';
      if (typeof colI === 'number' && !Number.isNaN(colI)) {
        pagoMonto = colI;
        pagoEstado = pagoMonto >= 700 ? 'pagado' : pagoMonto > 0 ? 'abono' : 'pendiente';
      } else if (typeof colI === 'string' && colI.trim()) {
        pagoEstado = colI.trim().toLowerCase();
      }

      const isFirstRow = cur.invitados.length === 0;
      const nota = !isFirstRow && colJ !== null && colJ !== undefined ? String(colJ).trim() : null;

      cur.invitados.push({
        asiento: Math.round(colA),
        nombre: rawName,
        pago_monto: pagoMonto,
        pago_estado: pagoEstado,
        nota,
        asistio: false,
      });
    }
  }

  return mesas;
}

export function exportAsistenciaExcel(mesas) {
  const data = [
    ['Mesa', 'Nombre Mesa', 'Asiento', 'Invitado', 'Pago ($)', 'Estado Pago', 'Asistió', 'Hora Llegada', 'Nota'],
  ];

  for (const m of mesas) {
    for (const inv of m.invitados) {
      data.push([
        m.mesa_num,
        m.nombre_mesa,
        inv.asiento,
        inv.nombre,
        inv.pago_monto,
        inv.pago_estado,
        inv.asistio ? 'SÍ' : 'NO',
        inv.hora_llegada ? new Date(inv.hora_llegada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
        inv.nota || '',
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 9 },
    { wch: 36 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
  XLSX.writeFile(wb, `Asistencia_Cena_Quimico_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
