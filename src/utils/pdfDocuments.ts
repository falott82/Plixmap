// Standalone PDF document exporters (changelog, client notes, client IP map,
// client directory) extracted from pdf.ts. These build their own jsPDF
// documents and share only the low-level loadImage helper.
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ReleaseNote } from '../version/history';
import { sanitizeHtmlBasic } from './sanitizeHtml';
import { loadImage } from './pdfShared';

export const exportChangelogToPdf = (
  history: ReleaseNote[],
  options: { lang?: 'it' | 'en'; filename?: string } = {}
) => {
  const lang = options.lang === 'en' ? 'en' : 'it';
  const filename = options.filename || 'plixmap_changelog.pdf';
  const pdf = new jsPDF('p', 'pt', 'a4');
  const margin = 32;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = 44;

  pdf.setFontSize(18);
  pdf.text('Plixmap — Changelog', margin, y);
  y += 22;

  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(
    lang === 'en'
      ? `Generated on ${new Date().toISOString().slice(0, 10)}`
      : `Generato il ${new Date().toISOString().slice(0, 10)}`,
    margin,
    y
  );
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
      const text = lang === 'en' ? note.en : note.it;
      const lines = pdf.splitTextToSize(`• ${text}`, maxWidth);
      ensureSpace(lines.length * 12 + 6);
      pdf.text(lines, margin, y);
      y += lines.length * 12;
    }
    y += 10;
  }

  pdf.save(filename);
};

export const exportClientNotesToPdf = async (params: {
  clientLabel: string;
  notesHtml: string;
  lang?: 'it' | 'en';
  filename?: string;
}) => {
  const lang = params.lang === 'en' ? 'en' : 'it';
  const filename = params.filename || `plixmap_client_notes_${new Date().toISOString().slice(0, 10)}.pdf`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px'; // ~A4 at 96dpi
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#0f172a';
  wrapper.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'";
  wrapper.style.padding = '28px';

  const safeHtml = sanitizeHtmlBasic(String(params.notesHtml || ''));
  const date = new Date().toISOString().slice(0, 10);

  // Load Plixmap logo (best effort) for the header
  let desklyLogo: string | null = null;
  try {
    const img = await loadImage('/plixmap-logo.png').catch(() => loadImage('/favicon.svg'));
    const c = document.createElement('canvas');
    const max = 96;
    const w = img.naturalWidth || (img as any).width || max;
    const h = img.naturalHeight || (img as any).height || max;
    const s = Math.min(1, max / Math.max(w, h));
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      desklyLogo = c.toDataURL('image/png');
    }
  } catch {
    desklyLogo = null;
  }

  const style = document.createElement('style');
  style.textContent = `
    .deskly-notes h1,.deskly-notes h2,.deskly-notes h3{font-weight:700;color:#0f172a;margin:14px 0 8px}
    .deskly-notes p{margin:8px 0;line-height:1.45}
    .deskly-notes ul,.deskly-notes ol{margin:8px 0 8px 18px}
    .deskly-notes table{border-collapse:collapse;width:100%;margin:10px 0}
    .deskly-notes th,.deskly-notes td{border:1px solid #cbd5e1;padding:6px;vertical-align:top}
    .deskly-notes th{background:#f8fafc}
    .deskly-notes img{max-width:100%;height:auto;border-radius:8px}
    .deskly-list{margin:8px 0}
    .deskly-list-item{display:flex;gap:8px;align-items:flex-start}
    .deskly-list-marker{min-width:18px;white-space:nowrap;font-weight:700;color:#334155;line-height:1.45}
    .deskly-list-body{flex:1;min-width:0}
    .deskly-card{background:#f1f5f9;border-radius:14px;padding:14px 16px;display:flex;gap:12px;align-items:center}
    .deskly-title{font-size:22px;font-weight:800;line-height:1}
    .deskly-sub{font-size:12px;color:#475569;margin-top:4px}
    .deskly-meta{margin-left:auto;text-align:right;font-size:11px;color:#475569;white-space:nowrap}
    .deskly-meta strong{color:#0f172a}
  `;
  wrapper.appendChild(style);

  // Build the header via DOM nodes (textContent) rather than innerHTML so that
  // user-controlled values like clientLabel cannot inject markup/script (stored XSS).
  const header = document.createElement('div');
  header.className = 'deskly-card';

  // Only emit the logo when it is a real image data URL (it always is here — produced
  // by canvas.toDataURL above — but guard defensively).
  if (desklyLogo && desklyLogo.startsWith('data:image/')) {
    const logoImg = document.createElement('img');
    logoImg.src = desklyLogo;
    logoImg.style.width = '30px';
    logoImg.style.height = '30px';
    header.appendChild(logoImg);
  }

  const titleBlock = document.createElement('div');
  const titleEl = document.createElement('div');
  titleEl.className = 'deskly-title';
  titleEl.textContent = 'Plixmap';
  const subEl = document.createElement('div');
  subEl.className = 'deskly-sub';
  subEl.textContent = lang === 'en' ? 'Client notes' : 'Note cliente';
  titleBlock.appendChild(titleEl);
  titleBlock.appendChild(subEl);
  header.appendChild(titleBlock);

  const metaBlock = document.createElement('div');
  metaBlock.className = 'deskly-meta';
  const clientEl = document.createElement('div');
  const clientStrong = document.createElement('strong');
  clientStrong.textContent = params.clientLabel || '';
  clientEl.appendChild(clientStrong);
  const dateEl = document.createElement('div');
  dateEl.textContent = `${lang === 'en' ? 'Generated on' : 'Generato il'} ${date}`;
  metaBlock.appendChild(clientEl);
  metaBlock.appendChild(dateEl);
  header.appendChild(metaBlock);

  wrapper.appendChild(header);

  const content = document.createElement('div');
  content.className = 'deskly-notes';
  content.style.marginTop = '18px';
  content.innerHTML = safeHtml || `<p style="color:#64748b">${lang === 'en' ? '(No notes)' : '(Nessuna nota)'}</p>`;
  wrapper.appendChild(content);

  // html2canvas often does not render list markers; normalize lists into explicit marker blocks.
  const normalizeListsForCanvas = () => {
    const normalize = (list: HTMLOListElement | HTMLUListElement, level: number) => {
      const isOrdered = list.tagName === 'OL';
      const wrapper = document.createElement('div');
      wrapper.className = 'deskly-list';
      if (level > 0) wrapper.style.paddingLeft = `${Math.min(64, level * 14)}px`;

      let idx = isOrdered ? Number((list as HTMLOListElement).start || 1) || 1 : 1;
      const children = Array.from(list.children) as HTMLElement[];
      for (const child of children) {
        if (child.tagName !== 'LI') continue;
        const li = child as HTMLLIElement;

        // Normalize nested lists first (direct children of this LI).
        const nested = Array.from(li.children).filter((n) => n.tagName === 'OL' || n.tagName === 'UL') as (
          | HTMLOListElement
          | HTMLUListElement
        )[];
        for (const n of nested) normalize(n, level + 1);

        const valueAttr = isOrdered ? Number(li.getAttribute('value') || '') : NaN;
        const markerValue = isOrdered ? (Number.isFinite(valueAttr) ? valueAttr : idx) : NaN;
        const markerText = isOrdered ? `${markerValue}.` : '•';
        if (isOrdered) idx = Number.isFinite(valueAttr) ? valueAttr + 1 : idx + 1;

        const item = document.createElement('div');
        item.className = 'deskly-list-item';

        const marker = document.createElement('div');
        marker.className = 'deskly-list-marker';
        marker.textContent = `${markerText} `;

        const body = document.createElement('div');
        body.className = 'deskly-list-body';

        while (li.firstChild) body.appendChild(li.firstChild);
        item.appendChild(marker);
        item.appendChild(body);
        wrapper.appendChild(item);
      }

      list.replaceWith(wrapper);
    };

    const roots = Array.from(content.querySelectorAll('ol,ul')) as (HTMLOListElement | HTMLUListElement)[];
    // Normalize only top-level lists (nested lists are handled recursively).
    const topLevel = roots.filter((l) => !l.parentElement || (l.parentElement.tagName !== 'LI' && l.parentElement.tagName !== 'OL' && l.parentElement.tagName !== 'UL'));
    for (const l of topLevel) normalize(l, 0);
  };
  normalizeListsForCanvas();

  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const usableW = pageWidth - margin * 2;
    const usableH = pageHeight - margin * 2;

    // Convert canvas px → pdf points preserving aspect ratio.
    const imgWPt = usableW;
    const pxToPt = imgWPt / canvas.width;
    const sliceHeightPx = Math.max(1, Math.floor(usableH / pxToPt));

    let page = 1;
    for (let sy = 0; sy < canvas.height; sy += sliceHeightPx) {
      const sh = Math.min(sliceHeightPx, canvas.height - sy);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sh;
      const sctx = slice.getContext('2d');
      if (!sctx) break;
      sctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      const dataUrl = slice.toDataURL('image/jpeg', 0.9);
      const imgHPt = sh * pxToPt;

      if (page > 1) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', margin, margin, imgWPt, imgHPt, undefined, 'FAST');

      // Page number
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      const label = `${page}`;
      pdf.text(label, (pageWidth - pdf.getTextWidth(label)) / 2, pageHeight - margin + 10);
      pdf.setTextColor(0);
      page++;
    }

    pdf.save(filename);
  } finally {
    wrapper.remove();
  }
};

export const exportClientIpMapToPdf = (params: {
  clientName: string;
  entries: Array<{
    ip: string;
    name: string;
    type: string;
    url?: string;
    site: string;
    plan: string;
  }>;
  filename?: string;
}) => {
  const filename = params.filename || `plixmap_ip_map_${new Date().toISOString().slice(0, 10)}.pdf`;
  const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 22;
  const rowPadding = 5;
  const lineHeight = 12;

  const cols = [
    { key: 'ip', label: 'IP', ratio: 0.12 },
    { key: 'name', label: 'Device', ratio: 0.22 },
    { key: 'type', label: 'Type', ratio: 0.13 },
    { key: 'site', label: 'Site', ratio: 0.16 },
    { key: 'plan', label: 'Floor plan', ratio: 0.16 },
    { key: 'url', label: 'URL', ratio: 0.21 }
  ];
  const colWidths = cols.map((c) => Math.floor(c.ratio * tableWidth));
  const colX = colWidths.reduce<number[]>((acc, _w, idx) => {
    if (idx === 0) return [margin];
    acc.push(acc[idx - 1] + colWidths[idx - 1]);
    return acc;
  }, []);

  let y = margin;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`Plixmap — IP Map`, margin, y + 12);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(90);
  pdf.text(params.clientName || '', margin, y + 28);
  pdf.setTextColor(0);
  y += 42;

  const drawHeader = () => {
    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin, y, tableWidth, headerHeight, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    for (let i = 0; i < cols.length; i += 1) {
      const x = colX[i] + rowPadding;
      pdf.text(cols[i].label, x, y + 14);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, y, tableWidth, headerHeight);
    y += headerHeight;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
    drawHeader();
  };

  drawHeader();

  const rows = params.entries || [];
  for (const row of rows) {
    const cells = [row.ip, row.name, row.type, row.site, row.plan, row.url || ''];
    const linesByCol = cells.map((cell, i) => {
      const safe = String(cell || '');
      const maxWidth = Math.max(10, colWidths[i] - rowPadding * 2);
      return pdf.splitTextToSize(safe, maxWidth);
    });
    const rowHeight = Math.max(...linesByCol.map((lines) => lines.length)) * lineHeight + rowPadding * 2;
    ensureSpace(rowHeight);

    for (let i = 0; i < cols.length; i += 1) {
      const lines = linesByCol[i];
      const x = colX[i] + rowPadding;
      let textY = y + rowPadding + lineHeight;
      for (const line of lines) {
        pdf.text(line, x, textY);
        textY += lineHeight;
      }
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    y += rowHeight;
  }

  pdf.save(filename);
};

export type ClientDirectoryPdfColumnKey = 'lastName' | 'firstName' | 'role' | 'dept' | 'email' | 'mobile' | 'ext';

export const exportClientDirectoryToPdf = (params: {
  clientName: string;
  groupBy: 'dept' | 'surname';
  rows: Array<{
    lastName: string;
    firstName: string;
    role: string;
    dept: string;
    email: string;
    mobile: string;
    ext: string;
  }>;
  columns?: ClientDirectoryPdfColumnKey[];
  filename?: string;
}) => {
  const filename = params.filename || `plixmap_rubrica_${new Date().toISOString().slice(0, 10)}.pdf`;
  const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 18;
  const groupHeight = 18;
  const rowPadding = 5;
  const lineHeight = 9;

  const allCols: Array<{ key: ClientDirectoryPdfColumnKey; label: string; ratio: number }> = [
    { key: 'lastName', label: 'Cognome', ratio: 0.16 },
    { key: 'firstName', label: 'Nome', ratio: 0.14 },
    { key: 'role', label: 'Ruolo', ratio: 0.18 },
    { key: 'dept', label: 'Reparto', ratio: 0.18 },
    { key: 'email', label: 'Email', ratio: 0.2 },
    { key: 'mobile', label: 'Cellulare', ratio: 0.1 },
    { key: 'ext', label: 'Interno', ratio: 0.04 }
  ];
  const allowedColumnKeys = new Set<ClientDirectoryPdfColumnKey>(allCols.map((col) => col.key));
  const selectedColumnKeys = Array.isArray(params.columns)
    ? Array.from(new Set(params.columns.map((col) => String(col) as ClientDirectoryPdfColumnKey))).filter((col) =>
        allowedColumnKeys.has(col)
      )
    : [];
  const cols = selectedColumnKeys.length ? allCols.filter((col) => selectedColumnKeys.includes(col.key)) : allCols;
  const totalRatio = cols.reduce((sum, col) => sum + Math.max(0, Number(col.ratio) || 0), 0) || 1;
  const colWidths = cols.map((c) => Math.max(10, Math.floor((c.ratio / totalRatio) * tableWidth)));
  if (colWidths.length) {
    const used = colWidths.slice(0, -1).reduce((sum, value) => sum + value, 0);
    colWidths[colWidths.length - 1] = Math.max(10, tableWidth - used);
  }
  const colX = colWidths.reduce<number[]>((acc, _w, idx) => {
    if (idx === 0) return [margin];
    acc.push(acc[idx - 1] + colWidths[idx - 1]);
    return acc;
  }, []);

  const normalize = (value: string) => String(value || '').trim();
  const rows = (params.rows || [])
    .map((r) => ({
      lastName: normalize(r.lastName),
      firstName: normalize(r.firstName),
      role: normalize(r.role),
      dept: normalize(r.dept),
      email: normalize(r.email),
      mobile: normalize(r.mobile),
      ext: normalize(r.ext)
    }))
    .filter((r) => r.lastName || r.firstName || r.email || r.mobile || r.role || r.dept || r.ext);

  const groupKey = (row: (typeof rows)[number]) => {
    if (params.groupBy === 'dept') return row.dept || 'Senza reparto';
    const base = row.lastName || row.firstName || '#';
    const letter = base.trim().charAt(0).toUpperCase();
    return letter || '#';
  };

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = groupKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const groupKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'Senza reparto') return 1;
    if (b === 'Senza reparto') return -1;
    return a.localeCompare(b, 'it', { sensitivity: 'base' });
  });

  for (const key of groupKeys) {
    groups.get(key)?.sort((a, b) => {
      const ln = a.lastName.localeCompare(b.lastName, 'it', { sensitivity: 'base' });
      if (ln !== 0) return ln;
      return a.firstName.localeCompare(b.firstName, 'it', { sensitivity: 'base' });
    });
  }

  const printedAt = new Date();
  const printedLabel = `Stampato il ${printedAt.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })}`;
  let y = margin;
  const drawPageHeader = (isFirst: boolean) => {
    const clientLabel = params.clientName || '';
    const title = clientLabel ? `${clientLabel} - Rubrica aziendale` : 'Rubrica aziendale';
    if (isFirst) {
      pdf.setFillColor(224, 242, 254);
      pdf.roundedRect(margin, y - 4, tableWidth, 46, 12, 12, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(13.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(title, margin + 14, y + 18);
      pdf.setFontSize(7.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text(printedLabel, margin + tableWidth - pdf.getTextWidth(printedLabel) - 14, y + 18);
      pdf.setTextColor(0);
      y += 54;
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.25);
      pdf.setTextColor(30);
      if (clientLabel) pdf.text(clientLabel, margin, y + 12);
      pdf.text(printedLabel, margin + tableWidth - pdf.getTextWidth(printedLabel), y + 12);
      pdf.setTextColor(0);
      y += 28;
    }
  };

  const drawTableHeader = () => {
    pdf.setFillColor(219, 234, 254);
    pdf.rect(margin, y, tableWidth, headerHeight, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.75);
    for (let i = 0; i < cols.length; i += 1) {
      const x = colX[i] + rowPadding;
      pdf.text(cols[i].label, x, y + 14);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.75);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, y, tableWidth, headerHeight);
    y += headerHeight;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
    drawPageHeader(false);
    drawTableHeader();
  };

  drawPageHeader(true);
  drawTableHeader();

  for (const key of groupKeys) {
    const list = groups.get(key) || [];
    ensureSpace(groupHeight);
    pdf.setFillColor(220, 252, 231);
    pdf.roundedRect(margin, y + 1, tableWidth, groupHeight - 2, 8, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(22, 101, 52);
    pdf.text(`${key} (${list.length})`, margin + 10, y + 13);
    pdf.setTextColor(0);
    y += groupHeight;

    for (const row of list) {
      const cells = cols.map((col) => String(row[col.key] || ''));
      const linesByCol = cells.map((cell, i) => {
        const safe = String(cell || '');
        const maxWidth = Math.max(10, colWidths[i] - rowPadding * 2);
        return pdf.splitTextToSize(safe, maxWidth);
      });
      const rowHeight = Math.max(...linesByCol.map((lines) => lines.length)) * lineHeight + rowPadding * 2;
      ensureSpace(rowHeight);
      for (let i = 0; i < cols.length; i += 1) {
        const lines = linesByCol[i];
        const x = colX[i] + rowPadding;
        let textY = y + rowPadding + lineHeight;
        const isNameCol = cols[i].key === 'lastName' || cols[i].key === 'firstName';
        pdf.setFont('helvetica', isNameCol ? 'bold' : 'normal');
        pdf.setFontSize(6.75);
        for (const line of lines) {
          pdf.text(line, x, textY);
          textY += lineHeight;
        }
      }
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
      y += rowHeight;
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100);
    const label = `${p}/${totalPages}`;
    pdf.text(label, pageWidth - margin - pdf.getTextWidth(label), pageHeight - margin + 8);
    pdf.setTextColor(0);
  }

  pdf.save(filename);
};
