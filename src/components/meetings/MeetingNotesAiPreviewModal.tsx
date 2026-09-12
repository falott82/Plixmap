/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Save, X } from 'lucide-react';

// AI transform (translate/correct) preview modal extracted from MeetingNotesModal.
export const MeetingNotesAiPreviewModal = (props: any) => {
  const { aiPreview, closeAiPreview, aiDialogInitialFocusRef, aiDialogCloseButtonRef, aiDraftText, setAiDraftText, canEditSelected, applyAiPreviewToNote, saving, t } = props;
  return (
      <Transition show={!!aiPreview} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[150]"
          onClose={closeAiPreview}
          initialFocus={aiDialogInitialFocusRef}
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
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
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
                <Dialog.Panel className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={aiDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {aiPreview?.mode === 'translate'
                          ? t({ it: 'Anteprima traduzione selezione', en: 'Selection translation preview' })
                          : t({ it: 'Anteprima correzione selezione', en: 'Selection correction preview' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {aiPreview?.mode === 'translate' && aiPreview.targetLanguage
                          ? t({ it: `Lingua: ${aiPreview.targetLanguage}`, en: `Language: ${aiPreview.targetLanguage}` })
                          : t({ it: 'Controlla il risultato prima di applicarlo', en: 'Review the result before applying' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeAiPreview}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi anteprima AI', en: 'Close AI preview' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-4">
                    <textarea
                      value={String(aiDraftText || aiPreview?.transformedText || '')}
                      onChange={(e) => setAiDraftText(e.target.value)}
                      rows={14}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      ref={aiDialogCloseButtonRef}
                      type="button"
                      onClick={closeAiPreview}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Chiudi senza applicare', en: 'Close without applying changes' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    {canEditSelected ? (
                      <button
                        type="button"
                        onClick={(e) => applyAiPreviewToNote(e)}
                        disabled={saving || !String(aiDraftText || aiPreview?.transformedText || '').trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                        title={t({
                          it: 'Sostituisci solo il testo selezionato con questa anteprima',
                          en: 'Replace only selected text with this preview'
                        })}
                      >
                        <Save size={14} />
                        {t({ it: 'Sostituisci testo selezionato', en: 'Replace selected text' })}
                      </button>
                    ) : null}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
