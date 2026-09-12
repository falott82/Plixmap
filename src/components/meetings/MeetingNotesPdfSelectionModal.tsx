/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Info, X } from 'lucide-react';
import { formatStamp } from './MeetingNotesModal.helpers';

// PDF export note-selection modal extracted from MeetingNotesModal.
export const MeetingNotesPdfSelectionModal = (props: any) => {
  const {
    pdfSelectionModalOpen,
    closePdfSelectionModal,
    pdfDialogInitialFocusRef,
    pdfDialogCloseButtonRef,
    pdfFileName,
    setPdfFileName,
    notes,
    pdfSelection,
    setPdfSelection,
    selectedNotesForPdf,
    openPdfReviewModal,
    pdfExporting,
    t
  } = props;
  return (
      <Transition show={pdfSelectionModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[160]" onClose={closePdfSelectionModal} initialFocus={pdfDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={pdfDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Esporta appunti in PDF', en: 'Export notes to PDF' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Seleziona gli appunti da includere nel PDF con logo cliente, luogo meeting, invitati e footer pagine.',
                          en: 'Select notes to include in a PDF with client logo, meeting location, invited people, and page footer.'
                        })}
                      </div>
                    </div>
                    <button
                      ref={pdfDialogCloseButtonRef}
                      type="button"
                      onClick={closePdfSelectionModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi selezione PDF', en: 'Close PDF selection' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 px-4 py-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t({ it: 'Nome file PDF', en: 'PDF file name' })}
                      <input
                        type="text"
                        value={pdfFileName}
                        onChange={(event) => setPdfFileName(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Meeting-nome meeting.pdf', en: 'Meeting-meeting name.pdf' })}
                        title={t({ it: 'Puoi modificare il nome del file PDF prima della creazione', en: 'You can change the PDF file name before export' })}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, boolean> = {};
                          for (const note of notes) next[String(note.id)] = true;
                          setPdfSelection(next);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Seleziona tutti gli appunti', en: 'Select all notes' })}
                      >
                        {t({ it: 'Seleziona tutto', en: 'Select all' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfSelection({})}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Deseleziona tutti gli appunti', en: 'Clear note selection' })}
                      >
                        {t({ it: 'Deseleziona tutto', en: 'Clear all' })}
                      </button>
                      <span className="text-xs text-slate-500">
                        {selectedNotesForPdf.length}/{notes.length} {t({ it: 'appunti selezionati', en: 'notes selected' })}
                      </span>
                    </div>
                    <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                      {t({
                        it: 'L’inclusione delle note degli utenti nel PDF è facoltativa: puoi anche generare il report senza note selezionate.',
                        en: 'Including user notes in the PDF is optional: you can also generate the report without selected notes.'
                      })}
                    </div>
                    <div className="max-h-[48vh] space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                      {notes.map((note: any) => {
                        const checked = !!pdfSelection[String(note.id)];
                        return (
                          <label
                            key={`pdf-note-${note.id}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                              checked ? 'border-primary bg-primary/10' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setPdfSelection((prev: any) => ({
                                  ...prev,
                                  [String(note.id)]: event.target.checked
                                }))
                              }
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-800">{note.title || t({ it: 'Senza titolo', en: 'Untitled' })}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {note.authorDisplayName || note.authorUsername || '-'} • {formatStamp(Number(note.updatedAt || 0))}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={closePdfSelectionModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Annulla esportazione PDF', en: 'Cancel PDF export' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={openPdfReviewModal}
                      disabled={pdfExporting}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                      title={t({ it: 'Apri review del report prima della generazione PDF', en: 'Open report review before generating PDF' })}
                    >
                      <Info size={14} />
                      {t({ it: 'Rivedi report', en: 'Review report' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
