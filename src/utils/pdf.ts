import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { MapObject } from '../store/types';
import { ReleaseNote } from '../version/history';

export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

export interface PdfExportOptions {
  orientation?: PdfOrientation;
  includeList?: boolean;
}

export const exportPlanToPdf = async (
  mapElement: HTMLElement,
  objects: MapObject[],
  planName: string,
  options: PdfExportOptions = {},
  typeLabelById?: Record<string, string>
) => {
  const canvas = await html2canvas(mapElement, { backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  const orientation: 'p' | 'l' =
    options.orientation === 'portrait'
      ? 'p'
      : options.orientation === 'landscape'
        ? 'l'
        : canvas.width >= canvas.height
          ? 'l'
          : 'p';
  const includeList = options.includeList ?? true;

  const pdf = new jsPDF(orientation, 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 24;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.setFontSize(16);
  pdf.text(planName, margin, 32);
  pdf.addImage(imgData, 'PNG', margin, 48, imgWidth, imgHeight);

  if (!includeList) {
    pdf.save(`${planName.replace(/\s+/g, '_')}.pdf`);
    return;
  }

  let y = 64 + imgHeight;
  pdf.setFontSize(12);
  pdf.text('Oggetti', margin, y);
  y += 12;

  objects.forEach((obj, idx) => {
    if (y > pdf.internal.pageSize.getHeight() - 40) {
      pdf.addPage();
      y = 40;
    }
    const typeLabel = (typeLabelById && typeLabelById[obj.type]) || obj.type;
    pdf.text(`${idx + 1}. ${obj.name} (${typeLabel})${obj.description ? ' - ' + obj.description : ''}`, margin, y);
    y += 16;
  });

  pdf.save(`${planName.replace(/\s+/g, '_')}.pdf`);
};

export const exportChangelogToPdf = (history: ReleaseNote[], filename = 'deskly_changelog.pdf') => {
  const pdf = new jsPDF('p', 'pt', 'a4');
  const margin = 32;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = 44;

  pdf.setFontSize(18);
  pdf.text('Deskly — Changelog', margin, y);
  y += 22;

  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Generato il ${new Date().toISOString().slice(0, 10)}`, margin, y);
  pdf.setTextColor(0);
  y += 18;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  };

  for (const rel of history) {
    ensureSpace(42);
    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text(`v${rel.version}`, margin, y);
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(rel.date, margin + 120, y);
    pdf.setTextColor(0);
    y += 14;

    pdf.setFontSize(10);
    for (const note of rel.notes) {
      const lines = pdf.splitTextToSize(`• ${note}`, maxWidth);
      ensureSpace(lines.length * 12 + 6);
      pdf.text(lines, margin, y);
      y += lines.length * 12;
    }
    y += 10;
  }

  pdf.save(filename);
};
