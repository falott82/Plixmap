/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

// CSV-import confirm modal + LDAP-info help modal. Extracted from CustomImportPanel.
export const CustomImportCsvLdapInfoModals = (props: any) => {
  const {
    csvConfirmOpen,
    csvConfirmDialogFocusRef,
    csvFile,
    csvImporting,
    runCsvImport,
    ldapInfoOpen,
    ldapInfoDialogFocusRef,
    setCsvConfirmOpen,
    setLdapInfoOpen,
    t,
  } = props;
  return (
      <>
      <Transition show={csvConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[130]" onClose={() => setCsvConfirmOpen(false)} initialFocus={csvConfirmDialogFocusRef}>
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
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <button ref={csvConfirmDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Import CSV', en: 'CSV import' })}</Dialog.Title>
                    <button onClick={() => setCsvConfirmOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="modal-description">
                    {t({
                      it: 'Come vuoi gestire gli utenti del CSV? Puoi sommarli agli esistenti oppure sostituire tutto (rimuove anche gli utenti reali dalla mappa).',
                      en: 'How do you want to handle CSV users? You can append to existing users or replace everything (also removes real users from the map).'
                    })}
                  </div>
                  {csvFile ? <div className="mt-3 text-xs text-slate-500">{csvFile.name}</div> : null}
                  <div className="modal-footer">
                    <button
                      onClick={() => setCsvConfirmOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Annulla import CSV', en: 'Cancel CSV import' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={() => runCsvImport('append')}
                      disabled={csvImporting}
                      className="btn-secondary disabled:opacity-60"
                      title={t({ it: 'Somma utenti del CSV', en: 'Append CSV users' })}
                    >
                      {t({ it: 'Somma utenti', en: 'Append users' })}
                    </button>
                    <button
                      onClick={() => runCsvImport('replace')}
                      disabled={csvImporting}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                      title={t({ it: 'Sostituisci tutti gli utenti con il CSV', en: 'Replace all users with CSV' })}
                    >
                      {t({ it: 'Sostituisci tutto', en: 'Replace all' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={ldapInfoOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[135]" onClose={() => setLdapInfoOpen(false)} initialFocus={ldapInfoDialogFocusRef}>
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
                <Dialog.Panel className="w-full max-w-4xl modal-panel">
                  <button ref={ldapInfoDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Guida completa configurazione LDAP', en: 'Full LDAP configuration guide' })}</Dialog.Title>
                      <div className="modal-description">
                        {t({
                          it: 'Questa guida spiega in modo semplice a cosa serve ogni campo LDAP e come influisce su test, confronto e import.',
                          en: 'This guide explains in simple terms what each LDAP field does and how it affects test, compare, and import.'
                        })}
                      </div>
                    </div>
                    <button onClick={() => setLdapInfoOpen(false)} className="icon-button" title={t({ it: 'Chiudi guida LDAP', en: 'Close LDAP guide' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 max-h-[70vh] space-y-4 overflow-auto pr-1 text-sm text-slate-700">
                    {[
                      [t({ it: 'Server LDAP', en: 'LDAP server' }), t({ it: 'Indirizzo del server LDAP. Può essere un hostname o un URL ldap:// / ldaps://.', en: 'Address of the LDAP server. It can be a hostname or an ldap:// / ldaps:// URL.' })],
                      [t({ it: 'Porta', en: 'Port' }), t({ it: 'Porta TCP del server. Di solito 636 per LDAPS e 389 per LDAP o StartTLS.', en: 'TCP port of the server. Usually 636 for LDAPS and 389 for LDAP or StartTLS.' })],
                      [t({ it: 'Sicurezza trasporto', en: 'Transport security' }), t({ it: 'Decide se la connessione è cifrata subito con LDAPS, alzata poi con StartTLS oppure lasciata in LDAP semplice.', en: 'Decides whether the connection is encrypted immediately with LDAPS, upgraded with StartTLS, or left as plain LDAP.' })],
                      [t({ it: 'Scope ricerca', en: 'Search scope' }), t({ it: 'Decide quanto in profondità cercare dal Base DN: solo figli diretti oppure tutta la subtree.', en: 'Decides how deep to search from the Base DN: only direct children or the whole subtree.' })],
                      [t({ it: 'Autenticazione', en: 'Authentication' }), t({ it: 'Decide come costruire l’identità del bind: Simple usa solo Utente, Dominio\\utente usa entrambi i campi, utente@dominio costruisce la UPN, Anonima non usa credenziali.', en: 'Decides how to build the bind identity: Simple uses only User, Domain\\user uses both fields, user@domain builds the UPN, Anonymous uses no credentials.' })],
                      [t({ it: 'Dominio', en: 'Domain' }), t({ it: 'Serve solo per Dominio\\utente e utente@dominio. In simple bind e anonima può restare vuoto.', en: 'Used only for Domain\\user and user@domain. It can stay empty for simple bind and anonymous.' })],
                      [t({ it: 'Utente', en: 'User' }), t({ it: 'Nome dell’account LDAP usato per il bind.', en: 'Name of the LDAP account used for bind.' })],
                      [t({ it: 'Password', en: 'Password' }), t({ it: 'Password dell’account LDAP. Se la lasci vuota durante una modifica, viene mantenuta quella già salvata.', en: 'Password of the LDAP account. If you leave it empty while editing, the previously saved one is kept.' })],
                      [t({ it: 'Base DN', en: 'Base DN' }), t({ it: 'Punto di partenza della ricerca LDAP, per esempio DC=example,DC=com oppure OU=People,DC=example,DC=com.', en: 'Starting point of the LDAP search, for example DC=example,DC=com or OU=People,DC=example,DC=com.' })],
                      [t({ it: 'Filtro utenti LDAP', en: 'LDAP user filter' }), t({ it: 'Filtro RFC4515 che restringe quali oggetti leggere dentro il Base DN. Se è troppo largo, leggerai più record del necessario.', en: 'RFC4515 filter that restricts which objects are read inside the Base DN. If it is too broad, you will read more records than necessary.' })],
                      [t({ it: 'Campi Email / Nome / Cognome / External ID / Ruolo / Mobile / Dipartimento', en: 'Email / First name / Last name / External ID / Role / Mobile / Department fields' }), t({ it: 'Qui scrivi i nomi degli attributi LDAP da leggere, non i valori utente. Esempio: mail, givenName, sn, sAMAccountName, title, mobile, department.', en: 'Here you write the names of the LDAP attributes to read, not the user values. Example: mail, givenName, sn, sAMAccountName, title, mobile, department.' })],
                      [t({ it: 'Max utenti', en: 'Max users' }), t({ it: 'Limite massimo di record letti da LDAP in confronto e import. Il test connessione legge comunque solo un campione fino a 25 utenti.', en: 'Maximum number of records read from LDAP during compare and import. Connection test still reads only a sample up to 25 users.' })],
                      [t({ it: 'Sicurezza operativa', en: 'Operational security' }), t({ it: 'L’integrazione LDAP è solo in lettura. Il backend usa solo bind, search e unbind. Non esistono scritture verso LDAP.', en: 'The LDAP integration is read-only. The backend only uses bind, search, and unbind. There are no writes sent to LDAP.' })]
                    ].map(([title, body]) => (
                      <div key={String(title)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="font-semibold text-ink">{title}</div>
                        <div className="mt-1 text-slate-600">{body}</div>
                      </div>
                    ))}
                  </div>
                  <div className="modal-footer">
                    <button type="button" onClick={() => setLdapInfoOpen(false)} className="btn-primary">
                      {t({ it: 'Chiudi guida', en: 'Close guide' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      </>
  );
};
