import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronDown, Eye, FileDown, FileText, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Client, ClientNote } from '../../store/types';
import { useLang, useT } from '../../i18n/useT';
import { sanitizeHtmlBasic } from '../../utils/sanitizeHtml';
import { exportClientNotesToPdf } from '../../utils/pdf';
import { useAuthStore } from '../../store/useAuthStore';
import { readFileAsDataUrl } from '../../utils/files';
import LexicalNotesEditor, { type LexicalNotesEditorHandle } from '../ui/notes/LexicalNotesEditor';
import { useDataStore } from '../../store/useDataStore';

interface Props {
  open: boolean;
  client?: Client;
  readOnly?: boolean;
  onClose: () => void;
  onSave: (payload: Partial<Client> & { notes: ClientNote[]; attachments?: { id: string; name: string; dataUrl: string }[] }) => void;
}

const formatStamp = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toNotesArray = (client?: Client): ClientNote[] => {
  if (!client) return [];
  if (Array.isArray(client.notes) && client.notes.length) return client.notes;
  const legacyHtml = sanitizeHtmlBasic(String(client.notesHtml || ''));
  const legacyLex = String(client.notesLexical || '');
  const hasLegacy = !!legacyHtml.trim() || !!legacyLex.trim();
  if (!hasLegacy) return [];
  return [
    {
      id: 'legacy',
      title: 'General',
      notesHtml: legacyHtml || undefined,
      notesLexical: legacyLex || undefined,
      updatedAt: client.notesUpdatedAt,
      updatedBy: client.notesUpdatedBy
    }
  ];
};

const ClientNotesModal = ({ open, client, readOnly = false, onClose, onSave }: Props) => {
  const t = useT();
  const lang = useLang();
  const user = useAuthStore((s) => s.user);
  const clientList = useDataStore((s) =>
    s.clients.map((c) => ({ id: c.id, label: c.shortName || c.name || c.id }))
  );
  const setClients = useDataStore((s: any) => s.setClients);
  const allClients = useDataStore((s) => s.clients);
  const editorRef = useRef<LexicalNotesEditorHandle | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingEditorFocusRef = useRef(false);

  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | { kind: 'close' | 'switch' | 'delete'; nextId?: string; deleteId?: string }>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const newTitleRef = useRef<HTMLInputElement | null>(null);

  const [attachments, setAttachments] = useState<{ id: string; name: string; dataUrl: string }[]>([]);
  const [query, setQuery] = useState('');
  const initializedRef = useRef<{ open: boolean; clientId?: string }>({ open: false, clientId: undefined });
  const [noteMenu, setNoteMenu] = useState<null | { noteId: string; x: number; y: number }>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySourceId, setCopySourceId] = useState<string | null>(null);
  const [copyQuery, setCopyQuery] = useState('');
  const [copyTargetId, setCopyTargetId] = useState<string | null>(null);

  const draggingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextClientId = client?.id;
    const shouldInit =
      !initializedRef.current.open || initializedRef.current.clientId !== nextClientId;
    if (!shouldInit) return;
    initializedRef.current = { open: true, clientId: nextClientId };

    const initialNotes = toNotesArray(client);
    setNotes(initialNotes);
    setSelectedId(initialNotes[0]?.id || null);
    setDirty(false);
    setQuery('');
    setAttachments(client?.attachments || []);
    setCreateOpen(false);
    setNewTitle('');

    // One-time migration: if the client has legacy fields but no notes array, persist the migrated notes and clear legacy fields.
    if (client && (!Array.isArray(client.notes) || client.notes.length === 0) && (client.notesHtml || client.notesLexical)) {
      if (initialNotes.length && initialNotes[0]?.id === 'legacy') {
        const migrated: ClientNote[] = [
          {
            ...initialNotes[0],
            id: nanoid(),
            title: t({ it: 'Generale', en: 'General' })
          }
        ];
        setNotes(migrated);
        setSelectedId(migrated[0].id);
        onSave({
          notes: migrated,
          notesHtml: undefined,
          notesLexical: undefined,
          notesUpdatedAt: undefined,
          notesUpdatedBy: undefined,
          attachments: (client.attachments || []).length ? client.attachments : undefined
        });
      }
    }
  }, [client?.id, open]);

  useEffect(() => {
    if (!open) return;
    // Keep attachments in sync while the modal is open (without re-initializing notes selection).
    setAttachments(client?.attachments || []);
  }, [client?.attachments, open]);

  useEffect(() => {
    if (!open) {
      initializedRef.current = { open: false, clientId: undefined };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!createOpen) return;
    window.setTimeout(() => newTitleRef.current?.focus(), 0);
  }, [createOpen, open]);

  useEffect(() => {
    if (!open) return;
    if (!pendingEditorFocusRef.current) return;
    pendingEditorFocusRef.current = false;
    window.setTimeout(() => editorRef.current?.focus(), 0);
  }, [open, selectedId]);

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) || null, [notes, selectedId]);

  const canEdit = !readOnly;

  const lastSavedLabel = useMemo(() => {
    if (!selected?.updatedAt) return t({ it: 'Non salvato', en: 'Not saved yet' });
    const stamp = formatStamp(selected.updatedAt);
    const by = selected.updatedBy?.username;
    return `${t({ it: 'Ultimo salvataggio', en: 'Last saved' })} ${stamp}${by ? ` · ${by}` : ''}`;
  }, [selected?.updatedAt, selected?.updatedBy?.username, t]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    const normalize = (s: string) =>
      String(s || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const stripHtml = (html: string) =>
      String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|h1|h2|h3|tr|table|blockquote)>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
    return notes.filter((n) => {
      const hay = normalize(`${n.title} ${n.updatedBy?.username || ''} ${stripHtml(n.notesHtml || '')}`);
      return hay.includes(q);
    });
  }, [notes, query]);

  const saveSelected = (): ClientNote | null => {
    if (!selected) return null;
    if (!canEdit) return selected;
    const notesLexical = editorRef.current?.getStateJson() || '';
    const html = editorRef.current?.getHtml() || '';
    const notesHtml = sanitizeHtmlBasic(html);
    const updatedAt = Date.now();
    const updatedBy = user?.id && user?.username ? { id: user.id, username: user.username } : undefined;
    const next: ClientNote = { ...selected, notesHtml, notesLexical: notesLexical || undefined, updatedAt, updatedBy };
    setNotes((prev) => prev.map((n) => (n.id === selected.id ? next : n)));
    setDirty(false);
    return next;
  };

  const getSnapshotForNote = (id: string): ClientNote | null => {
    const base = notes.find((n) => n.id === id) || null;
    if (!base) return null;
    if (id !== selectedId) return base;
    // If duplicating/copying the currently opened note, include unsaved edits.
    const notesLexical = editorRef.current?.getStateJson() || base.notesLexical || '';
    const html = editorRef.current?.getHtml() || base.notesHtml || '';
    const notesHtml = sanitizeHtmlBasic(html);
    return { ...base, notesHtml, notesLexical: notesLexical || undefined };
  };

  const persistAll = (nextNotes: ClientNote[]) => {
    onSave({
      notes: nextNotes,
      attachments: attachments.length ? attachments : undefined,
      // Always clear legacy single-note fields once we write multi-notes.
      notesHtml: undefined,
      notesLexical: undefined,
      notesUpdatedAt: undefined,
      notesUpdatedBy: undefined
    });
  };

  const doSave = () => {
    const updatedSelected = saveSelected();
    const nextNotes = notes.map((n) => (updatedSelected && n.id === updatedSelected.id ? updatedSelected : n));
    persistAll(nextNotes);
  };

  const requestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    setConfirmAction({ kind: 'close' });
  };

  const requestSwitch = (nextId: string) => {
    if (nextId === selectedId) return;
    if (!dirty) {
      setSelectedId(nextId);
      return;
    }
    setConfirmAction({ kind: 'switch', nextId });
  };

  const requestDelete = (id: string) => {
    setConfirmAction({ kind: 'delete', deleteId: id });
  };

  const openCreate = () => {
    if (!canEdit) return;
    setNewTitle('');
    setCreateOpen(true);
  };

  const createNote = () => {
    if (!canEdit) return;
    const title = (newTitle || '').trim();
    if (!title) return;
    const next: ClientNote = { id: nanoid(), title };
    const nextNotes = [next, ...notes];
    setNotes(nextNotes);
    setSelectedId(next.id);
    setDirty(false);
    setCreateOpen(false);
    setNewTitle('');
    persistAll(nextNotes);
    pendingEditorFocusRef.current = true;
  };

  const duplicateNoteLocal = (sourceId: string) => {
    if (!canEdit) return;
    const src = getSnapshotForNote(sourceId);
    if (!src) return;
    const updatedAt = Date.now();
    const updatedBy = user?.id && user?.username ? { id: user.id, username: user.username } : undefined;
    const copy: ClientNote = {
      ...src,
      id: nanoid(),
      title: `${src.title} ${t({ it: '(copia)', en: '(copy)' })}`,
      updatedAt,
      updatedBy
    };
    const idx = notes.findIndex((n) => n.id === sourceId);
    const nextNotes = notes.slice();
    nextNotes.splice(idx + 1, 0, copy);
    setNotes(nextNotes);
    setSelectedId(copy.id);
    setDirty(false);
    persistAll(nextNotes);
    pendingEditorFocusRef.current = true;
  };

  const copyNoteToClient = (sourceId: string, targetClientId: string) => {
    if (!canEdit) return;
    const src = getSnapshotForNote(sourceId);
    if (!src) return;
    const updatedAt = Date.now();
    const updatedBy = user?.id && user?.username ? { id: user.id, username: user.username } : undefined;
    const copy: ClientNote = {
      ...src,
      id: nanoid(),
      title: `${src.title} ${t({ it: '(copia)', en: '(copy)' })}`,
      updatedAt,
      updatedBy
    };
    const nextClients = allClients.map((c) => {
      if (c.id !== targetClientId) return c;
      const nextNotes = Array.isArray((c as any).notes) ? ([...(c as any).notes] as ClientNote[]) : [];
      nextNotes.unshift(copy);
      return { ...c, notes: nextNotes } as any;
    });
    setClients(nextClients);
  };

  return (
    <>
      <Transition show={open} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            // Prevent closing the main modal while a confirmation dialog is open (it would treat it as an outside click).
            if (confirmAction || createOpen) return;
            requestClose();
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-card">
                  <div className="flex items-stretch">
                    {/* Left notes list */}
                    <div className="w-80 border-r border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between gap-2 px-4 py-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <FileText size={16} className="text-slate-600" />
                            {t({ it: 'Note cliente', en: 'Client notes' })}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-600">
                            {client ? client.shortName || client.name : ''}
                          </div>
                        </div>
                        <button
                          onClick={requestClose}
                          className="text-slate-500 hover:text-ink"
                          title={t({ it: 'Chiudi', en: 'Close' })}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="px-4 pb-3">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <Search size={16} className="text-slate-400" />
                          <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t({ it: 'Cerca note...', en: 'Search notes...' })}
                            className="w-full bg-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="px-4 pb-3">
                        <button
                          disabled={!canEdit}
                          onClick={openCreate}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          title={t({ it: 'Crea una nuova nota', en: 'Create a new note' })}
                        >
                          <Plus size={16} /> {t({ it: 'Nuova nota', en: 'New note' })}
                        </button>
                      </div>

                      <div className="max-h-[70vh] overflow-auto px-2 pb-4">
                        {filteredNotes.length ? (
                          filteredNotes.map((n) => {
                            const active = n.id === selectedId;
                            return (
                              <button
                                key={n.id}
                                onClick={() => requestSwitch(n.id)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setNoteMenu({ noteId: n.id, x: e.clientX, y: e.clientY });
                                }}
                                draggable
                                onDragStart={() => {
                                  draggingIdRef.current = n.id;
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const movingId = draggingIdRef.current;
                                  draggingIdRef.current = null;
                                  if (!movingId || movingId === n.id) return;
                                  const from = notes.findIndex((x) => x.id === movingId);
                                  const to = notes.findIndex((x) => x.id === n.id);
                                  if (from === -1 || to === -1) return;
                                  const nextNotes = notes.slice();
                                  const [m] = nextNotes.splice(from, 1);
                                  const insertAt = from < to ? Math.max(0, to - 1) : to;
                                  nextNotes.splice(insertAt, 0, m);
                                  setNotes(nextNotes);
                                  persistAll(nextNotes);
                                }}
                                className={`mb-2 w-full rounded-xl border px-3 py-3 text-left ${
                                  active ? 'border-primary bg-white' : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-ink">{n.title}</div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {n.updatedAt ? `${formatStamp(n.updatedAt)}${n.updatedBy?.username ? ` · ${n.updatedBy.username}` : ''}` : t({ it: 'Mai salvata', en: 'Never saved' })}
                                    </div>
                                  </div>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        requestDelete(n.id);
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                      title={t({ it: 'Elimina nota', en: 'Delete note' })}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                            {t({ it: 'Nessuna nota. Crea una nuova nota per iniziare.', en: 'No notes yet. Create a new note to start.' })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right editor */}
                    <div className="flex-1 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Dialog.Title className="text-lg font-semibold text-ink">
                            {selected ? selected.title : t({ it: 'Seleziona una nota', en: 'Select a note' })}
                          </Dialog.Title>
                          <div className="mt-1 text-xs text-slate-500">{selected ? lastSavedLabel : null}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              const label = client?.shortName || client?.name || 'client';
                              const html = editorRef.current?.getHtml() || selected?.notesHtml || '';
                              await exportClientNotesToPdf({
                                clientLabel: `${label} — ${selected?.title || ''}`.trim(),
                                notesHtml: sanitizeHtmlBasic(html),
                                lang,
                                filename: `deskly_client_notes_${label.replace(/[^\w-]+/g, '_')}_${(selected?.title || 'note').replace(/[^\w-]+/g, '_')}.pdf`
                              });
                            }}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                            title={t({ it: 'Esporta nota in PDF', en: 'Export note to PDF' })}
                          >
                            <FileDown size={16} className="text-slate-600" />
                            {t({ it: 'Esporta PDF', en: 'Export PDF' })}
                          </button>
                          <button
                            onClick={doSave}
                            disabled={!canEdit || !selected}
                            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            title={t({ it: 'Salva nota', en: 'Save note' })}
                          >
                            {t({ it: 'Salva', en: 'Save' })}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        {selected ? (
                          <LexicalNotesEditor
                            ref={editorRef}
                            key={`${client?.id || 'client'}:${selected.id}:${selected.updatedAt || 0}`}
                            initialStateJson={selected.notesLexical || undefined}
                            initialHtml={sanitizeHtmlBasic(String(selected.notesHtml || '')) || undefined}
                            readOnly={!canEdit}
                            onDirtyChange={setDirty}
                            onRequestFocus={() => editorRef.current?.focus()}
                          />
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
                            {t({ it: 'Seleziona o crea una nota dal pannello a sinistra.', en: 'Select or create a note from the left panel.' })}
                          </div>
                        )}
                      </div>

                      {/* Attachments (client-scoped) */}
                      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <ChevronDown size={16} className="text-slate-600" />
                            {t({ it: 'Allegati PDF cliente', en: 'Client PDF attachments' })}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              ref={fileRef}
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              multiple
                              onChange={async (e) => {
                                if (!canEdit) return;
                                const files = Array.from(e.target.files || []);
                                if (!files.length) return;
                                const next: { id: string; name: string; dataUrl: string }[] = [];
                                for (const f of files) {
                                  const dataUrl = await readFileAsDataUrl(f);
                                  next.push({ id: nanoid(), name: f.name, dataUrl });
                                }
                                setAttachments((prev) => [...prev, ...next]);
                                e.currentTarget.value = '';
                              }}
                            />
                            <button
                              disabled={!canEdit}
                              onClick={() => fileRef.current?.click()}
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              title={t({ it: 'Carica PDF per questo cliente', en: 'Upload PDFs for this client' })}
                            >
                              <Upload size={16} className="text-slate-500" /> {t({ it: 'Aggiungi', en: 'Add' })}
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {attachments.length ? (
                            attachments.map((a) => (
                              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                <div className="min-w-0 truncate text-sm font-semibold text-ink">{a.name}</div>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={a.dataUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                                    title={t({ it: 'Apri', en: 'Open' })}
                                  >
                                    <Eye size={16} />
                                  </a>
                                  <a
                                    href={a.dataUrl}
                                    download={a.name}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                                    title={t({ it: 'Scarica', en: 'Download' })}
                                  >
                                    <FileDown size={16} />
                                  </a>
                                  <button
                                    disabled={!canEdit}
                                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    title={t({ it: 'Rimuovi', en: 'Remove' })}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                              {t({ it: 'Nessun allegato.', en: 'No attachments.' })}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            onClick={requestClose}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                          >
                            {t({ it: 'Chiudi', en: 'Close' })}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Note context menu (kept inside Dialog to avoid FocusTrap blocking interaction) */}
                  {noteMenu ? (
                    <div className="fixed inset-0 z-[70]" onMouseDown={() => setNoteMenu(null)}>
                      <div
                        className="absolute w-64 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
                        style={{ top: noteMenu.y, left: noteMenu.x }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Nota', en: 'Note' })}</div>
                        <button
                          disabled={!canEdit}
                          onClick={() => {
                            duplicateNoteLocal(noteMenu.noteId);
                            setNoteMenu(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Plus size={14} className="text-slate-500" />
                          {t({ it: 'Duplica', en: 'Duplicate' })}
                        </button>
                        <button
                          disabled={!canEdit}
                          onClick={() => {
                            setCopyOpen(true);
                            setCopySourceId(noteMenu.noteId);
                            setCopyTargetId(null);
                            setCopyQuery('');
                            setNoteMenu(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <FileText size={14} className="text-slate-500" />
                          {t({ it: 'Copia su altro cliente…', en: 'Copy to another client…' })}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Copy note to another client (kept inside Dialog to avoid FocusTrap blocking interaction) */}
                  {copyOpen ? (
                    <div className="fixed inset-0 z-[70]" onMouseDown={() => setCopyOpen(false)}>
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                      <div className="relative flex min-h-full items-center justify-center p-4">
                        <div
                          className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-semibold text-ink">{t({ it: 'Copia nota', en: 'Copy note' })}</div>
                            <button
                              onClick={() => setCopyOpen(false)}
                              className="text-slate-500 hover:text-ink"
                              title={t({ it: 'Chiudi', en: 'Close' })}
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {t({
                              it: 'Scegli il cliente di destinazione. La nota verrà copiata come nuova nota.',
                              en: 'Choose the destination client. The note will be copied as a new note.'
                            })}
                          </div>

                          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                            <Search size={16} className="text-slate-400" />
                            <input
                              value={copyQuery}
                              onChange={(e) => setCopyQuery(e.target.value)}
                              placeholder={t({ it: 'Cerca cliente...', en: 'Search client...' })}
                              className="w-full bg-transparent outline-none"
                            />
                          </div>

                          <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-200">
                            {clientList
                              .filter((c) => c.label.toLowerCase().includes(copyQuery.trim().toLowerCase()))
                              .map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => setCopyTargetId(c.id)}
                                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                                    copyTargetId === c.id ? 'bg-primary/5' : ''
                                  }`}
                                >
                                  <span className="font-semibold text-ink">{c.label}</span>
                                  {copyTargetId === c.id ? (
                                    <span className="text-xs text-primary">{t({ it: 'Selezionato', en: 'Selected' })}</span>
                                  ) : null}
                                </button>
                              ))}
                          </div>

                          <div className="mt-5 flex justify-end gap-2">
                            <button
                              onClick={() => setCopyOpen(false)}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                            >
                              {t({ it: 'Annulla', en: 'Cancel' })}
                            </button>
                            <button
                              disabled={!copyTargetId}
                              onClick={() => {
                                if (!copySourceId || !copyTargetId) return;
                                copyNoteToClient(copySourceId, copyTargetId);
                                setCopyOpen(false);
                              }}
                              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
                            >
                              {t({ it: 'Copia', en: 'Copy' })}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Confirm actions (kept inside Dialog to avoid FocusTrap stealing input focus) */}
                  {confirmAction ? (
                    <div className="fixed inset-0 z-[60]" onMouseDown={() => setConfirmAction(null)}>
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                      <div className="relative flex min-h-full items-center justify-center p-4">
                        <div
                          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-semibold text-ink">
                              {confirmAction.kind === 'delete'
                                ? t({ it: 'Eliminare la nota?', en: 'Delete note?' })
                                : t({ it: 'Modifiche non salvate', en: 'Unsaved changes' })}
                            </div>
                            <button
                              onClick={() => setConfirmAction(null)}
                              className="text-slate-500 hover:text-ink"
                              title={t({ it: 'Chiudi', en: 'Close' })}
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {confirmAction.kind === 'delete'
                              ? t({
                                  it: `Vuoi eliminare la nota "${notes.find((n) => n.id === confirmAction.deleteId)?.title || ''}"? Questa azione è irreversibile.`,
                                  en: `Delete the note "${notes.find((n) => n.id === confirmAction.deleteId)?.title || ''}"? This action cannot be undone.`
                                })
                              : t({
                                  it: 'Hai modifiche non salvate. Scegli come procedere.',
                                  en: 'You have unsaved changes. Choose how to proceed.'
                                })}
                          </div>
                          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <button
                              onClick={() => setConfirmAction(null)}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t({ it: 'Annulla', en: 'Cancel' })}
                            </button>
                            {confirmAction.kind === 'delete' ? (
                              <button
                                onClick={() => {
                                  const id = confirmAction.deleteId!;
                                  const nextNotes = notes.filter((n) => n.id !== id);
                                  setNotes(nextNotes);
                                  if (selectedId === id) setSelectedId(nextNotes[0]?.id || null);
                                  setDirty(false);
                                  persistAll(nextNotes);
                                  setConfirmAction(null);
                                }}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                {t({ it: 'Elimina', en: 'Delete' })}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    doSave();
                                    const action = confirmAction;
                                    setConfirmAction(null);
                                    if (action.kind === 'close') onClose();
                                    if (action.kind === 'switch' && action.nextId) setSelectedId(action.nextId);
                                  }}
                                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                                >
                                  {t({ it: 'Salva', en: 'Save' })}
                                </button>
                                <button
                                  onClick={() => {
                                    const action = confirmAction;
                                    setDirty(false);
                                    setConfirmAction(null);
                                    if (action.kind === 'close') onClose();
                                    if (action.kind === 'switch' && action.nextId) setSelectedId(action.nextId);
                                  }}
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                                >
                                  {t({ it: 'Continua senza salvare', en: 'Continue without saving' })}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Create note modal (kept inside Dialog to avoid FocusTrap stealing input focus) */}
                  {createOpen ? (
                    <div
                      className="fixed inset-0 z-[60]"
                      onMouseDown={() => setCreateOpen(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setCreateOpen(false);
                      }}
                    >
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                      <div className="relative flex min-h-full items-center justify-center p-4">
                        <div
                          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-semibold text-ink">{t({ it: 'Nuova nota', en: 'New note' })}</div>
                            <button
                              onClick={() => setCreateOpen(false)}
                              className="text-slate-500 hover:text-ink"
                              title={t({ it: 'Chiudi', en: 'Close' })}
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {t({
                              it: 'Scegli un titolo chiaro (es. “Riunioni”, “Impianti”, “Note operative”).',
                              en: 'Pick a clear title (e.g. “Meetings”, “Systems”, “Operational notes”).'
                            })}
                          </div>

                          <div className="mt-4">
                            <label className="block text-sm font-semibold text-slate-700">{t({ it: 'Titolo', en: 'Title' })}</label>
                            <input
                              ref={newTitleRef}
                              autoFocus
                              value={newTitle}
                              onChange={(e) => setNewTitle(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Es. Note operative', en: 'e.g. Operational notes' })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  createNote();
                                }
                              }}
                            />
                          </div>

                          <div className="mt-6 flex justify-end gap-2">
                            <button
                              onClick={() => setCreateOpen(false)}
                              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t({ it: 'Annulla', en: 'Cancel' })}
                            </button>
                            <button
                              onClick={createNote}
                              disabled={!newTitle.trim()}
                              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
                            >
                              {t({ it: 'Crea', en: 'Create' })}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default ClientNotesModal;
