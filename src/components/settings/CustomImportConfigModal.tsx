/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FileDown, Info, Plus, Save, Search, Settings2, TestTube, Trash2, UploadCloud, Users, X } from 'lucide-react';

// Import configuration modal (mode selector + WebAPI/LDAP/CSV/manual config
// forms, test/preview/import actions). Extracted from CustomImportPanel.
export const CustomImportConfigModal = (props: any) => {
  const {
    configOpen,
    lockClientSelection,
    formatDate,
    activeClient,
    activeClientId,
    activeSummary,
    canClearWebApiImport,
    canRunWebApiTest,
    canSaveWebApiSettings,
    cfg,
    clearing,
    configChildDialogOpen,
    configDialogFocusRef,
    configExpanded,
    csvFile,
    csvImporting,
    downloadCsvTemplate,
    handleCsvFile,
    importMode,
    ldapCfg,
    ldapConfigTab,
    ldapImporting,
    ldapImportResult,
    ldapPassword,
    ldapPreviewLoading,
    ldapPreviewResult,
    ldapTesting,
    ldapTestResult,
    manualRowsCount,
    openLdapCompareModal,
    openLdapImportSelection,
    openManualUserCreate,
    openUsers,
    password,
    runLdapTest,
    runTest,
    saveConfig,
    saveLdapConfigHandler,
    savingCfg,
    savingLdapCfg,
    syncResult,
    testResult,
    testing,
    usersOpen,
    setCfg,
    setClearConfirmOpen,
    setConfigExpanded,
    setConfigOpen,
    setImportMode,
    setIncludeMissing,
    setLdapCfg,
    setLdapConfigTab,
    setLdapInfoOpen,
    setLdapPassword,
    setOnlyMissing,
    setPassword,
    t,
  } = props;
  return (
      <Transition show={configOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[120]"
          onClose={() => {
            if (configChildDialogOpen) return;
            setConfigOpen(false);
          }}
          initialFocus={configDialogFocusRef}
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
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <button ref={configDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">
                        {t({ it: 'Configurazione import utenti', en: 'User import configuration' })}
                      </Dialog.Title>
                      <div className="modal-description">
                        {activeClient ? activeClient.name : t({ it: 'Nessun cliente selezionato', en: 'No client selected' })}
                      </div>
                    </div>
                    <button onClick={() => setConfigOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  {!lockClientSelection ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Stato importazione', en: 'Import status' })}</div>
                      <div className="text-xs text-slate-500">
                        {activeSummary
                          ? t({ it: `Ultima importazione: ${formatDate(activeSummary.lastImportAt)}`, en: `Last import: ${formatDate(activeSummary.lastImportAt)}` })
                          : t({ it: 'Nessuna importazione', en: 'No imports yet' })}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Utenti importati', en: 'Imported users' })}</div>
                        <div className="text-base font-semibold text-ink">{activeSummary?.total ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Attivi', en: 'Active' })}</div>
                        <div className="text-base font-semibold text-ink">{activeSummary?.presentCount ?? 0}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeClientId || !(activeSummary?.missingCount || 0)) return;
                          setConfigOpen(false);
                          await openUsers(activeClientId);
                          setIncludeMissing(true);
                          setOnlyMissing(true);
                        }}
                        disabled={!(activeSummary?.missingCount || 0)}
                        className={`rounded-xl border px-3 py-2 text-left ${
                          (activeSummary?.missingCount || 0)
                            ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                            : 'border-slate-200 bg-white'
                        } disabled:cursor-default`}
                        title={
                          (activeSummary?.missingCount || 0)
                            ? t({ it: 'Apri elenco utenti mancanti per decidere se includerli o escluderli', en: 'Open missing users list to include/exclude them' })
                            : undefined
                        }
                      >
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Mancanti', en: 'Missing' })}</div>
                        <div className="text-base font-semibold text-ink">{activeSummary?.missingCount ?? 0}</div>
                      </button>
                    </div>
                  </div>
                  ) : null}

                  {!lockClientSelection ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-ink">{t({ it: 'Sorgente importazione', en: 'Import source' })}</div>
                    <button
                      onClick={() => setImportMode('webapi')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        importMode === 'webapi' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={t({ it: 'Usa importazione da WebAPI', en: 'Use WebAPI import' })}
                    >
                      WebAPI
                    </button>
                    <button
                      onClick={() => setImportMode('ldap')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        importMode === 'ldap' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={t({ it: 'Usa importazione da LDAP', en: 'Use LDAP import' })}
                    >
                      LDAP
                    </button>
                    <button
                      onClick={() => setImportMode('csv')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        importMode === 'csv' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={t({ it: 'Usa importazione da CSV', en: 'Use CSV import' })}
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => setImportMode('manual')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        importMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={t({ it: 'Gestione manuale utenti reali', en: 'Manual real users management' })}
                    >
                      {t({ it: 'Manuale', en: 'Manual' })}
                    </button>
                    </div>
                  ) : null}

                  {importMode === 'webapi' ? (
                    configExpanded ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <label className="block text-sm font-medium text-slate-700 md:col-span-3">
                          {t({ it: 'WebAPI URL', en: 'WebAPI URL' })}
                          <input
                            value={cfg?.url || ''}
                            onChange={(e) =>
                              setCfg((prev: any) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), url: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="https://api.example.com/users"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Username', en: 'Username' })}
                          <input
                            value={cfg?.username || ''}
                            onChange={(e) =>
                              setCfg((prev: any) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), username: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="api-user"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Password', en: 'Password' })}
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder={cfg?.hasPassword ? t({ it: 'Lascia vuoto per non cambiare', en: 'Leave empty to keep' }) : '••••••'}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Metodo', en: 'Method' })}
                          <select
                            value={cfg?.method || 'POST'}
                            onChange={(e) =>
                              setCfg((prev: any) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), method: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700 md:col-span-3">
                          {t({ it: 'Body JSON (opzionale)', en: 'Body JSON (optional)' })}
                          <textarea
                            value={cfg?.bodyJson || ''}
                            onChange={(e) =>
                              setCfg((prev: any) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), bodyJson: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            rows={3}
                            placeholder='{"User":"...","Password":"..."}'
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            {t({
                              it: 'Apri le impostazioni WebAPI con l’icona ingranaggio per configurare URL e credenziali.',
                              en: 'Open the WebAPI settings via the gear icon to configure URL and credentials.'
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setConfigExpanded(true)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            title={t({ it: 'Apri impostazioni WebAPI', en: 'Open WebAPI settings' })}
                          >
                            <Settings2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  ) : importMode === 'ldap' ? (
                    <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {t({ it: 'Configurazione LDAP', en: 'LDAP configuration' })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {t({ it: 'Configurazione generica per LDAP, OpenLDAP e Active Directory.', en: 'Generic configuration for LDAP, OpenLDAP and Active Directory.' })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLdapInfoOpen(true)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                          title={t({ it: 'Apri guida completa LDAP', en: 'Open full LDAP guide' })}
                          aria-label={t({ it: 'Guida configurazione LDAP', en: 'LDAP configuration guide' })}
                        >
                          <Info size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLdapConfigTab('settings')}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${ldapConfigTab === 'settings' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          Settings
                        </button>
                        <button
                          type="button"
                          onClick={() => setLdapConfigTab('filters')}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${ldapConfigTab === 'filters' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          Filters
                        </button>
                      </div>
                      {ldapConfigTab === 'settings' ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Server LDAP', en: 'LDAP server' })}
                          <input
                            value={ldapCfg?.server || ''}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), server: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="ldap.example.com"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Porta', en: 'Port' })}
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={String(ldapCfg?.port || '')}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), port: Number(e.target.value || 0) }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="636"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Sicurezza trasporto', en: 'Transport security' })}
                          <select
                            value={ldapCfg?.security || 'ldaps'}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), security: e.target.value as 'ldaps' | 'starttls' | 'ldap', port: e.target.value === 'ldaps' ? 636 : prev?.port || 389 }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="ldaps">LDAPS</option>
                            <option value="starttls">LDAP + StartTLS</option>
                            <option value="ldap">LDAP</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Scope ricerca', en: 'Search scope' })}
                          <select
                            value={ldapCfg?.scope || 'sub'}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), scope: e.target.value as 'sub' | 'one' }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="sub">{t({ it: 'OU corrente + sotto-OU', en: 'Current OU + child OUs' })}</option>
                            <option value="one">{t({ it: 'Solo OU corrente', en: 'Current OU only' })}</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Autenticazione', en: 'Authentication' })}
                          <select
                            value={ldapCfg?.authType || 'simple'}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), authType: e.target.value as 'anonymous' | 'simple' | 'domain_user' | 'user_principal_name' }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="simple">{t({ it: 'Simple bind', en: 'Simple bind' })}</option>
                            <option value="domain_user">{t({ it: 'Dominio\\utente', en: 'Domain\\user' })}</option>
                            <option value="user_principal_name">{t({ it: 'utente@dominio', en: 'user@domain' })}</option>
                            <option value="anonymous">{t({ it: 'Anonima', en: 'Anonymous' })}</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Dominio', en: 'Domain' })}
                          <input
                            value={ldapCfg?.domain || ''}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), domain: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="example.com"
                            disabled={ldapCfg?.authType === 'anonymous' || ldapCfg?.authType === 'simple'}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Utente', en: 'User' })}
                          <input
                            value={ldapCfg?.username || ''}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), username: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="ldap-reader"
                            disabled={ldapCfg?.authType === 'anonymous'}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Password', en: 'Password' })}
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={ldapPassword}
                            onChange={(e) => setLdapPassword(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder={ldapCfg?.hasPassword ? t({ it: 'Lascia vuoto per non cambiare', en: 'Leave empty to keep' }) : '••••••'}
                            disabled={ldapCfg?.authType === 'anonymous'}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                          {t({ it: 'Base DN', en: 'Base DN' })}
                          <input
                            value={ldapCfg?.baseDn || ''}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), baseDn: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="DC=example,DC=com"
                          />
                        </label>
                      </div>
                      ) : null}
                      {ldapConfigTab === 'filters' ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                        <div className="mb-4">
                          <div className="text-sm font-semibold text-sky-900">
                            {t({ it: 'Filtro, mapping attributi e limiti', en: 'Filter, attribute mapping, and limits' })}
                          </div>
                          <div className="mt-1 text-xs leading-6 text-sky-800">
                            {t({
                              it: 'Qui decidi quali utenti LDAP leggere e come copiare i dati nei campi locali. Il filtro sceglie i record da leggere. I campi sotto dicono quale attributo LDAP usare per email, nome, cognome, identificativo, ruolo, telefono e reparto. Se un attributo è vuoto o sbagliato, quel dato arriverà mancante.',
                              en: 'Here you decide which LDAP users to read and how to copy the data into local fields. The filter chooses which records are read. The fields below tell the system which LDAP attribute to use for email, first name, last name, identifier, role, phone, and department. If an attribute is empty or wrong, that value will be missing.'
                            })}
                          </div>
                        </div>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Filtro utenti LDAP', en: 'LDAP user filter' })}
                          <input
                            value={ldapCfg?.userFilter || ''}
                            onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), userFilter: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="(&(objectClass=user)(mail=*))"
                            title={t({ it: 'Filtro LDAP RFC4515. Serve a limitare la lettura solo agli oggetti che ti interessano dentro il Base DN scelto.', en: 'RFC4515 LDAP filter. It limits the read to only the objects you need inside the selected Base DN.' })}
                          />
                          <div className="mt-1 text-[11px] text-sky-800">
                            {t({
                              it: 'Questo filtro si applica sopra il Base DN. Se è troppo largo, leggerai più utenti del necessario.',
                              en: 'This filter is applied on top of the Base DN. If it is too broad, you will read more users than needed.'
                            })}
                          </div>
                        </label>
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <label className="block text-sm font-medium text-slate-700">
                          Email
                          <input value={ldapCfg?.emailAttribute || ''} onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), emailAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP che contiene l’email. Se manca, l’utente non può essere confrontato correttamente per evitare duplicati.', en: 'LDAP attribute that contains the email. If it is missing, the user cannot be compared correctly to avoid duplicates.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Nome', en: 'First name' })}
                          <input value={ldapCfg?.firstNameAttribute || ''} onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), firstNameAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP del nome. Esempio comune: givenName.', en: 'LDAP attribute for the first name. Common example: givenName.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Cognome', en: 'Last name' })}
                          <input value={ldapCfg?.lastNameAttribute || ''} onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), lastNameAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP del cognome. Esempio comune: sn.', en: 'LDAP attribute for the last name. Common example: sn.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          External ID
                          <input value={ldapCfg?.externalIdAttribute || ''} onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), externalIdAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Identificativo stabile del record LDAP. Serve a riconoscere la stessa persona tra import successivi.', en: 'Stable identifier of the LDAP record. It is used to recognize the same person across future imports.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Ruolo', en: 'Role' })}
                          <input value={ldapCfg?.roleAttribute || ''} onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), roleAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP da usare come ruolo o job title. Se il tuo LDAP non lo ha, puoi lasciarlo vuoto.', en: 'LDAP attribute used as role or job title. If your LDAP does not have it, you can leave it empty.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Mobile', en: 'Mobile' })}
                          <input value={ldapCfg?.mobileAttribute || ''} onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), mobileAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP del numero di telefono o cellulare. Gli spazi vengono rimossi in salvataggio.', en: 'LDAP attribute for the phone or mobile number. Spaces are removed when saving.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Dipartimento', en: 'Department' })}
                          <input value={ldapCfg?.dept1Attribute || ''} onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), dept1Attribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP del reparto principale. Viene copiato nel campo locale reparto 1.', en: 'LDAP attribute for the main department. It is copied into the local department 1 field.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Max utenti', en: 'Max users' })}
                          <input type="number" min={1} max={5000} value={String(ldapCfg?.sizeLimit || 1000)} onChange={(e) => setLdapCfg((prev: any) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), sizeLimit: Number(e.target.value || 1000) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Limite massimo di utenti letti da LDAP nel confronto e nell’import. Il test connessione legge comunque solo un campione fino a 25 utenti.', en: 'Maximum number of users read from LDAP during compare and import. Connection test still reads only a sample up to 25 users.' })} />
                        </label>
                        </div>
                        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          {t({
                            it: 'LDAP è sempre in sola lettura: il backend usa solo bind, search e unbind. Nessuna operazione di scrittura, modifica o cancellazione viene mai inviata verso il server LDAP.',
                            en: 'LDAP is always read-only: the backend uses only bind, search, and unbind. No write, update, or delete operation is ever sent to the LDAP server.'
                          })}
                        </div>
                      </div>
                      ) : null}
                    </div>
                  ) : importMode === 'csv' ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Import CSV', en: 'CSV import' })}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t({ it: 'Carica un CSV per questo cliente. Puoi sommare o sostituire gli utenti esistenti.', en: 'Upload a CSV for this client. You can append or replace existing users.' })}
                          </div>
                        </div>
                        <button
                          onClick={downloadCsvTemplate}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                          title={t({ it: 'Scarica modello CSV', en: 'Download CSV template' })}
                        >
                          <FileDown size={16} className="text-slate-500" />
                          {t({ it: 'Modello CSV', en: 'CSV template' })}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                          <UploadCloud size={16} />
                          {t({ it: 'Carica CSV', en: 'Upload CSV' })}
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => handleCsvFile(e.target.files?.[0] || null)}
                          />
                        </label>
                        {csvFile ? <span className="text-xs text-slate-500">{csvFile.name}</span> : null}
                        {csvImporting ? <span className="text-xs text-slate-500">{t({ it: 'Import in corso…', en: 'Importing…' })}</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Inserimento manuale utenti reali', en: 'Manual real users entry' })}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t({
                              it: 'Aggiungi, modifica o rimuovi utenti senza WebAPI/CSV. Gli utenti manuali restano separati e non vengono marcati mancanti durante la sincronizzazione WebAPI.',
                              en: 'Add, edit or delete users without WebAPI/CSV. Manual users stay separate and are not marked missing during WebAPI sync.'
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                            {t({ it: 'Utenti manuali', en: 'Manual users' })}: {manualRowsCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!activeClientId) return;
                              if (!usersOpen) {
                                openUsers(activeClientId);
                              }
                              openManualUserCreate();
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                          >
                            <Plus size={15} />
                            {t({ it: 'Nuovo utente manuale', en: 'New manual user' })}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {importMode === 'webapi' ? (
                      <>
                        <button
                          onClick={saveConfig}
                          disabled={savingCfg || !activeClientId || !canSaveWebApiSettings}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                          title={
                            !canSaveWebApiSettings
                              ? t({
                                  it: 'Puoi aggiornare le impostazioni solo dopo la prima importazione.',
                                  en: 'You can update settings only after the first import.'
                                })
                              : t({ it: 'Salva / aggiorna impostazioni WebAPI', en: 'Save / update WebAPI settings' })
                          }
                        >
                          <Save size={16} className={savingCfg ? 'animate-pulse' : ''} />
                        </button>
                        <button
                          onClick={runTest}
                          disabled={testing || !activeClientId || !canRunWebApiTest}
                          className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                          title={
                            !canRunWebApiTest
                              ? t({ it: 'Configura prima le impostazioni WebAPI.', en: 'Configure WebAPI settings first.' })
                              : t({ it: 'Verifica connessione WebAPI', en: 'Test WebAPI connection' })
                          }
                        >
                          <TestTube size={16} /> {testing ? t({ it: 'Test…', en: 'Testing…' }) : t({ it: 'Test', en: 'Test' })}
                        </button>
                      </>
                    ) : null}
                    {importMode !== 'webapi' && !lockClientSelection && (activeSummary?.total || syncResult?.ok || importMode === 'manual') ? (
                      <button
                        onClick={() => activeClientId && openUsers(activeClientId)}
                        className="flex items-center gap-2 btn-secondary"
                        title={t({ it: 'Apri utenti importati', en: 'Open imported users' })}
                      >
                        <Users size={16} /> {t({ it: 'Utenti importati', en: 'Imported users' })}
                      </button>
                    ) : null}
                    {importMode !== 'webapi' && importMode !== 'ldap' ? (
                      <button
                        onClick={() => setClearConfirmOpen(true)}
                        disabled={!activeClientId || clearing || !canClearWebApiImport}
                        className="ml-auto flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        title={
                          !canClearWebApiImport
                            ? t({
                                it: 'Disponibile solo dopo almeno una importazione.',
                                en: 'Available only after at least one import.'
                              })
                            : t({ it: 'Elimina dati importati', en: 'Delete imported data' })
                        }
                      >
                        <Trash2 size={16} /> {clearing ? t({ it: 'Eliminazione…', en: 'Deleting…' }) : t({ it: 'Elimina', en: 'Delete' })}
                      </button>
                    ) : null}
                  </div>
                  {importMode === 'ldap' ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={saveLdapConfigHandler}
                          disabled={savingLdapCfg || !activeClientId || !ldapCfg}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                          title={t({ it: 'Salva / aggiorna impostazioni LDAP', en: 'Save / update LDAP settings' })}
                        >
                          <Save size={16} className={savingLdapCfg ? 'animate-pulse' : ''} />
                        </button>
                        <button
                          onClick={runLdapTest}
                          disabled={ldapTesting || !activeClientId || !ldapCfg}
                          className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                          title={t({
                            it: 'Verifica connessione e lettura LDAP con un campione limitato ai primi 25 utenti. Il test non importa nulla.',
                            en: 'Check LDAP connectivity and read access with a sample limited to the first 25 users. The test does not import anything.'
                          })}
                        >
                          <TestTube size={16} /> {ldapTesting ? t({ it: 'Test…', en: 'Testing…' }) : t({ it: 'Test connessione', en: 'Test connection' })}
                        </button>
                        <button
                          onClick={openLdapCompareModal}
                          disabled={ldapPreviewLoading || !activeClientId || !ldapCfg}
                          className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                          title={t({
                            it: 'Apri un confronto dedicato tra utenti LDAP e utenti gia presenti nel contenitore locale.',
                            en: 'Open a dedicated comparison between LDAP users and users already present in the local container.'
                          })}
                        >
                          <Search size={16} /> {ldapPreviewLoading ? t({ it: 'Confronto…', en: 'Comparing…' }) : t({ it: 'Confronta', en: 'Compare' })}
                        </button>
                        <button
                          onClick={openLdapImportSelection}
                          disabled={ldapImporting || !activeClientId || !ldapPreviewResult?.importableCount}
                          className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                        >
                          <UploadCloud size={16} /> {ldapImporting ? t({ it: 'Import…', en: 'Importing…' }) : t({ it: 'Importa', en: 'Import' })}
                        </button>
                      </div>
                      {ldapTestResult ? (
                        <div className={`rounded-xl border px-3 py-2 text-sm ${ldapTestResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                          {ldapTestResult.ok
                            ? t({
                                it: `Connessione LDAP ok. Campione letto nel test: ${ldapTestResult.count ?? 0} utenti su massimo 25.`,
                                en: `LDAP connection ok. Sample read in test: ${ldapTestResult.count ?? 0} users out of max 25.`
                              })
                            : ldapTestResult.error || t({ it: 'Test LDAP fallito', en: 'LDAP test failed' })}
                        </div>
                      ) : null}
                      {ldapImportResult ? (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                          {t({
                            it: `Ultimo import LDAP: letti ${ldapImportResult.fetched}, selezionati ${ldapImportResult.selected || 0}, creati ${ldapImportResult.created}, gia presenti ${ldapImportResult.existing}, saltati ${ldapImportResult.skipped}.`,
                            en: `Last LDAP import: fetched ${ldapImportResult.fetched}, selected ${ldapImportResult.selected || 0}, created ${ldapImportResult.created}, already present ${ldapImportResult.existing}, skipped ${ldapImportResult.skipped}.`
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {testResult ? (
                    testResult.ok ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {t({ it: `Test OK: ${testResult.count ?? 0} utenti trovati.`, en: `Test OK: ${testResult.count ?? 0} users found.` })}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        <div className="font-semibold">
                          {t({ it: `Test fallito (HTTP ${testResult.status || 0}).`, en: `Test failed (HTTP ${testResult.status || 0}).` })}
                        </div>
                        {testResult.error ? <div className="mt-1 text-xs">{testResult.error}</div> : null}
                        {testResult.contentType ? <div className="mt-1 text-xs">Content-Type: {testResult.contentType}</div> : null}
                        {testResult.rawSnippet ? (
                          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-[11px] text-slate-700">
                            {String(testResult.rawSnippet).slice(0, 500)}
                          </pre>
                        ) : null}
                      </div>
                    )
                  ) : null}
                  {syncResult && syncResult.ok ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {t({ it: 'Importazione completata con successo.', en: 'Import completed successfully.' })}
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
