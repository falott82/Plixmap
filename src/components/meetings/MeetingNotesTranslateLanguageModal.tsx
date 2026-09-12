/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Languages, Loader2, X } from 'lucide-react';
import { TRANSLATE_LANGUAGE_OPTIONS } from './MeetingNotesModal.helpers';

// Translation-language picker modal extracted from MeetingNotesModal.
export const MeetingNotesTranslateLanguageModal = (props: any) => {
  const {
    translateLanguageModalOpen,
    closeTranslateLanguageModal,
    translateDialogInitialFocusRef,
    translateDialogCloseButtonRef,
    translateLanguageCode,
    setTranslateLanguageCode,
    confirmTranslateLanguage,
    aiBusy,
    t
  } = props;
  return (
      <Transition show={translateLanguageModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[145]" onClose={closeTranslateLanguageModal} initialFocus={translateDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={translateDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Seleziona lingua di traduzione', en: 'Select translation language' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Scegli una lingua tra le più usate al mondo e Italiano.',
                          en: 'Choose one language among the most used worldwide and Italian.'
                        })}
                      </div>
                    </div>
                    <button
                      ref={translateDialogCloseButtonRef}
                      type="button"
                      onClick={closeTranslateLanguageModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi selezione lingua', en: 'Close language selector' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
                    {TRANSLATE_LANGUAGE_OPTIONS.map((option) => {
                      const active = translateLanguageCode === option.code;
                      return (
                        <button
                          key={`translate-lang-${option.code}`}
                          type="button"
                          onClick={() => setTranslateLanguageCode(option.code)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                          title={t({ it: `Traduci in ${option.label}`, en: `Translate to ${option.label}` })}
                        >
                          <span className="text-xl leading-none">{option.flag}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{option.label}</span>
                            <span className="block truncate text-xs opacity-80">{option.native}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={closeTranslateLanguageModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Annulla selezione lingua', en: 'Cancel language selection' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmTranslateLanguage()}
                      disabled={!!aiBusy}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                      title={t({ it: 'Conferma lingua e avvia traduzione', en: 'Confirm language and start translation' })}
                    >
                      {aiBusy === 'translate' ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
                      {t({ it: 'Traduci', en: 'Translate' })}
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
