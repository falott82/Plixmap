/* eslint-disable @typescript-eslint/no-explicit-any */
import { Download, Languages, Loader2, Plus, Save, Share2, SpellCheck, Trash2 } from 'lucide-react';
import LexicalNotesEditor from '../ui/notes/LexicalNotesEditor';
import { formatStamp } from './MeetingNotesModal.helpers';

// "Notes" tab (note list + Lexical editor + AI/export actions) extracted from MeetingNotesModal.
export const MeetingNotesNotesTab = (props: any) => {
  const {
    notes,
    canEditNote,
    selectedId,
    shared,
    setShared,
    requestNewNote,
    onSelect,
    setTimelineScheduleContextMenu,
    setNoteContextMenu,
    sharedOthers,
    noteTitleInputRef,
    title,
    setTitle,
    canEditSelected,
    setDirty,
    editorRef,
    noteEditorContainerRef,
    editorKey,
    selectedNote,
    noteSaveButtonRef,
    save,
    saving,
    openTranslateLanguageModal,
    aiBusy,
    runAiTransform,
    exportCsv,
    exporting,
    meeting,
    remove,
    t
  } = props;
  return (
                          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[330px,minmax(0,1fr)]">
                            <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Appunti', en: 'Notes' })}</div>
                                <button
                                  type="button"
                                  onClick={requestNewNote}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                  title={t({ it: 'Crea un nuovo appunto', en: 'Create a new note' })}
                                >
                                  <Plus size={12} />
                                  {t({ it: 'Nuovo', en: 'New' })}
                                </button>
                              </div>
                              <div className="min-h-0 space-y-1 overflow-auto pr-1">
                                {notes.map((n: any) => {
                                  const mine = canEditNote(n);
                                  const isSelected = String(selectedId) === String(n.id);
                                  const effectiveShared = isSelected ? shared : !!n.shared;
                                  return (
                                    <button
                                      key={n.id}
                                      type="button"
                                      onClick={() => onSelect(String(n.id))}
                                      onContextMenu={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setTimelineScheduleContextMenu(null);
                                        setNoteContextMenu({
                                          noteId: String(n.id),
                                          x: Math.min(event.clientX, window.innerWidth - 220),
                                          y: Math.min(event.clientY, window.innerHeight - 180)
                                        });
                                      }}
                                      className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${
                                        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                      }`}
                                      title={t({ it: 'Tasto destro: duplica, condividi, elimina', en: 'Right click: duplicate, share, delete' })}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="truncate font-semibold">{n.title || t({ it: 'Senza titolo', en: 'Untitled' })}</div>
                                        <span
                                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                            effectiveShared ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700'
                                          }`}
                                        >
                                          {effectiveShared ? t({ it: 'Condiviso', en: 'Shared' }) : mine ? t({ it: 'Mio', en: 'Mine' }) : t({ it: 'Privato', en: 'Private' })}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 truncate text-[10px] text-slate-500">{n.authorDisplayName || n.authorUsername || '-'}</div>
                                      <div className="mt-0.5 truncate text-[10px] text-slate-500">{formatStamp(Number(n.updatedAt || 0))}</div>
                                    </button>
                                  );
                                })}
                              </div>
                              {sharedOthers.length ? (
                                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-2 py-2 text-[11px] text-violet-800">
                                  {sharedOthers.length} {t({ it: 'appunti condivisi da altri partecipanti', en: 'shared notes from other participants' })}
                                </div>
                              ) : null}
                            </aside>

                            <main className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr),auto]">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t({ it: 'Titolo', en: 'Title' })}
                                  <input
                                    ref={noteTitleInputRef}
                                    value={title}
                                    onChange={(e) => {
                                      setTitle(e.target.value);
                                      if (canEditSelected) setDirty(true);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key !== 'Tab' || event.shiftKey) return;
                                      event.preventDefault();
                                      editorRef.current?.focus();
                                    }}
                                    disabled={!canEditSelected}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                    placeholder={t({ it: 'Titolo appunto', en: 'Note title' })}
                                  />
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 md:self-end">
                                  <input
                                    type="checkbox"
                                    checked={shared}
                                    disabled={!canEditSelected}
                                    onChange={(e) => {
                                      setShared(e.target.checked);
                                      if (canEditSelected) setDirty(true);
                                    }}
                                    title={t({ it: 'Attiva/disattiva condivisione appunto con i partecipanti', en: 'Enable/disable note sharing with participants' })}
                                  />
                                  <Share2 size={14} />
                                  {t({ it: 'Condividi con i partecipanti', en: 'Share with participants' })}
                                </label>
                              </div>

                              <div
                                ref={noteEditorContainerRef}
                                className="mt-2 min-h-[220px] flex-1 overflow-hidden"
                                onKeyDownCapture={(event) => {
                                  if (event.key !== 'Tab') return;
                                  if (event.shiftKey) {
                                    event.preventDefault();
                                    noteTitleInputRef.current?.focus();
                                    return;
                                  }
                                  event.preventDefault();
                                  noteSaveButtonRef.current?.focus();
                                }}
                              >
                                <LexicalNotesEditor
                                  key={`meeting-note-editor-${editorKey}-${selectedId}`}
                                  ref={editorRef}
                                  readOnly={!canEditSelected}
                                  initialStateJson={selectedNote?.contentLexical || ''}
                                  initialHtml={selectedNote?.contentHtml || ''}
                                  className="h-full"
                                  onDirtyChange={(next) => {
                                    if (!canEditSelected) return;
                                    setDirty(!!next);
                                  }}
                                />
                              </div>

                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
                                <div className="text-xs text-slate-500">
                                  {selectedNote
                                    ? `${t({ it: 'Autore', en: 'Author' })}: ${selectedNote.authorDisplayName || selectedNote.authorUsername || '-'} • ${formatStamp(
                                        Number(selectedNote.updatedAt || 0)
                                      )}`
                                    : t({ it: 'Nuovo appunto', en: 'New note' })}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    ref={noteSaveButtonRef}
                                    type="button"
                                    onClick={() => void save()}
                                    disabled={saving || !canEditSelected}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
                                    title={t({
                                      it: 'Salva nota (⌘/Ctrl+S). Nuova nota: ⌘/Ctrl+N',
                                      en: 'Save note (⌘/Ctrl+S). New note: ⌘/Ctrl+N'
                                    })}
                                  >
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    {t({ it: 'Salva', en: 'Save' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={openTranslateLanguageModal}
                                    disabled={!!aiBusy}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    title={t({
                                      it: 'Traduce solo la selezione di testo con AI (⌘/Ctrl+Shift+T)',
                                      en: 'Translate only selected text with AI (⌘/Ctrl+Shift+T)'
                                    })}
                                  >
                                    {aiBusy === 'translate' ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
                                    {t({ it: 'Translate selection', en: 'Translate selection' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void runAiTransform('correct')}
                                    disabled={!!aiBusy}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    title={t({
                                      it: 'Corregge solo la selezione di testo con AI (⌘/Ctrl+Shift+C)',
                                      en: 'Correct only selected text with AI (⌘/Ctrl+Shift+C)'
                                    })}
                                  >
                                    {aiBusy === 'correct' ? <Loader2 size={13} className="animate-spin" /> : <SpellCheck size={13} />}
                                    {t({ it: 'Correct selection', en: 'Correct selection' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void exportCsv()}
                                    disabled={exporting || !meeting?.id}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    title={t({ it: 'Esporta appunti in formato CSV', en: 'Export notes as CSV' })}
                                  >
                                    <Download size={13} />
                                    {exporting ? 'CSV…' : 'CSV'}
                                  </button>
                                  {selectedNote && canEditSelected ? (
                                    <button
                                      type="button"
                                      onClick={() => void remove()}
                                      disabled={saving}
                                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                      title={t({ it: 'Elimina appunto selezionato', en: 'Delete selected note' })}
                                    >
                                      <Trash2 size={13} />
                                      {t({ it: 'Elimina', en: 'Delete' })}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </main>
                          </div>
  );
};
