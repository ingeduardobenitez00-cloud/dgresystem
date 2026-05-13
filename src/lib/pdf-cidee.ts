
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { SolicitudCapacitacion } from "./data";

export async function generatePlanillaCIDEE(solicitud: SolicitudCapacitacion) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // --- HELPER PARA CARGAR IMÁGENES ---
  const addImageFromUrl = async (url: string, x: number, y: number, w: number, h: number) => {
    try {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      doc.addImage(img, 'PNG', x, y, w, h);
    } catch (e) {
      console.warn("No se pudo cargar el logo:", url);
    }
  };

  // --- CABECERA IZQUIERDA (Logo Justicia Electoral) ---
  await addImageFromUrl('/logo.png', 45, 8, 22, 22);
  doc.setFontSize(7);
  doc.setFont("times", "normal");
  doc.text("REPÚBLICA DEL PARAGUAY", 56, 7, { align: "center" });
  doc.setFont("times", "bold");
  doc.text("Justicia Electoral", 56, 10, { align: "center" });
  
  // --- CABECERA CENTRO (Textos Institucionales) ---
  doc.setFontSize(22);
  doc.setFont("times", "bold");
  doc.text("Justicia Electoral", 148, 18, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("times", "normal");
  doc.text("Dirección del Centro de Información,", 148, 23, { align: "center" });
  doc.text("Documentación y Educación Electoral - CIDEE", 148, 27, { align: "center" });

  // --- CABECERA DERECHA (Logo CIDEE) ---
  await addImageFromUrl('/logo3.png', 230, 8, 25, 25);

  // Líneas divisorias de cabecera (verticales)
  doc.setDrawColor(200);
  doc.line(80, 8, 80, 30);
  doc.line(216, 8, 216, 30);

  // --- TÍTULO DE CAPACITACIÓN ---
  doc.setDrawColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CAPACITACIÓN A ORGANIZACIONES POLÍTICAS - INTERNA SIMULTÁNEAS DE LAS ORGANIZACIONES POLÍTICAS", 148, 38, { align: "center" });
  doc.text('PROGRAMA: "FORTALECIMIENTO INSTITUCIONAL"', 148, 43, { align: "center" });

  // --- CAMPOS DE DATOS (Con líneas) ---
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  const fechaStr = solicitud.fecha ? format(new Date(solicitud.fecha), "dd / MM / yyyy") : "__ / __ / 2026";
  doc.text(`FECHA:   ${fechaStr}`, 10, 52);
  doc.text(`HORA:  ___ : ___`, 50, 52);
  doc.text(`DEPARTAMENTO: _____________________________________`, 90, 52);
  doc.text(solicitud.departamento || "", 125, 51.5);
  doc.text(`DISTRITO: ____________________________________`, 190, 52);
  doc.text(solicitud.distrito || "", 215, 51.5);

  doc.text(`LUGAR: __________________________________________________________________________________________________________________________________________`, 10, 60);
  doc.text(solicitud.lugar_local || "", 25, 59.5);

  doc.text(`TEMA: ___________________________________________________________________________________________________________________________________________`, 10, 68);
  doc.text("CAPACITACIÓN A MIEMBROS DE MESA RECEPTORA DE VOTOS", 25, 67.5);

  // --- TABLA DE ASISTENCIA ---
  const tableData = Array.from({ length: 15 }, (_, i) => [
    (i + 1).toString(),
    "",
    "",
    "", // Organización Política vacía
    "",
    ""
  ]);

  (doc as any).autoTable({
    startY: 72,
    margin: { left: 10, right: 10 },
    head: [['N.°', 'NOMBRE Y APELLIDO COMPLETO', 'C.I.C. N.°', 'ORGANIZACIÓN POLÍTICA', 'N.° DE CELULAR', 'FIRMA']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [210, 210, 210],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      minCellHeight: 7.5, // Altura ajustada para que quepan las 15 filas y el pie
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 75 },
      2: { cellWidth: 30 },
      3: { cellWidth: 70 },
      4: { cellWidth: 35 },
      5: { cellWidth: 57 }
    }
  });

  // --- PIE DE PÁGINA ---
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  
  doc.text("CAPACITADOR/ES:", 10, finalY);
  doc.text("Completado por (firma aclaración):", 10, finalY + 8);
  doc.line(10, finalY + 3, 60, finalY + 3); // Línea para nombre
  doc.line(10, finalY + 11, 60, finalY + 11); // Línea para firma

  doc.text("Verificado por:", 160, finalY + 4, { align: "center" });
  doc.text("Firma/aclaración", 160, finalY + 9, { align: "center" });
  doc.line(135, finalY + 3, 185, finalY + 3); // Línea verificación

  // Logo MECIP (Abajo a la derecha)
  await addImageFromUrl('/logo1.png', 245, finalY - 2, 25, 10);
  doc.setFontSize(6);
  doc.text("mecip 2015", 262, finalY + 12, { align: "center" });

  // Guardar el PDF
  doc.save(`Planilla_Oficial_CIDEE_${solicitud.distrito}.pdf`);
}
