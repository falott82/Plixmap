/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Eye, EyeOff, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';

// Imported-users management modal (search/filter, allocation, hide, portal
// provisioning, manual users). Extracted verbatim from CustomImportPanel.
export const CustomImportUsersModal = (props: any) => {
  const {
    usersOpen,
    activeClient,
    activeClientId,
    assignedCounts,
    duplicateUserKeys,
    includeMissing,
    loadUsers,
    manualUserDeletingId,
    onlyMissing,
    openManualUserCreate,
    openManualUserEdit,
    openPortalProvisionModal,
    portalUserByImportedKey,
    portalUsersLoading,
    sortedUsers,
    usersChildDialogOpen,
    usersDialogFocusRef,
    usersLoading,
    usersQuery,
    usersSortState,
    setExternalUserHidden,
    setIncludeMissing,
    setManualDeleteCandidate,
    setOnlyMissing,
    setUsersOpen,
    setUsersQuery,
    setUsersSortState,
    push,
    t,
  } = props;
  return (
      <Transition show={usersOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[125]"
          onClose={() => {
            if (usersChildDialogOpen) return;
            setUsersOpen(false);
          }}
          initialFocus={usersDialogFocusRef}
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
                <Dialog.Panel className="w-full max-w-7xl modal-panel">
                  <button ref={usersDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Utenti importati', en: 'Imported users' })}</Dialog.Title>
                      <div className="modal-description">{activeClient ? activeClient.name : ''}</div>
                    </div>
                    <button onClick={() => setUsersOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={usersQuery}
                        onChange={(e) => setUsersQuery(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-primary"
                        placeholder={t({ it: 'Cerca per nome, reparto, email, cellulare…', en: 'Search by name, dept, email, mobile…' })}
                        autoFocus
                      />
                    </div>
                    <label
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      title={t({
                        it: 'Mostra anche gli utenti che risultano mancanti nell’ultima importazione (non più presenti nella sorgente).',
                        en: 'Also show users marked as missing in the latest import (no longer present in the source).'
                      })}
                    >
                      <input type="checkbox" checked={includeMissing} onChange={(e) => setIncludeMissing(e.target.checked)} />
                      {t({ it: 'Includi mancanti', en: 'Include missing' })}
                    </label>
                    <label
                      className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
                      title={t({
                        it: 'Mostra solo gli utenti mancanti per decidere se includerli o escluderli dal contenitore utenti.',
                        en: 'Show only missing users so you can include or exclude them from the user container.'
                      })}
                    >
                      <input
                        type="checkbox"
                        checked={onlyMissing}
                        onChange={(e) => {
                          setOnlyMissing(e.target.checked);
                          if (e.target.checked) setIncludeMissing(true);
                        }}
                      />
                      {t({ it: 'Solo mancanti', en: 'Only missing' })}
                    </label>
                    <button
                      type="button"
                      onClick={openManualUserCreate}
                      disabled={!activeClientId}
                      className="flex h-10 items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                      title={t({ it: 'Aggiungi utente manuale', en: 'Add manual user' })}
                    >
                      <Plus size={16} />
                      {t({ it: 'Nuovo manuale', en: 'New manual' })}
                    </button>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="max-h-[55vh] overflow-auto">
                      {usersLoading ? <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Caricamento…', en: 'Loading…' })}</div> : null}
                      {!usersLoading && !sortedUsers.length ? (
                        <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun utente trovato.', en: 'No users found.' })}</div>
                      ) : null}
                      {!usersLoading && sortedUsers.length ? (
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3 text-left" title={t({ it: 'Nome completo utente (badge: manuale, mancante, nascosto, duplicato).', en: 'User full name (badges: manual, missing, hidden, duplicate).' })}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUsersSortState((prev: any) => ({
                                      key: 'name',
                                      dir: prev.key === 'name' && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink"
                                >
                                  {t({ it: 'Nome', en: 'Name' })}
                                  {usersSortState.key === 'name' ? <span>{usersSortState.dir === 'asc' ? '▲' : '▼'}</span> : null}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left" title={t({ it: 'Email e/o cellulare associati all’utente importato.', en: 'Email and/or mobile associated with the imported user.' })}>
                                {t({ it: 'Email / Cellulare', en: 'Email / Mobile' })}
                              </th>
                              <th className="px-3 py-3 text-left" title={t({ it: 'ID esterno della sorgente importazione (WebAPI/CSV/Manuale).', en: 'External ID from the import source (WebAPI/CSV/Manual).' })}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUsersSortState((prev: any) => ({
                                      key: 'id',
                                      dir: prev.key === 'id' && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink"
                                >
                                  {t({ it: 'ID', en: 'ID' })}
                                  {usersSortState.key === 'id' ? <span>{usersSortState.dir === 'asc' ? '▲' : '▼'}</span> : null}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left" title={t({ it: 'Ruolo e reparti importati per l’utente.', en: 'Imported role and departments for the user.' })}>
                                {t({ it: 'Ruolo / Reparto', en: 'Role / Dept' })}
                              </th>
                              <th className="px-3 py-3 text-center" title={t({ it: 'Numero di assegnazioni in planimetria (utenti reali collegati a postazioni/stanze). Clicca per ordinare.', en: 'Number of floor-plan allocations (real users linked to seats/rooms). Click to sort.' })}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUsersSortState((prev: any) => ({
                                      key: 'alloc',
                                      dir: prev.key === 'alloc' && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink"
                                >
                                  {t({ it: 'Alloc.', en: 'Alloc.' })}
                                  {usersSortState.key === 'alloc' ? <span>{usersSortState.dir === 'asc' ? '▲' : '▼'}</span> : null}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUsersSortState((prev: any) => ({
                                      key: 'hidden',
                                      dir: prev.key === 'hidden' && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink"
                                  title={t({ it: 'Ordina per visibilità (occhio barrato = nascosto)', en: 'Sort by visibility (slashed eye = hidden)' })}
                                >
                                  {t({ it: 'Vis.', en: 'Vis.' })}
                                  {usersSortState.key === 'hidden' ? <span>{usersSortState.dir === 'asc' ? '▲' : '▼'}</span> : null}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-center" title={t({ it: 'Stato dell’utente del portale collegato all’utente importato.', en: 'Status of the portal user linked to the imported user.' })}>
                                {t({ it: 'Portale', en: 'Portal' })}
                              </th>
                              <th className="px-4 py-3 text-right" title={t({ it: 'Azioni disponibili sul record locale: modifica per tutti gli utenti, eliminazione solo per i manuali, creazione utente portale e gestione visibilità nel contenitore.', en: 'Actions available on the local record: edit for all users, deletion only for manual ones, portal-user creation, and visibility control in the container.' })}>
                                {t({ it: 'Azioni', en: 'Actions' })}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedUsers.map((r: any) => {
                              const count = assignedCounts.get(`${r.clientId}:${r.externalId}`) || 0;
                              const displayName = `${String(r.firstName || '').trim()} ${String(r.lastName || '').trim()}`.trim() || r.email || r.externalId;
                              const contact = [r.email, r.mobile].filter(Boolean).join(' · ') || '—';
                              const deptLabel = [r.dept1, r.dept2, r.dept3].filter(Boolean).join(' / ');
                              const linkedPortalUser = portalUserByImportedKey.get(`${r.clientId}:${r.externalId}`) || null;
                              return (
                                <tr key={r.externalId} className="border-t border-slate-200 align-top">
                                  <td className="px-4 py-3">
                                    <div className="min-w-[260px]">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-ink">{displayName}</span>
                                        {(r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:')) ? (
                                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                            {t({ it: 'Manuale', en: 'Manual' })}
                                          </span>
                                        ) : null}
                                        {!r.present ? (
                                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                            {t({ it: 'Mancante', en: 'Missing' })}
                                          </span>
                                        ) : null}
                                        {r.hidden ? (
                                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                            {t({ it: 'Nascosto', en: 'Hidden' })}
                                          </span>
                                        ) : null}
                                        {duplicateUserKeys.has(`${r.clientId}:${r.externalId}`) ? (
                                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                            {t({ it: 'Duplicato', en: 'Duplicate' })}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-xs text-slate-600">{contact}</td>
                                  <td className="px-3 py-3 font-mono text-xs text-slate-700">{r.externalId}</td>
                                  <td className="px-3 py-3">
                                    <div className="text-xs text-slate-700">{r.role || '—'}</div>
                                    <div className="text-[11px] text-slate-500">{deptLabel || '—'}</div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span
                                      className={`inline-flex min-w-[56px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                        count > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}
                                      title={t({
                                        it:
                                          count > 0
                                            ? `${count} assegnazioni in planimetria`
                                            : 'Nessuna assegnazione in planimetria',
                                        en:
                                          count > 0
                                            ? `${count} floor-plan allocations`
                                            : 'No floor-plan allocations'
                                      })}
                                    >
                                      {count > 0
                                        ? t({ it: `${count} assegn.`, en: `${count} alloc.` })
                                        : t({ it: 'Nessuna', en: 'None' })}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center text-slate-500" title={r.hidden ? t({ it: 'Nascosto', en: 'Hidden' }) : t({ it: 'Visibile', en: 'Visible' })}>
                                    {r.hidden ? <EyeOff size={15} className="mx-auto" /> : <Eye size={15} className="mx-auto" />}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {linkedPortalUser ? (
                                      <div className="inline-flex flex-col items-center gap-1">
                                        <span
                                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                            linkedPortalUser.mustChangePassword
                                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          }`}
                                          title={
                                            linkedPortalUser.mustChangePassword
                                              ? t({ it: 'Creato ma non ancora attivato al primo login', en: 'Created but not activated yet on first login' })
                                              : t({ it: 'Utente portale gia attivo', en: 'Portal user already active' })
                                          }
                                        >
                                          {linkedPortalUser.mustChangePassword
                                            ? t({ it: 'Da attivare', en: 'Pending' })
                                            : t({ it: 'Attivo', en: 'Active' })}
                                        </span>
                                        <span className="max-w-[150px] truncate text-[11px] text-slate-500" title={linkedPortalUser.username}>
                                          {linkedPortalUser.username}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                        {portalUsersLoading ? t({ it: 'Verifica…', en: 'Checking…' }) : t({ it: 'Assente', en: 'Missing' })}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => openManualUserEdit(r)}
                                        className="btn-inline"
                                        title={
                                          (r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:'))
                                            ? t({ it: 'Modifica questo utente manuale nel contenitore locale. Puoi cambiare dati anagrafici, contatti, ruolo e reparti.', en: 'Edit this manual user in the local container. You can change profile data, contacts, role, and departments.' })
                                            : t({ it: 'Modifica questo utente importato nel contenitore locale. Attenzione: un futuro reimport dalla sorgente può sovrascrivere questi dati.', en: 'Edit this imported user in the local container. Warning: a future reimport from the source may overwrite these values.' })
                                        }
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      {(r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:')) ? (
                                        <button
                                          type="button"
                                          onClick={() => setManualDeleteCandidate(r)}
                                          disabled={manualUserDeletingId === r.externalId}
                                          className="btn-inline text-rose-700 hover:bg-rose-50"
                                          title={t({ it: 'Elimina definitivamente questo utente manuale dal contenitore locale. Questa azione non è disponibile per gli utenti importati.', en: 'Permanently delete this manual user from the local container. This action is not available for imported users.' })}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => openPortalProvisionModal(r)}
                                        disabled={!!linkedPortalUser || portalUsersLoading}
                                        className={`btn-inline ${linkedPortalUser ? 'cursor-not-allowed opacity-50' : 'text-primary hover:bg-primary/10'}`}
                                        title={
                                          linkedPortalUser
                                            ? t({ it: `Questo utente importato è già collegato all’utente portale ${linkedPortalUser.username}. Non serve crearne un altro.`, en: `This imported user is already linked to portal user ${linkedPortalUser.username}. There is no need to create another one.` })
                                            : t({ it: 'Crea un utente portale collegato a questo record importato, così la persona può accedere al portale.', en: 'Create a portal user linked to this imported record so the person can access the portal.' })
                                        }
                                      >
                                        <UserPlus size={13} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!activeClientId) return;
                                          try {
                                            await setExternalUserHidden({ clientId: activeClientId, externalId: r.externalId, hidden: !r.hidden });
                                            await loadUsers(activeClientId);
                                            push(t({ it: 'Aggiornato', en: 'Updated' }), 'success');
                                          } catch {
                                            push(t({ it: 'Errore', en: 'Error' }), 'danger');
                                          }
                                        }}
                                        className="btn-inline"
                                        title={
                                          !r.present
                                            ? r.hidden
                                              ? t({ it: 'Il record è mancante dalla sorgente e nascosto. Clicca per reincluderlo visivamente nel contenitore locale.', en: 'The record is missing from the source and hidden. Click to include it again visually in the local container.' })
                                              : t({ it: 'Il record è mancante dalla sorgente ma ancora visibile. Clicca per escluderlo dalla vista del contenitore locale.', en: 'The record is missing from the source but still visible. Click to exclude it from the local container view.' })
                                            : r.hidden
                                              ? t({ it: 'Mostra di nuovo questo utente nel contenitore locale senza cancellarlo.', en: 'Show this user again in the local container without deleting it.' })
                                              : t({ it: 'Nascondi questo utente nel contenitore locale senza cancellarlo.', en: 'Hide this user in the local container without deleting it.' })
                                        }
                                      >
                                        {r.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : null}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      onClick={() => setUsersOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Chiudi la lista utenti importati', en: 'Close imported users list' })}
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                    <div />
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
