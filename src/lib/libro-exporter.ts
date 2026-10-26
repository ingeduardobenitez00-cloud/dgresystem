import jsPDF from 'jspdf';

/* =========================================================================
 * Generador nativo de ZIP (Store / sin compresión para máxima velocidad con JPEG)
 * ========================================================================= */
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZipBlob(files: { name: string; data: Uint8Array }[]): Blob {
  const parts: Uint8Array[] = [];
  const centralDirectoryEntries: Uint8Array[] = [];
  let offset = 0;

  const textEncoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const dataBytes = file.data;
    const fileCrc = crc32(dataBytes);
    const fileLength = dataBytes.length;

    // Encabezado Local (30 bytes + nombre)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Firma cabecera local
    view.setUint16(4, 20, true);         // Versión necesaria (2.0)
    view.setUint16(6, 0, true);          // Flags
    view.setUint16(8, 0, true);          // Método 0 = Store (sin compresión adicional)
    view.setUint16(10, 0, true);         // Hora
    view.setUint16(12, 0, true);         // Fecha
    view.setUint32(14, fileCrc, true);   // CRC-32
    view.setUint32(18, fileLength, true);// Tamaño comprimido
    view.setUint32(22, fileLength, true);// Tamaño descomprimido
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    parts.push(localHeader);
    parts.push(dataBytes);

    // Entrada del Directorio Central (46 bytes + nombre)
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cdEntry.buffer);

    cdView.setUint32(0, 0x02014b50, true); // Firma directorio central
    cdView.setUint16(4, 20, true);          // Versión creada por
    cdView.setUint16(6, 20, true);          // Versión requerida
    cdView.setUint16(8, 0, true);           // Flags
    cdView.setUint16(10, 0, true);          // Método Store
    cdView.setUint16(12, 0, true);          // Hora
    cdView.setUint16(14, 0, true);          // Fecha
    cdView.setUint32(16, fileCrc, true);    // CRC-32
    cdView.setUint32(20, fileLength, true); // Tamaño comprimido
    cdView.setUint32(24, fileLength, true); // Tamaño descomprimido
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true);          // Longitud campo extra
    cdView.setUint16(32, 0, true);          // Comentario
    cdView.setUint16(34, 0, true);          // Número disco
    cdView.setUint16(36, 0, true);          // Atributos internos
    cdView.setUint32(38, 0, true);          // Atributos externos
    cdView.setUint32(42, offset, true);     // Offset relativo
    cdEntry.set(nameBytes, 46);

    centralDirectoryEntries.push(cdEntry);

    offset += localHeader.length + dataBytes.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const entry of centralDirectoryEntries) {
    parts.push(entry);
    cdSize += entry.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  eocdView.setUint16(20, 0, true);

  parts.push(eocd);

  return new Blob(parts, { type: 'application/zip' });
}

/* =========================================================================
 * Helper para descargar imágenes (con fallback a proxy si hay problemas de CORS)
 * ========================================================================= */
async function fetchImageBuffer(url: string): Promise<{ buffer: Uint8Array; base64: string; width: number; height: number }> {
  let blob: Blob | null = null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      blob = await res.blob();
    }
  } catch (err) {
    // Si falla por CORS u otro motivo, usamos el proxy de nuestra API
  }

  if (!blob) {
    const proxyUrl = `/api/r2/image?url=${encodeURIComponent(url)}`;
    const resProxy = await fetch(proxyUrl);
    if (!resProxy.ok) {
      throw new Error(`No se pudo obtener la imagen del folio: ${resProxy.statusText}`);
    }
    blob = await resProxy.blob();
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Convertir a base64 y calcular dimensiones reales
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob!);
  });

  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 1200 });
    img.onerror = () => resolve({ width: 800, height: 1200 });
    img.src = base64;
  });

  return { buffer, base64, width: dims.width, height: dims.height };
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* =========================================================================
 * Tipos para exportación
 * ========================================================================= */
export type LibroInfo = {
  id: string;
  nombre_libro?: string;
  tipo_libro: string;
  anio: string;
  tomo?: string;
  numero_libro?: string;
  registro_civil_numero: string;
  registro_civil_nombre: string;
  departamento: string;
  distrito: string;
  fecha_apertura?: string;
  fecha_cierre?: string;
  observaciones?: string;
};

export type FolioInfo = {
  folio: number;
  foto: string;
  username?: string;
  fecha?: string;
};

/* =========================================================================
 * 1. Exportar a PDF oficial de alta resolución
 * ========================================================================= */
export async function exportLibroToPdf(
  libro: LibroInfo,
  folios: FolioInfo[],
  onProgress: (current: number, total: number, message: string) => void
) {
  const total = folios.length;
  if (total === 0) throw new Error('El libro no contiene folios escaneados para generar el PDF.');

  onProgress(0, total, 'Iniciando documento PDF...');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // --- PORTADA OFICIAL ---
  pdf.setFillColor(24, 24, 27); // fondo elegante oscuro superior
  pdf.rect(0, 0, pageWidth, 55, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('DIRECCIÓN GENERAL DEL REGISTRO DEL ESTADO CIVIL', pageWidth / 2, 22, { align: 'center' });

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('SISTEMA INTEGRADO DE DIGITALIZACIÓN Y RELEVAMIENTO DE LIBROS', pageWidth / 2, 30, { align: 'center' });

  pdf.setDrawColor(16, 185, 129); // línea verde esmeralda decorativa
  pdf.setLineWidth(1.2);
  pdf.line(25, 42, pageWidth - 25, 42);

  // Cuerpo de la portada
  pdf.setTextColor(24, 24, 27);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text(libro.nombre_libro || `LIBRO DE ${libro.tipo_libro}`, pageWidth / 2, 85, { align: 'center' });

  pdf.setFontSize(14);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`AÑO ${libro.anio} · TOMO ${libro.tomo || 'I'} · LIBRO N° ${libro.numero_libro || '—'}`, pageWidth / 2, 96, { align: 'center' });

  // Cuadro con información registral
  pdf.setDrawColor(226, 232, 240);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(20, 115, pageWidth - 40, 85, 4, 4, 'FD');

  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);

  const startY = 130;
  const lineH = 11;
  const col1 = 30;
  const col2 = 90;

  pdf.setFont('helvetica', 'bold');
  pdf.text('OFICINA REGISTRAL:', col1, startY);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`N° ${libro.registro_civil_numero} — ${libro.registro_civil_nombre}`, col2, startY);

  pdf.setFont('helvetica', 'bold');
  pdf.text('JURISDICCIÓN:', col1, startY + lineH);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${libro.distrito}, ${libro.departamento}`, col2, startY + lineH);

  pdf.setFont('helvetica', 'bold');
  pdf.text('FOLIOS RELEVADOS:', col1, startY + lineH * 2);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${total} páginas digitalizadas en alta resolución`, col2, startY + lineH * 2);

  pdf.setFont('helvetica', 'bold');
  pdf.text('FECHA GENERACIÓN:', col1, startY + lineH * 3);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date().toLocaleString('es-PY'), col2, startY + lineH * 3);

  if (libro.observaciones) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('OBSERVACIONES:', col1, startY + lineH * 4);
    pdf.setFont('helvetica', 'normal');
    pdf.text(libro.observaciones, col2, startY + lineH * 4, { maxWidth: 85 });
  }

  // Pie de página de la portada
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Documento oficial generado para archivo, consulta y respaldo histórico registral.', pageWidth / 2, 275, { align: 'center' });

  // --- AGREGAR CADA FOLIO COMO PÁGINA ---
  for (let i = 0; i < total; i++) {
    const f = folios[i];
    onProgress(i + 1, total, `Descargando folio ${f.folio} (${i + 1} de ${total})...`);

    const img = await fetchImageBuffer(f.foto);

    pdf.addPage();

    // Marco y cabecera en cada folio
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${libro.nombre_libro || `LIBRO DE ${libro.tipo_libro}`} — OFICINA N° ${libro.registro_civil_numero}`, 12, 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(16, 185, 129);
    pdf.text(`FOLIO N° ${f.folio}`, pageWidth - 12, 10, { align: 'right' });

    // Dimensionar la imagen para que encaje perfectamente dentro de los márgenes
    const marginX = 10;
    const marginY = 15;
    const maxW = pageWidth - marginX * 2; // 190 mm
    const maxH = pageHeight - marginY * 2 - 5; // ~262 mm

    const imgRatio = img.width / img.height;
    const boxRatio = maxW / maxH;

    let renderW = maxW;
    let renderH = maxH;

    if (imgRatio > boxRatio) {
      renderW = maxW;
      renderH = maxW / imgRatio;
    } else {
      renderH = maxH;
      renderW = maxH * imgRatio;
    }

    const posX = marginX + (maxW - renderW) / 2;
    const posY = marginY + (maxH - renderH) / 2;

    pdf.addImage(img.base64, 'JPEG', posX, posY, renderW, renderH, undefined, 'FAST');

    // Pie de folio
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(148, 163, 184);
    const dateStr = f.fecha ? new Date(f.fecha).toLocaleDateString('es-PY') : '';
    pdf.text(`Folio digitalizado por: ${f.username || 'Operador'} ${dateStr ? `· ${dateStr}` : ''}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  onProgress(total, total, 'Compilando archivo PDF final...');
  const cleanName = (libro.nombre_libro || `Libro_${libro.tipo_libro}_${libro.anio}_OF${libro.registro_civil_numero}`)
    .replace(/[^a-zA-Z0-9_\-]/g, '_');

  pdf.save(`${cleanName}.pdf`);
}

/* =========================================================================
 * 2. Exportar a ZIP con todas las fotos originales
 * ========================================================================= */
export async function exportLibroToZip(
  libro: LibroInfo,
  folios: FolioInfo[],
  onProgress: (current: number, total: number, message: string) => void
) {
  const total = folios.length;
  if (total === 0) throw new Error('El libro no contiene folios escaneados para descargar.');

  onProgress(0, total, 'Iniciando descarga de fotos...');

  const zipFiles: { name: string; data: Uint8Array }[] = [];

  for (let i = 0; i < total; i++) {
    const f = folios[i];
    onProgress(i + 1, total, `Descargando imagen del folio ${f.folio} (${i + 1} de ${total})...`);

    const img = await fetchImageBuffer(f.foto);
    const pad = String(f.folio).padStart(4, '0');
    zipFiles.push({
      name: `Folio_${pad}.jpg`,
      data: img.buffer,
    });
  }

  onProgress(total, total, 'Comprimiendo archivo ZIP...');
  const zipBlob = createZipBlob(zipFiles);

  const cleanName = (libro.nombre_libro || `Fotos_${libro.tipo_libro}_${libro.anio}_OF${libro.registro_civil_numero}`)
    .replace(/[^a-zA-Z0-9_\-]/g, '_');

  triggerDownload(zipBlob, `${cleanName}.zip`);
}
