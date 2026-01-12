import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  ListX,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Table2,
  Undo2,
  Redo2,
  Eraser
} from 'lucide-react';
import { useT } from '../../i18n/useT';
import { formatBytes, uploadLimits, uploadMimes, validateFile } from '../../utils/files';
import { useToastStore } from '../../store/useToast';

interface Props {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  className?: string;
}

type TableContext = { cell: HTMLTableCellElement; rowIndex: number; colIndex: number; table: HTMLTableElement };
type ImageOverlay = { visible: boolean; x: number; y: number; w: number; h: number };

const RichTextEditor = ({ value, onChange, readOnly = false, className }: Props) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastValue = useRef<string>('');
  const savedRangeRef = useRef<Range | null>(null);
  const tableCtxRef = useRef<TableContext | null>(null);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const [hasTableCtx, setHasTableCtx] = useState(false);
  const [hasImageCtx, setHasImageCtx] = useState(false);
  const [imageSize, setImageSize] = useState<string>('100');
  const [imgOverlay, setImgOverlay] = useState<ImageOverlay>({ visible: false, x: 0, y: 0, w: 0, h: 0 });
  const rafOverlayRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Keep editor content in sync when opening/loading.
    if (lastValue.current === value) return;
    ref.current.innerHTML = value || '';
    lastValue.current = value || '';
  }, [value]);

  const updateImageOverlay = () => {
    const wrapper = wrapperRef.current;
    const root = ref.current;
    const img = selectedImgRef.current;
    if (!wrapper || !root || !img || !img.isConnected || !wrapper.contains(root) || !root.contains(img) || readOnly) {
      setImgOverlay((s) => (s.visible ? { ...s, visible: false } : s));
      return;
    }
    const wRect = wrapper.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    const x = r.left - wRect.left;
    const y = r.top - wRect.top;
    setImgOverlay({ visible: true, x, y, w: r.width, h: r.height });
  };

  const scheduleOverlay = () => {
    if (rafOverlayRef.current) cancelAnimationFrame(rafOverlayRef.current);
    rafOverlayRef.current = requestAnimationFrame(() => {
      rafOverlayRef.current = null;
      updateImageOverlay();
    });
  };

  useEffect(() => {
    scheduleOverlay();
    const onResize = () => scheduleOverlay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasImageCtx, readOnly]);

  const saveSelection = () => {
    const root = ref.current;
    if (!root) return;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    const inEditor = root.contains(r.startContainer) && root.contains(r.endContainer);
    if (!inEditor) return;
    savedRangeRef.current = r.cloneRange();
  };

  const restoreSelection = () => {
    const root = ref.current;
    const range = savedRangeRef.current;
    if (!root || !range) return;
    if (!range.startContainer.isConnected || !range.endContainer.isConnected) return;
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    try {
      root.focus();
      const sel = window.getSelection?.();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // ignore
    }
  };

  const cleanupEmptyFormattingAtCaret = () => {
    const root = ref.current;
    if (!root) return;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    const node = r.startContainer;
    if (!node || !root.contains(node)) return;

    const host = node instanceof HTMLElement ? node : node.parentElement;
    if (!host) return;

    const candidate = host.closest('b,strong,i,em,u,span') as HTMLElement | null;
    if (!candidate || !root.contains(candidate)) return;

    const hasMeaningfulEl = !!candidate.querySelector('img,table,ul,ol,li');
    const text = (candidate.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (hasMeaningfulEl || text) return;

    // Only allow <br> placeholders; if so, unwrap the formatting element.
    const onlyBr = Array.from(candidate.childNodes).every((c) => (c as any).nodeType === Node.ELEMENT_NODE ? (c as any).tagName === 'BR' : String((c as any).textContent || '').trim() === '');
    if (!onlyBr) return;

    const parent = candidate.parentNode;
    if (!parent) return;

    const br = document.createElement('br');
    parent.insertBefore(br, candidate);
    candidate.remove();

    // Move caret after the inserted <br>
    try {
      const range = document.createRange();
      range.setStartAfter(br);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      saveSelection();
    } catch {
      // ignore
    }
  };

  const syncContextFromEvent = (target?: EventTarget | null) => {
    if (!ref.current) return;
    const el = (target instanceof Node ? target : null) as Node | null;
    const within = el ? ref.current.contains(el) : false;
    if (!within) {
      tableCtxRef.current = null;
      selectedImgRef.current = null;
      setHasTableCtx(false);
      setHasImageCtx(false);
      return;
    }

    const h = el instanceof HTMLElement ? el : el?.parentElement;
    if (!h) return;

    const img = h instanceof HTMLImageElement ? h : (h.closest('img') as HTMLImageElement | null);
    if (img && ref.current.contains(img)) {
      selectedImgRef.current = img;
      setHasImageCtx(true);
      const w = (img.style.width || '').trim();
      const m = /^(\d+(?:\.\d+)?)%$/.exec(w);
      if (m) setImageSize(m[1]);
      else setImageSize('100');
      scheduleOverlay();
    } else {
      selectedImgRef.current = null;
      setHasImageCtx(false);
      setImgOverlay((s) => (s.visible ? { ...s, visible: false } : s));
    }

    const cell = h.closest('td,th') as HTMLTableCellElement | null;
    const table = cell?.closest('table') as HTMLTableElement | null;
    if (cell && table && ref.current.contains(table)) {
      const row = cell.parentElement as HTMLTableRowElement | null;
      const tbody = row?.parentElement as HTMLElement | null;
      if (row && tbody) {
        const rowIndex = Array.from(tbody.children).filter((x) => x.tagName === 'TR').indexOf(row);
        const colIndex = Array.from(row.children).indexOf(cell);
        if (rowIndex >= 0 && colIndex >= 0) {
          tableCtxRef.current = { cell, rowIndex, colIndex, table };
          setHasTableCtx(true);
          return;
        }
      }
    }
    tableCtxRef.current = null;
    setHasTableCtx(false);
  };

  const fonts = useMemo(
    () => [
      { label: t({ it: 'Predefinito', en: 'Default' }), value: '' },
      { label: 'Arial', value: 'Arial' },
      { label: 'Times', value: 'Times New Roman' },
      { label: 'Courier', value: 'Courier New' },
      { label: 'Georgia', value: 'Georgia' },
      { label: 'Verdana', value: 'Verdana' }
    ],
    [t]
  );

  const sizes = useMemo(
    () => [
      { label: '10', value: '2' },
      { label: '12', value: '3' },
      { label: '16', value: '4' },
      { label: '20', value: '5' },
      { label: '24', value: '6' }
    ],
    []
  );

  const exec = (cmd: string, arg?: string) => {
    if (readOnly) return;
    try {
      restoreSelection();
      document.execCommand(cmd, false, arg);
      const html = ref.current?.innerHTML || '';
      lastValue.current = html;
      onChange(html);
      ref.current?.focus();
      saveSelection();
      cleanupEmptyFormattingAtCaret();
    } catch {
      // ignore
    }
  };

  const insertHtml = (html: string) => exec('insertHTML', html);

  const applyList = (kind: 'ul' | 'ol') => {
    if (readOnly) return;
    const root = ref.current;
    if (!root) return;
    restoreSelection();
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) {
      exec(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
      return;
    }
    const range = sel.getRangeAt(0);
    const inEditor = root.contains(range.startContainer) && root.contains(range.endContainer);
    if (!inEditor) {
      exec(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
      return;
    }

    // Robust conversion: replace the selection contents with a new list, flattening any existing list types.
    const escapeHtml = (s: string) => {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    };

    const normalizeRangeForLists = (r: Range): Range => {
      const rr = r.cloneRange();
      const startEl = rr.startContainer instanceof HTMLElement ? rr.startContainer : rr.startContainer.parentElement;
      const endEl = rr.endContainer instanceof HTMLElement ? rr.endContainer : rr.endContainer.parentElement;
      const startLi = startEl?.closest?.('li') as HTMLLIElement | null;
      const endLi = endEl?.closest?.('li') as HTMLLIElement | null;
      const startList = startLi?.closest?.('ul,ol') as HTMLElement | null;
      const endList = endLi?.closest?.('ul,ol') as HTMLElement | null;

      if (startLi && endLi && startList && endList && startList === endList) {
        rr.setStartBefore(startLi);
        rr.setEndAfter(endLi);
        return rr;
      }
      if (startLi) rr.setStartBefore(startLi);
      if (endLi) rr.setEndAfter(endLi);
      return rr;
    };

    const normalizedRange = normalizeRangeForLists(range);
    const fragment = normalizedRange.cloneContents();
    const tmp = document.createElement('div');
    tmp.appendChild(fragment);

    const lines: string[] = [];
    let current = '';
    const push = () => {
      const v = (current || '').trim();
      lines.push(v ? current : '&nbsp;');
      current = '';
    };

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        current += escapeHtml(String(node.textContent || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName.toUpperCase();

      if (tag === 'BR') {
        push();
        return;
      }

      if (tag === 'UL' || tag === 'OL') {
        const lis = Array.from(el.children).filter((c) => (c as any).tagName === 'LI') as HTMLLIElement[];
        for (const li of lis) {
          if (current.trim()) push();
          lines.push((li.innerHTML || '').trim() || '&nbsp;');
        }
        return;
      }

      if (tag === 'LI') {
        if (current.trim()) push();
        lines.push((el.innerHTML || '').trim() || '&nbsp;');
        current = '';
        return;
      }

      if (tag === 'DIV' || tag === 'P') {
        // Some browsers wrap multi-line selections into a container DIV/P. If it contains block children,
        // recurse into them to create one line per block.
        const directBlocks = Array.from(el.children).filter((c) => {
          const t = (c as HTMLElement).tagName?.toUpperCase?.() || '';
          return t === 'DIV' || t === 'P' || t === 'UL' || t === 'OL' || t === 'LI';
        }) as HTMLElement[];
        if (directBlocks.length) {
          if (current.trim()) push();
          for (const child of directBlocks) walk(child);
          return;
        }
        // Otherwise treat as a single line but keep <br> as line breaks by traversing children.
        if (current.trim()) push();
        Array.from(el.childNodes).forEach((c) => walk(c));
        push();
        return;
      }

      // Inline or other element: keep outerHTML to preserve formatting inside the same line.
      current += el.outerHTML;
    };

    Array.from(tmp.childNodes).forEach((n) => walk(n));
    if (!lines.length) push();

    const list = document.createElement(kind);
    list.style.margin = '8px 0';
    list.style.paddingLeft = '18px';
    list.style.listStylePosition = 'outside';
    list.style.listStyleType = kind === 'ol' ? 'decimal' : 'disc';
    for (const l of lines) {
      const li = document.createElement('li');
      li.innerHTML = l || '&nbsp;';
      if (!li.innerHTML.trim()) li.innerHTML = '&nbsp;';
      list.appendChild(li);
    }

    // Replace selection (use normalized range to avoid partial LI conversion)
    normalizedRange.deleteContents();
    normalizedRange.insertNode(list);

    // Place caret at end of last item
    try {
      const last = list.lastElementChild as HTMLElement | null;
      if (last) {
        const r = document.createRange();
        r.selectNodeContents(last);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
        saveSelection();
      }
    } catch {
      // ignore
    }
    onInput();
  };

  const removeList = () => {
    if (readOnly) return;
    const root = ref.current;
    if (!root) return;
    restoreSelection();
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const inEditor = root.contains(range.startContainer) && root.contains(range.endContainer);
    if (!inEditor) return;

    const startEl = range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;
    const endEl = range.endContainer instanceof HTMLElement ? range.endContainer : range.endContainer.parentElement;

    const lists = new Set<HTMLElement>();
    const a = startEl?.closest?.('ul,ol') as HTMLElement | null;
    const b = endEl?.closest?.('ul,ol') as HTMLElement | null;
    if (a && root.contains(a)) lists.add(a);
    if (b && root.contains(b)) lists.add(b);

    // Also include any lists that intersect the selection (multi-list selections).
    for (const li of Array.from(root.querySelectorAll('li'))) {
      try {
        if (!range.intersectsNode(li)) continue;
      } catch {
        continue;
      }
      const l = (li as HTMLElement).closest('ul,ol') as HTMLElement | null;
      if (l && root.contains(l)) lists.add(l);
    }

    if (!lists.size) return;

    for (const list of Array.from(lists)) {
      const parent = list.parentNode;
      if (!parent) continue;

      const before = list;
      const lis = Array.from(list.querySelectorAll(':scope > li')) as HTMLLIElement[];
      for (const li of lis) {
        const div = document.createElement('div');
        div.innerHTML = li.innerHTML || '&nbsp;';
        parent.insertBefore(div, before);
      }
      list.remove();
    }

    // Move caret to end of editor after unwrap (best effort)
    try {
      const r = document.createRange();
      r.selectNodeContents(root);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
      saveSelection();
    } catch {
      // ignore
    }

    onInput();
  };

  const onInput = () => {
    const html = ref.current?.innerHTML || '';
    lastValue.current = html;
    onChange(html);
    saveSelection();
    cleanupEmptyFormattingAtCaret();
  };

  const ensureTableCtx = (): TableContext | null => {
    const ctx = tableCtxRef.current;
    if (!ctx) return null;
    if (!ctx.table.isConnected || !ctx.cell.isConnected) return null;
    return ctx;
  };

  const addRow = (where: 'above' | 'below') => {
    if (readOnly) return;
    const ctx = ensureTableCtx();
    if (!ctx) return;
    const row = ctx.cell.parentElement as HTMLTableRowElement | null;
    if (!row) return;
    const clone = row.cloneNode(true) as HTMLTableRowElement;
    Array.from(clone.querySelectorAll('td,th')).forEach((c) => {
      c.innerHTML = '&nbsp;';
    });
    if (where === 'above') row.parentElement?.insertBefore(clone, row);
    else row.parentElement?.insertBefore(clone, row.nextSibling);
    onInput();
  };

  const deleteRow = () => {
    if (readOnly) return;
    const ctx = ensureTableCtx();
    if (!ctx) return;
    const row = ctx.cell.parentElement as HTMLTableRowElement | null;
    if (!row) return;
    row.remove();
    tableCtxRef.current = null;
    setHasTableCtx(false);
    onInput();
  };

  const addCol = (where: 'left' | 'right') => {
    if (readOnly) return;
    const ctx = ensureTableCtx();
    if (!ctx) return;
    const rows = Array.from(ctx.table.querySelectorAll('tr'));
    rows.forEach((r) => {
      const cells = Array.from(r.children) as HTMLElement[];
      const refCell = cells[Math.min(ctx.colIndex, cells.length - 1)] as HTMLElement | undefined;
      const cellTag = refCell?.tagName === 'TH' ? 'th' : 'td';
      const newCell = document.createElement(cellTag);
      newCell.setAttribute('style', refCell?.getAttribute('style') || 'border:1px solid #cbd5e1;padding:6px;');
      newCell.innerHTML = '&nbsp;';
      if (!refCell) {
        r.appendChild(newCell);
        return;
      }
      if (where === 'left') r.insertBefore(newCell, refCell);
      else r.insertBefore(newCell, refCell.nextSibling);
    });
    onInput();
  };

  const deleteCol = () => {
    if (readOnly) return;
    const ctx = ensureTableCtx();
    if (!ctx) return;
    const rows = Array.from(ctx.table.querySelectorAll('tr'));
    rows.forEach((r) => {
      const cells = Array.from(r.children);
      const c = cells[ctx.colIndex] as HTMLElement | undefined;
      if (c) c.remove();
    });
    tableCtxRef.current = null;
    setHasTableCtx(false);
    onInput();
  };

  const applyImageSize = (pct: string) => {
    if (readOnly) return;
    const img = selectedImgRef.current;
    if (!img || !img.isConnected) return;
    const v = Math.max(10, Math.min(300, Number(pct) || 100));
    img.style.width = `${v}%`;
    img.style.height = 'auto';
    img.style.maxWidth = '100%';
    setImageSize(String(v));
    onInput();
    scheduleOverlay();
  };

  const applyImageAlign = (align: 'left' | 'center' | 'right') => {
    if (readOnly) return;
    const img = selectedImgRef.current;
    if (!img || !img.isConnected) return;
    img.style.display = 'block';
    img.style.maxWidth = img.style.maxWidth || '100%';
    if (align === 'left') {
      img.style.marginLeft = '0';
      img.style.marginRight = 'auto';
    }
    if (align === 'center') {
      img.style.marginLeft = 'auto';
      img.style.marginRight = 'auto';
    }
    if (align === 'right') {
      img.style.marginLeft = 'auto';
      img.style.marginRight = '0';
    }
    // In tables, browsers sometimes keep cell-align overriding; make sure the image is treated as a block.
    const cell = img.closest('td,th') as HTMLElement | null;
    if (cell) {
      // Preserve text alignment set by the user; only ensure the cell can host a block-level centered image.
      cell.style.verticalAlign = cell.style.verticalAlign || 'top';
    }
    onInput();
    scheduleOverlay();
  };

  const beginResize = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: ReactPointerEvent) => {
    if (readOnly) return;
    const img = selectedImgRef.current;
    const wrapper = wrapperRef.current;
    if (!img || !img.isConnected || !wrapper) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = img.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = rect.width;
    const startH = rect.height;
    const aspect = startW > 0 ? startH / startW : 1;

    const signX = corner === 'ne' || corner === 'se' ? 1 : -1;
    const signY = corner === 'sw' || corner === 'se' ? 1 : -1;

    let lastW = startW;

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const dx = (ev.clientX - startX) * signX;
      const dy = (ev.clientY - startY) * signY;
      // Use the dominant axis to keep aspect ratio stable.
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      const nextW = Math.max(32, Math.min(1200, startW + delta));
      lastW = nextW;
      img.style.width = `${Math.round(nextW)}px`;
      img.style.height = `${Math.round(nextW * aspect)}px`;
      img.style.maxWidth = 'none';
      scheduleOverlay();
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      try {
        img.style.height = 'auto';
        img.style.maxWidth = '100%';
      } catch {
        // ignore
      }
      // Commit to state once (avoid heavy onChange during drag).
      if (Number.isFinite(lastW)) onInput();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false, once: true });
  };

  const promptLink = () => {
    saveSelection();
    const url = window.prompt(t({ it: 'Inserisci URL', en: 'Enter URL' }));
    if (!url) return;
    restoreSelection();
    exec('createLink', url);
  };

  const promptTable = () => {
    const cols = Math.min(8, Math.max(1, Number(window.prompt(t({ it: 'Numero colonne (1-8)', en: 'Number of columns (1-8)' }), '3')) || 3));
    const rows = Math.min(12, Math.max(1, Number(window.prompt(t({ it: 'Numero righe (1-12)', en: 'Number of rows (1-12)' }), '3')) || 3));
    const head = `<tr>${Array.from({ length: cols }).map(() => `<th style="border:1px solid #cbd5e1;padding:6px;background:#f8fafc;">&nbsp;</th>`).join('')}</tr>`;
    const body = Array.from({ length: rows })
      .map(
        () =>
          `<tr>${Array.from({ length: cols })
            .map(() => `<td style="border:1px solid #cbd5e1;padding:6px;">&nbsp;</td>`)
            .join('')}</tr>`
      )
      .join('');
    insertHtml(
      `<div style="overflow:auto"><table style="border-collapse:collapse;width:100%;margin:8px 0">${head}${body}</table></div><p></p>`
    );
  };

  const onPickImage = async (file: File) => {
    if (readOnly) return;
    const validation = validateFile(file, {
      allowedTypes: uploadMimes.images,
      maxBytes: uploadLimits.noteImageBytes
    });
    if (!validation.ok) {
      push(
        validation.reason === 'size'
          ? t({
              it: `Immagine troppo grande (max ${formatBytes(uploadLimits.noteImageBytes)}).`,
              en: `Image too large (max ${formatBytes(uploadLimits.noteImageBytes)}).`
            })
          : t({
              it: 'Formato non supportato. Usa JPG, PNG o WEBP.',
              en: 'Unsupported format. Use JPG, PNG, or WEBP.'
            }),
        'danger'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!url.startsWith('data:image/')) return;
      exec('insertImage', url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`${className || ''} relative`} ref={wrapperRef}>
      <div
        className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-2"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (!target) return;
          if (target.closest('button')) {
            // Prevent losing selection when clicking toolbar buttons (needed for links/lists).
            e.preventDefault();
          }
        }}
      >
        <button
          type="button"
          disabled={readOnly}
          onClick={() => exec('undo')}
          title={t({ it: 'Annulla', en: 'Undo' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => exec('redo')}
          title={t({ it: 'Ripeti', en: 'Redo' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Redo2 size={16} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            exec('removeFormat');
            exec('unlink');
          }}
          title={t({ it: 'Rimuovi formattazione', en: 'Clear formatting' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eraser size={16} />
        </button>

        <div className="mx-1 h-8 w-px bg-slate-200" />

        <select
          disabled={readOnly}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none disabled:opacity-50"
          title={t({ it: 'Font', en: 'Font' })}
          onChange={(e) => exec('fontName', e.target.value || undefined)}
          defaultValue=""
        >
          {fonts.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          disabled={readOnly}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none disabled:opacity-50"
          title={t({ it: 'Dimensione testo', en: 'Text size' })}
          onChange={(e) => exec('fontSize', e.target.value)}
          defaultValue="3"
        >
          {sizes.map((s) => (
            <option key={s.label} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="mx-1 h-8 w-px bg-slate-200" />

        <button
          type="button"
          disabled={readOnly}
          onClick={() => exec('bold')}
          title={t({ it: 'Grassetto', en: 'Bold' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => exec('italic')}
          title={t({ it: 'Corsivo', en: 'Italic' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => exec('underline')}
          title={t({ it: 'Sottolineato', en: 'Underline' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Underline size={16} />
        </button>

        <div className="mx-1 h-8 w-px bg-slate-200" />

        <button
          type="button"
          disabled={readOnly}
          onClick={() => applyList('ul')}
          title={t({ it: 'Elenco puntato', en: 'Bulleted list' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => applyList('ol')}
          title={t({ it: 'Elenco numerato', en: 'Numbered list' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={removeList}
          title={t({ it: 'Rimuovi elenco (lascia solo testo)', en: 'Remove list (keep text only)' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ListX size={16} />
        </button>

        <div className="mx-1 h-8 w-px bg-slate-200" />

        <button
          type="button"
          disabled={readOnly}
          onClick={() => (hasImageCtx ? applyImageAlign('left') : exec('justifyLeft'))}
          title={t({ it: 'Allinea a sinistra', en: 'Align left' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AlignLeft size={16} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => (hasImageCtx ? applyImageAlign('center') : exec('justifyCenter'))}
          title={t({ it: 'Centra', en: 'Align center' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AlignCenter size={16} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => (hasImageCtx ? applyImageAlign('right') : exec('justifyRight'))}
          title={t({ it: 'Allinea a destra', en: 'Align right' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AlignRight size={16} />
        </button>

        <div className="mx-1 h-8 w-px bg-slate-200" />

        <button
          type="button"
          disabled={readOnly}
          onClick={promptLink}
          title={t({ it: 'Inserisci link', en: 'Insert link' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LinkIcon size={16} />
        </button>

        <button
          type="button"
          disabled={readOnly}
          onClick={() => fileRef.current?.click()}
          title={t({
            it: `Inserisci immagine (JPG/PNG/WEBP, max ${formatBytes(uploadLimits.noteImageBytes)})`,
            en: `Insert image (JPG/PNG/WEBP, max ${formatBytes(uploadLimits.noteImageBytes)})`
          })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageIcon size={16} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickImage(f);
            e.currentTarget.value = '';
          }}
        />

        <button
          type="button"
          disabled={readOnly}
          onClick={promptTable}
          title={t({ it: 'Inserisci tabella', en: 'Insert table' })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Table2 size={16} />
        </button>

        <div className="mx-1 h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={readOnly || !hasTableCtx}
            onClick={() => addRow('above')}
            title={t({ it: 'Tabella: aggiungi riga sopra', en: 'Table: add row above' })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t({ it: '+ Riga ↑', en: '+ Row ↑' })}
          </button>
          <button
            type="button"
            disabled={readOnly || !hasTableCtx}
            onClick={() => addRow('below')}
            title={t({ it: 'Tabella: aggiungi riga sotto', en: 'Table: add row below' })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t({ it: '+ Riga ↓', en: '+ Row ↓' })}
          </button>
          <button
            type="button"
            disabled={readOnly || !hasTableCtx}
            onClick={() => addCol('left')}
            title={t({ it: 'Tabella: aggiungi colonna a sinistra', en: 'Table: add column left' })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t({ it: '+ Col ←', en: '+ Col ←' })}
          </button>
          <button
            type="button"
            disabled={readOnly || !hasTableCtx}
            onClick={() => addCol('right')}
            title={t({ it: 'Tabella: aggiungi colonna a destra', en: 'Table: add column right' })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t({ it: '+ Col →', en: '+ Col →' })}
          </button>
          <button
            type="button"
            disabled={readOnly || !hasTableCtx}
            onClick={deleteRow}
            title={t({ it: 'Tabella: elimina riga', en: 'Table: delete row' })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t({ it: '− Riga', en: '− Row' })}
          </button>
          <button
            type="button"
            disabled={readOnly || !hasTableCtx}
            onClick={deleteCol}
            title={t({ it: 'Tabella: elimina colonna', en: 'Table: delete column' })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t({ it: '− Col', en: '− Col' })}
          </button>
        </div>

        <div className="mx-1 h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">{t({ it: 'Immagine', en: 'Image' })}</span>
          <select
            disabled={readOnly || !hasImageCtx}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none disabled:opacity-50"
            title={t({ it: 'Ridimensiona immagine selezionata', en: 'Resize selected image' })}
            value={imageSize}
            onChange={(e) => applyImageSize(e.target.value)}
          >
            {['25', '50', '75', '100', '125', '150', '200'].map((v) => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={onInput}
        onMouseUp={(e) => {
          saveSelection();
          syncContextFromEvent(e.target);
        }}
        onKeyUp={(e) => {
          saveSelection();
          syncContextFromEvent(e.target);
        }}
        onClick={(e) => {
          saveSelection();
          syncContextFromEvent(e.target);
        }}
        onKeyDown={() => saveSelection()}
        onFocus={() => saveSelection()}
        onClickCapture={(e) => {
          // Make links "work": Cmd/Ctrl+click opens in a new tab while still allowing editing on normal click.
          const target = e.target as HTMLElement | null;
          const a = target?.closest?.('a') as HTMLAnchorElement | null;
          if (!a) return;
          if ((e as any).metaKey || (e as any).ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            try {
              window.open(a.href, '_blank', 'noreferrer');
            } catch {
              // ignore
            }
          }
        }}
        className={`mt-3 min-h-[260px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-inner outline-none ring-primary/30 focus:ring-2 [&_ul]:ml-6 [&_ul]:list-disc [&_ol]:ml-6 [&_ol]:list-decimal [&_li]:my-1 [&_a]:text-primary [&_a]:underline ${
          readOnly ? 'cursor-default bg-slate-50 text-slate-700' : ''
        }`}
        style={{ overflowWrap: 'anywhere' }}
      />

      {imgOverlay.visible ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: imgOverlay.x,
            top: imgOverlay.y,
            width: imgOverlay.w,
            height: imgOverlay.h
          }}
        >
          <div className="absolute inset-0 rounded-md ring-2 ring-primary/40" />
          {readOnly ? null : (
            <>
              <div
                className="pointer-events-auto absolute -left-2 -top-2 h-4 w-4 rounded-full border border-white bg-primary shadow"
                title={t({ it: 'Ridimensiona immagine', en: 'Resize image' })}
                onPointerDown={beginResize('nw')}
              />
              <div
                className="pointer-events-auto absolute -right-2 -top-2 h-4 w-4 rounded-full border border-white bg-primary shadow"
                title={t({ it: 'Ridimensiona immagine', en: 'Resize image' })}
                onPointerDown={beginResize('ne')}
              />
              <div
                className="pointer-events-auto absolute -left-2 -bottom-2 h-4 w-4 rounded-full border border-white bg-primary shadow"
                title={t({ it: 'Ridimensiona immagine', en: 'Resize image' })}
                onPointerDown={beginResize('sw')}
              />
              <div
                className="pointer-events-auto absolute -right-2 -bottom-2 h-4 w-4 rounded-full border border-white bg-primary shadow"
                title={t({ it: 'Ridimensiona immagine', en: 'Resize image' })}
                onPointerDown={beginResize('se')}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default RichTextEditor;
