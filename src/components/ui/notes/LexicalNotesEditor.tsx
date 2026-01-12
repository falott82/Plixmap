import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $createParagraphNode,
  $getSelection,
  $getRoot,
  $isRangeSelection,
  $isTextNode,
  $insertNodes,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type EditorState,
  type LexicalEditor
} from 'lexical';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableCellNodeFromLexicalNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  INSERT_TABLE_COMMAND,
  TableCellHeaderStates
} from '@lexical/table';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Eraser, Image as ImageIcon, Link as LinkIcon, List, ListOrdered, ListX, Plus, Table2, Underline, Italic, Undo2, Redo2, Minus } from 'lucide-react';
import { useT } from '../../../i18n/useT';
import { formatBytes, uploadLimits, uploadMimes, validateFile } from '../../../utils/files';
import { useToastStore } from '../../../store/useToast';
import { lexicalTheme } from './lexicalTheme';
import { ImageNode, INSERT_IMAGE_COMMAND, registerImageInsertCommand } from './nodes/ImageNode';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { $getSelectionStyleValueForProperty, $patchStyleText, $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { HorizontalRuleNode as ReactHorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND as REACT_INSERT_HR_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { $getNearestNodeFromDOMNode } from 'lexical';

export interface LexicalNotesEditorHandle {
  getHtml: () => string;
  getStateJson: () => string;
  focus: () => void;
}

interface Props {
  initialStateJson?: string;
  initialHtml?: string;
  readOnly?: boolean;
  className?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onRequestFocus?: () => void;
}

const clampInt = (value: number, min: number, max: number) => {
  const v = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, v));
};

const isSafeHref = (href: string) => {
  const h = String(href || '').trim();
  if (!h) return false;
  if (/^javascript:/i.test(h)) return false;
  if (/^data:/i.test(h)) return false;
  if (/^mailto:/i.test(h)) return true;
  if (/^https?:\/\//i.test(h)) return true;
  return false;
};

const LinkInsertModal = ({
  open,
  onClose,
  onInsert
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: { url: string }) => void;
}) => {
  const t = useT();
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setUrl('https://');
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [open]);

  if (!open) return null;

  const commit = () => {
    const next = String(url || '').trim();
    if (!next) return;
    onInsert({ url: next });
  };

  return (
    <div
      className="fixed inset-0 z-[60]"
      onMouseDown={() => onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card" onMouseDown={(e) => e.stopPropagation()}>
          <div className="text-lg font-semibold text-ink">{t({ it: 'Inserisci link', en: 'Insert link' })}</div>
          <div className="mt-1 text-sm text-slate-600">
            {t({
              it: 'Inserisci un URL completo (es. https://...). Suggerimento: Cmd/Ctrl+Click sul link per aprirlo in una nuova tab.',
              en: 'Enter a full URL (e.g. https://...). Tip: Cmd/Ctrl+Click a link to open it in a new tab.'
            })}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700">{t({ it: 'URL', en: 'URL' })}</label>
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
              placeholder="https://example.com"
              autoFocus
            />
            <div className="mt-2 text-xs text-slate-500">
              {t({ it: 'Sono supportati https://, http:// e mailto:.', en: 'Supported: https://, http:// and mailto:.' })}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              {t({ it: 'Annulla', en: 'Cancel' })}
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={!String(url || '').trim() || !isSafeHref(url)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
            >
              {t({ it: 'Applica', en: 'Apply' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TableInsertModal = ({
  open,
  onClose,
  onInsert
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: { rows: number; columns: number; highlightHeaderRow: boolean; highlightHeaderColumn: boolean }) => void;
}) => {
  const t = useT();
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [highlightHeaderRow, setHighlightHeaderRow] = useState(true);
  const [highlightHeaderColumn, setHighlightHeaderColumn] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(3);
    setColumns(3);
    setHighlightHeaderRow(true);
    setHighlightHeaderColumn(false);
  }, [open]);

  if (!open) return null;

  const commit = () => {
    onInsert({
      rows: clampInt(rows, 1, 12),
      columns: clampInt(columns, 1, 8),
      highlightHeaderRow,
      highlightHeaderColumn
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60]"
      onMouseDown={() => onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card" onMouseDown={(e) => e.stopPropagation()}>
          <div className="text-lg font-semibold text-ink">{t({ it: 'Inserisci tabella', en: 'Insert table' })}</div>
          <div className="mt-1 text-sm text-slate-600">
            {t({
              it: 'Scegli righe e colonne. Puoi anche evidenziare la prima riga e/o la prima colonna.',
              en: 'Choose rows and columns. You can also highlight the first row and/or the first column.'
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">{t({ it: 'Colonne', en: 'Columns' })}</label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setColumns((v) => clampInt(v - 1, 1, 8))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={columns}
                  onChange={(e) => setColumns(clampInt(Number(e.target.value || 0), 1, 8))}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none ring-primary/30 focus:ring-2"
                />
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setColumns((v) => clampInt(v + 1, 1, 8))}
                >
                  +
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-500">{t({ it: 'Da 1 a 8', en: 'From 1 to 8' })}</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">{t({ it: 'Righe', en: 'Rows' })}</label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setRows((v) => clampInt(v - 1, 1, 12))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={rows}
                  onChange={(e) => setRows(clampInt(Number(e.target.value || 0), 1, 12))}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none ring-primary/30 focus:ring-2"
                />
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setRows((v) => clampInt(v + 1, 1, 12))}
                >
                  +
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-500">{t({ it: 'Da 1 a 12', en: 'From 1 to 12' })}</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-800">{t({ it: 'Aspetto (opzionale)', en: 'Appearance (optional)' })}</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={highlightHeaderRow}
                  onChange={(e) => setHighlightHeaderRow(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                />
                {t({ it: 'Evidenzia prima riga', en: 'Highlight first row' })}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={highlightHeaderColumn}
                  onChange={(e) => setHighlightHeaderColumn(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                />
                {t({ it: 'Evidenzia prima colonna', en: 'Highlight first column' })}
              </label>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {t({
                it: 'Se disattivi entrambe, la tabella resterà tutta bianca.',
                en: 'If you disable both, the table will stay fully white.'
              })}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              {t({ it: 'Annulla', en: 'Cancel' })}
            </button>
            <button
              type="button"
              onClick={commit}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              {t({ it: 'Inserisci', en: 'Insert' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TableManageModal = ({
  open,
  onClose,
  disabled,
  onAction
}: {
  open: boolean;
  onClose: () => void;
  disabled: boolean;
  onAction: (action: 'rowAbove' | 'rowBelow' | 'colLeft' | 'colRight' | 'delRow' | 'delCol' | 'delTable') => void;
}) => {
  const t = useT();
  if (!open) return null;
  const btnCls =
    'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';
  return (
    <div className="fixed inset-0 z-[60]" onMouseDown={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-ink">{t({ it: 'Gestisci tabella', en: 'Manage table' })}</div>
              <div className="mt-1 text-sm text-slate-600">
                {disabled
                  ? t({
                      it: 'Posiziona il cursore dentro una tabella per abilitare queste azioni.',
                      en: 'Place the cursor inside a table to enable these actions.'
                    })
                  : t({
                      it: 'Aggiungi o rimuovi righe/colonne dalla tabella corrente.',
                      en: 'Add or remove rows/columns from the current table.'
                    })}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
              ×
            </button>
          </div>

          <div className="mt-5 space-y-2">
            <button disabled={disabled} className={btnCls} onClick={() => onAction('rowAbove')}>
              <span>{t({ it: 'Aggiungi riga sopra', en: 'Insert row above' })}</span>
            </button>
            <button disabled={disabled} className={btnCls} onClick={() => onAction('rowBelow')}>
              <span>{t({ it: 'Aggiungi riga sotto', en: 'Insert row below' })}</span>
            </button>
            <button disabled={disabled} className={btnCls} onClick={() => onAction('colLeft')}>
              <span>{t({ it: 'Aggiungi colonna a sinistra', en: 'Insert column left' })}</span>
            </button>
            <button disabled={disabled} className={btnCls} onClick={() => onAction('colRight')}>
              <span>{t({ it: 'Aggiungi colonna a destra', en: 'Insert column right' })}</span>
            </button>
            <div className="my-2 h-px bg-slate-200" />
            <button disabled={disabled} className={btnCls} onClick={() => onAction('delRow')}>
              <span className="text-rose-700">{t({ it: 'Elimina riga', en: 'Delete row' })}</span>
            </button>
            <button disabled={disabled} className={btnCls} onClick={() => onAction('delCol')}>
              <span className="text-rose-700">{t({ it: 'Elimina colonna', en: 'Delete column' })}</span>
            </button>
            <button disabled={disabled} className={btnCls} onClick={() => onAction('delTable')}>
              <span className="text-rose-700">{t({ it: 'Elimina tabella', en: 'Delete table' })}</span>
            </button>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              {t({ it: 'Chiudi', en: 'Close' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Toolbar = ({
  readOnly,
  onPickImage,
  onToggleLink,
  onInsertTable,
  onManageTable,
  onInsertHorizontalRule,
  onClearFormatting
}: {
  readOnly: boolean;
  onPickImage: () => void;
  onToggleLink: () => void;
  onInsertTable: () => void;
  onManageTable: () => void;
  onInsertHorizontalRule: () => void;
  onClearFormatting: () => void;
}) => {
  const t = useT();
  const [editor] = useLexicalComposerContext();
  const [fontFamily, setFontFamily] = useState<string>('ui-sans-serif');
  const [fontSize, setFontSize] = useState<string>('14px');
  const [blockType, setBlockType] = useState<'p' | 'h1' | 'h2' | 'h3' | 'quote'>('p');

  const exec = (cmd: any, payload?: any) => {
    if (readOnly) return;
    editor.dispatchCommand(cmd, payload);
  };

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const ff = $getSelectionStyleValueForProperty(selection, 'font-family', 'ui-sans-serif');
        const fs = $getSelectionStyleValueForProperty(selection, 'font-size', '14px');
        setFontFamily(ff || 'ui-sans-serif');
        setFontSize(fs || '14px');
        // Block type best-effort based on anchor parent
        const anchor = selection.anchor.getNode();
        const parent: any = anchor.getTopLevelElementOrThrow?.() || anchor.getParentOrThrow?.();
        const tag = String(parent?.getTag?.() || '').toLowerCase();
        if (tag === 'h1' || tag === 'h2' || tag === 'h3') setBlockType(tag as any);
        else if (parent?.getType?.() === 'quote') setBlockType('quote');
        else setBlockType('p');
      });
    });
  }, [editor]);

  const applyFontFamily = (value: string) => {
    if (readOnly) return;
    setFontFamily(value);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $patchStyleText(selection, { 'font-family': value });
    });
  };

  const applyFontSize = (value: string) => {
    if (readOnly) return;
    setFontSize(value);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $patchStyleText(selection, { 'font-size': value });
    });
  };

  const applyBlock = (value: typeof blockType) => {
    if (readOnly) return;
    setBlockType(value);
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (value === 'p') {
        $setBlocksType(selection, () => $createParagraphNode());
        return;
      }
      if (value === 'quote') {
        $setBlocksType(selection, () => $createQuoteNode());
        return;
      }
      $setBlocksType(selection, () => $createHeadingNode(value));
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-2">
      <button
        type="button"
        disabled={readOnly}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        title={t({ it: 'Annulla', en: 'Undo' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Undo2 size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        title={t({ it: 'Ripeti', en: 'Redo' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Redo2 size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          onClearFormatting();
        }}
        title={t({ it: 'Rimuovi formattazione', en: 'Clear formatting' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Eraser size={16} />
      </button>

      <div className="mx-1 h-8 w-px bg-slate-200" />

      <select
        disabled={readOnly}
        value={blockType}
        onChange={(e) => applyBlock(e.target.value as any)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none disabled:opacity-50"
        title={t({ it: 'Stile paragrafo', en: 'Paragraph style' })}
      >
        <option value="p">{t({ it: 'Paragrafo', en: 'Paragraph' })}</option>
        <option value="h1">{t({ it: 'Titolo 1', en: 'Heading 1' })}</option>
        <option value="h2">{t({ it: 'Titolo 2', en: 'Heading 2' })}</option>
        <option value="h3">{t({ it: 'Titolo 3', en: 'Heading 3' })}</option>
        <option value="quote">{t({ it: 'Citazione', en: 'Quote' })}</option>
      </select>

      <select
        disabled={readOnly}
        value={fontFamily}
        onChange={(e) => applyFontFamily(e.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none disabled:opacity-50"
        title={t({ it: 'Font', en: 'Font' })}
      >
        <option value="ui-sans-serif">{t({ it: 'Predefinito', en: 'Default' })}</option>
        <option value="system-ui">System UI</option>
        <option value="Inter, ui-sans-serif, system-ui">Inter</option>
        <option value="Manrope, ui-sans-serif, system-ui">Manrope</option>
        <option value={'"Space Grotesk", ui-sans-serif, system-ui'}>Space Grotesk</option>
        <option value="Roboto, ui-sans-serif, system-ui">Roboto</option>
        <option value={'"Segoe UI", ui-sans-serif, system-ui'}>Segoe UI</option>
        <option value="Arial">Arial</option>
        <option value="Georgia">Georgia</option>
        <option value="Times New Roman">Times</option>
        <option value="Courier New">Courier</option>
      </select>

      <select
        disabled={readOnly}
        value={fontSize}
        onChange={(e) => applyFontSize(e.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none disabled:opacity-50"
        title={t({ it: 'Dimensione testo', en: 'Text size' })}
      >
        <option value="12px">12</option>
        <option value="14px">14</option>
        <option value="16px">16</option>
        <option value="18px">18</option>
        <option value="22px">22</option>
      </select>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => applyFontSize(`${Math.max(10, (parseInt(fontSize, 10) || 14) - 1)}px`)}
        title={t({ it: 'Riduci dimensione', en: 'Decrease size' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Minus size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => applyFontSize(`${Math.min(48, (parseInt(fontSize, 10) || 14) + 1)}px`)}
        title={t({ it: 'Aumenta dimensione', en: 'Increase size' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Plus size={16} />
      </button>

      <div className="mx-1 h-8 w-px bg-slate-200" />

      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(FORMAT_TEXT_COMMAND, 'bold')}
        title={t({ it: 'Grassetto', en: 'Bold' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(FORMAT_TEXT_COMMAND, 'italic')}
        title={t({ it: 'Corsivo', en: 'Italic' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(FORMAT_TEXT_COMMAND, 'underline')}
        title={t({ it: 'Sottolineato', en: 'Underline' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Underline size={16} />
      </button>

      <div className="mx-1 h-8 w-px bg-slate-200" />

      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        title={t({ it: 'Elenco puntato', en: 'Bulleted list' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <List size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(INSERT_ORDERED_LIST_COMMAND, undefined)}
        title={t({ it: 'Elenco numerato', en: 'Numbered list' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <ListOrdered size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(REMOVE_LIST_COMMAND, undefined)}
        title={t({ it: 'Rimuovi elenco', en: 'Remove list' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <ListX size={16} />
      </button>

      <div className="mx-1 h-8 w-px bg-slate-200" />

      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(FORMAT_ELEMENT_COMMAND, 'left')}
        title={t({ it: 'Allinea a sinistra', en: 'Align left' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <AlignLeft size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(FORMAT_ELEMENT_COMMAND, 'center')}
        title={t({ it: 'Centra', en: 'Align center' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <AlignCenter size={16} />
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => exec(FORMAT_ELEMENT_COMMAND, 'right')}
        title={t({ it: 'Allinea a destra', en: 'Align right' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <AlignRight size={16} />
      </button>

      <div className="mx-1 h-8 w-px bg-slate-200" />

      <button
        type="button"
        disabled={readOnly}
        onClick={onToggleLink}
        title={t({ it: 'Inserisci link', en: 'Insert link' })}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <LinkIcon size={16} />
      </button>

      <InsertMenu
        disabled={readOnly}
        onInsertImage={onPickImage}
        onInsertTable={onInsertTable}
        onManageTable={onManageTable}
        onInsertHorizontalRule={onInsertHorizontalRule}
      />
    </div>
  );
};

const InsertMenu = ({
  disabled,
  onInsertImage,
  onInsertTable,
  onManageTable,
  onInsertHorizontalRule
}: {
  disabled: boolean;
  onInsertImage: () => void;
  onInsertTable: () => void;
  onManageTable: () => void;
  onInsertHorizontalRule: () => void;
}) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (el.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={t({ it: 'Inserisci', en: 'Insert' })}
        className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Plus size={16} />
        {t({ it: 'Inserisci', en: 'Insert' })}
        <ChevronDown size={16} className="text-slate-400" />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-card">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
            onClick={() => {
              onInsertHorizontalRule();
              setOpen(false);
            }}
          >
            <span className="h-4 w-4 rounded bg-slate-200" />
            {t({ it: 'Linea orizzontale', en: 'Horizontal rule' })}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
            title={t({
              it: `Inserisci immagine (JPG/PNG/WEBP, max ${formatBytes(uploadLimits.noteImageBytes)})`,
              en: `Insert image (JPG/PNG/WEBP, max ${formatBytes(uploadLimits.noteImageBytes)})`
            })}
            onClick={() => {
              onInsertImage();
              setOpen(false);
            }}
          >
            <ImageIcon size={16} className="text-slate-500" />
            {t({ it: 'Immagine', en: 'Image' })}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
            onClick={() => {
              onInsertTable();
              setOpen(false);
            }}
          >
            <Table2 size={16} className="text-slate-500" />
            {t({ it: 'Tabella', en: 'Table' })}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
            onClick={() => {
              onManageTable();
              setOpen(false);
            }}
          >
            <ChevronDown size={16} className="text-slate-500" />
            {t({ it: 'Gestisci tabella', en: 'Manage table' })}
          </button>
        </div>
      ) : null}
    </div>
  );
};

const EditorInner = forwardRef<LexicalNotesEditorHandle, Props>(
  ({ initialStateJson, readOnly = false, onDirtyChange, onRequestFocus }, ref) => {
    const t = useT();
    const push = useToastStore((s) => s.push);
    const [editor] = useLexicalComposerContext();
    const [stateJson, setStateJson] = useState<string>(initialStateJson || '');
    const baselineRef = useRef<string>(initialStateJson || '');
    const [tableOpen, setTableOpen] = useState(false);
    const [tableManageOpen, setTableManageOpen] = useState(false);
    const [tableOpsEnabled, setTableOpsEnabled] = useState(false);
    const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => registerImageInsertCommand(editor), [editor]);
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          setTableOpsEnabled(false);
          return;
        }
        const cell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
        setTableOpsEnabled(!!cell);
      });
    });
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => {
        let html = '';
        editor.getEditorState().read(() => {
          html = $generateHtmlFromNodes(editor, null);
        });
        return html;
      },
      getStateJson: () => stateJson,
      focus: () => editor.focus()
    }),
    [editor, stateJson]
  );

  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickImage = () => fileRef.current?.click();

  const clearFormatting = () => {
    if (readOnly) return;
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        for (const n of selection.getNodes()) {
          if ($isTextNode(n)) {
            n.setFormat(0);
            n.setStyle('');
          }
        }
      }
    });
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
  };

  const toggleLink = () => {
    if (readOnly) return;
    setLinkOpen(true);
  };

  const insertTable = () => setTableOpen(true);

  const commitInsertTable = (payload: { rows: number; columns: number; highlightHeaderRow: boolean; highlightHeaderColumn: boolean }) => {
    if (readOnly) return;
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: String(payload.columns), rows: String(payload.rows) } as any);
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      let node: any = selection.anchor.getNode();
      let table: TableNode | null = null;
      while (node) {
        if (node instanceof TableNode) {
          table = node;
          break;
        }
        node = node.getParent?.();
      }
      if (!table) return;

      const rows = table.getChildren().filter((r) => r instanceof TableRowNode) as TableRowNode[];
      rows.forEach((row, rowIndex) => {
        const cells = row.getChildren().filter((c) => c instanceof TableCellNode) as TableCellNode[];
        cells.forEach((cell, colIndex) => {
          let headerState = 0;
          if (payload.highlightHeaderRow && rowIndex === 0) headerState |= TableCellHeaderStates.ROW;
          if (payload.highlightHeaderColumn && colIndex === 0) headerState |= TableCellHeaderStates.COLUMN;
          cell.setHeaderStyles(headerState, TableCellHeaderStates.BOTH);
        });
      });
    });
    setTableOpen(false);
    editor.focus();
  };

  useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div>
      <Toolbar
        readOnly={readOnly}
        onPickImage={pickImage}
        onToggleLink={toggleLink}
        onInsertTable={insertTable}
        onManageTable={() => setTableManageOpen(true)}
        onInsertHorizontalRule={() => editor.dispatchCommand(REACT_INSERT_HR_COMMAND, undefined)}
        onClearFormatting={clearFormatting}
      />
      <LinkInsertModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onInsert={({ url }) => {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
          setLinkOpen(false);
          editor.focus();
        }}
      />
      <TableInsertModal open={tableOpen} onClose={() => setTableOpen(false)} onInsert={commitInsertTable} />
      <TableManageModal
        open={tableManageOpen}
        onClose={() => setTableManageOpen(false)}
        disabled={!tableOpsEnabled || readOnly}
        onAction={(action) => {
          if (readOnly) return;
          editor.update(() => {
            if (action === 'rowAbove') $insertTableRowAtSelection(false);
            if (action === 'rowBelow') $insertTableRowAtSelection(true);
            if (action === 'colLeft') $insertTableColumnAtSelection(false);
            if (action === 'colRight') $insertTableColumnAtSelection(true);
            if (action === 'delRow') $deleteTableRowAtSelection();
            if (action === 'delCol') $deleteTableColumnAtSelection();
            if (action === 'delTable') {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                const cell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
                const tableNode = cell?.getParent()?.getParent?.();
                (tableNode as any)?.remove?.();
              }
            }
          });
          setTableManageOpen(false);
          editor.focus();
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const validation = validateFile(f, {
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
            e.currentTarget.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const src = String(reader.result || '');
            if (!src.startsWith('data:image/')) return;
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src });
          };
          reader.readAsDataURL(f);
          e.currentTarget.value = '';
        }}
      />

      <div
        className="mt-3 min-h-[260px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-inner outline-none ring-primary/30 focus-within:ring-2"
        onMouseDown={() => onRequestFocus?.()}
        onClickCapture={(e) => {
          // Cmd/Ctrl+Click opens links in a new tab (without messing with selection/editing).
          if (!e.metaKey && !e.ctrlKey) return;
          let el = e.target as HTMLElement | null;
          while (el && el !== e.currentTarget) {
            if (el instanceof HTMLAnchorElement) {
              const href = el.getAttribute('href') || '';
              if (isSafeHref(href)) {
                e.preventDefault();
                e.stopPropagation();
                window.open(href, '_blank', 'noopener,noreferrer');
              }
              return;
            }
            el = el.parentElement;
          }
        }}
        onContextMenuCapture={(e) => {
          // Right-click on a table opens the table management menu.
          if (readOnly) return;
          const target = e.target as HTMLElement | null;
          if (!target) return;
          const table = target.closest?.('table');
          if (!table) return;
          e.preventDefault();
          e.stopPropagation();
          // Ensure selection is inside the clicked table, so operations work immediately.
          editor.update(() => {
            const nearest = $getNearestNodeFromDOMNode(target);
            if (nearest) {
              const cell = $getTableCellNodeFromLexicalNode(nearest);
              if (cell && (cell as any).select) (cell as any).select(0);
            }
          });
          setTableManageOpen(true);
        }}
      >
        <RichTextPlugin
          contentEditable={<ContentEditable className="min-h-[220px] outline-none" />}
          placeholder={<div className="text-sm text-slate-400">{t({ it: 'Scrivi qui…', en: 'Write here…' })}</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <TablePlugin />
        <HorizontalRulePlugin />
        <OnChangePlugin
          onChange={(editorState: EditorState) => {
            const next = JSON.stringify(editorState.toJSON());
            setStateJson(next);
            if (!baselineRef.current) {
              baselineRef.current = next;
              onDirtyChange?.(false);
              return;
            }
            onDirtyChange?.(next !== baselineRef.current);
          }}
        />
      </div>
    </div>
  );
});
EditorInner.displayName = 'LexicalNotesEditorInner';

const initEditorState = (editor: LexicalEditor, initialStateJson?: string, initialHtml?: string) => {
  if (initialStateJson) {
    try {
      const parsed = editor.parseEditorState(initialStateJson);
      editor.setEditorState(parsed);
      return;
    } catch {
      // fall back to HTML
    }
  }
  if (initialHtml) {
    try {
      editor.update(() => {
        const doc = new DOMParser().parseFromString(String(initialHtml || ''), 'text/html');
        const nodes = $generateNodesFromDOM(editor, doc);
        const root = $getRoot();
        root.clear();
        if (nodes.length) $insertNodes(nodes);
        if (!root.getFirstChild()) root.append($createParagraphNode());
      });
      return;
    } catch {
      // ignore
    }
  }
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    root.append($createParagraphNode());
  });
};

const LexicalNotesEditor = forwardRef<LexicalNotesEditorHandle, Props>(
  ({ initialStateJson, initialHtml, readOnly, className, onDirtyChange, onRequestFocus }, ref) => {
  const initialConfig = useMemo(
    () => ({
      namespace: 'DesklyClientNotes',
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        LinkNode,
        TableNode,
        TableRowNode,
        TableCellNode,
        ImageNode,
        ReactHorizontalRuleNode
      ],
      theme: lexicalTheme,
      onError: () => {},
      editable: !readOnly,
      editorState: (editor: LexicalEditor) => initEditorState(editor, initialStateJson, initialHtml)
    }),
    [initialHtml, initialStateJson, readOnly]
  );

  return (
    <div className={className}>
      <LexicalComposer initialConfig={initialConfig as any}>
        <EditorInner
          ref={ref}
          initialStateJson={initialStateJson}
          readOnly={!!readOnly}
          onDirtyChange={onDirtyChange}
          onRequestFocus={onRequestFocus}
        />
      </LexicalComposer>
    </div>
  );
});
LexicalNotesEditor.displayName = 'LexicalNotesEditor';

export default LexicalNotesEditor;
