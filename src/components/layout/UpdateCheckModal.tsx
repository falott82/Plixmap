import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { shallow } from 'zustand/shallow';
import { useT } from '../../i18n/useT';
import { fetchUpdateStatus, type UpdateStatusResponse } from '../../api/update';
import { releaseHistory } from '../../version/history';
import { useAuthStore } from '../../store/useAuthStore';

const UPDATE_CHECK_CACHE_KEY = 'plixmap_update_check_cache_v1';
const UPDATE_CHECK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const UpdateCheckModal = () => {
  const { updateCheckOpen, closeUpdateCheck } = useUIStore(
    (s) => ({ updateCheckOpen: s.updateCheckOpen, closeUpdateCheck: s.closeUpdateCheck }),
    shallow
  );
  const { user } = useAuthStore();
  const t = useT();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusResponse | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const localVersion = releaseHistory[0]?.version || '0.0.0';
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';

  const currentVersion = updateStatus?.currentVersion || localVersion;
  const latestVersion = updateStatus?.latestVersion;
  const updateState: 'unknown' | 'error' | 'mandatory' | 'available' | 'upToDate' = (() => {
    if (!updateStatus) return 'unknown';
    if (!updateStatus.ok) return 'error';
    if (updateStatus.unsupported || updateStatus.mandatory) return 'mandatory';
    if (updateStatus.updateAvailable) return 'available';
    return 'upToDate';
  })();
  const canDownload = !!updateStatus?.downloadUrl && (updateState === 'available' || updateState === 'mandatory');

  const runUpdateCheck = async (opts?: { force?: boolean }) => {
    if (!isSuperAdmin) return;
    if (!opts?.force) {
      try {
        const raw = localStorage.getItem(UPDATE_CHECK_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const checkedAt = Number(parsed?.checkedAt || 0);
          if (checkedAt && Date.now() - checkedAt <= UPDATE_CHECK_CACHE_TTL_MS && parsed?.result) {
            setUpdateStatus(parsed.result as UpdateStatusResponse);
            return;
          }
        }
      } catch {
        // ignore cache parse errors
      }
    }
    setUpdateChecking(true);
    try {
      const next = await fetchUpdateStatus();
      setUpdateStatus(next);
      try {
        localStorage.setItem(UPDATE_CHECK_CACHE_KEY, JSON.stringify({ checkedAt: Date.now(), result: next }));
      } catch {
        // ignore cache write errors
      }
    } catch {
      setUpdateStatus({
        ok: false,
        currentVersion: localVersion,
        latestVersion: null,
        minSupportedVersion: null,
        updateAvailable: false,
        unsupported: false,
        mandatory: false,
        downloadUrl: null,
        releaseNotesUrl: null,
        publishedAt: null,
        checkedAt: Date.now(),
        error: 'Unable to check updates'
      });
    } finally {
      setUpdateChecking(false);
    }
  };

  const formatCheckedAt = (ts?: number) => {
    if (!ts || !Number.isFinite(ts)) return '-';
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  useEffect(() => {
    if (!updateCheckOpen) return;
    if (!isSuperAdmin) {
      closeUpdateCheck();
      return;
    }
    runUpdateCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCheckOpen, isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <Transition show={updateCheckOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeUpdateCheck}>
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
              <Dialog.Panel className="w-full max-w-xl modal-panel">
                <div className="modal-header items-center">
                  <div className="min-w-0">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {t({ it: 'Aggiornamenti software', en: 'Software updates' })}
                    </Dialog.Title>
                    <div className="text-xs text-slate-500">
                      {t({ it: 'Versione installata', en: 'Installed version' })}: v{currentVersion}
                    </div>
                  </div>
                  <button onClick={closeUpdateCheck} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {t({ it: 'Ultimo controllo', en: 'Last check' })}: {formatCheckedAt(updateStatus?.checkedAt)}
                    </div>
                    <button
                      onClick={() => runUpdateCheck({ force: true })}
                      disabled={updateChecking}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title={t({ it: 'Controlla aggiornamenti', en: 'Check updates' })}
                    >
                      <RefreshCw size={15} className={updateChecking ? 'animate-spin' : ''} />
                      {t({ it: 'Controlla aggiornamenti', en: 'Check updates' })}
                    </button>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    {updateState === 'unknown' ? (
                      <div className="text-slate-600">{t({ it: 'Controllo versione in corso...', en: 'Checking version...' })}</div>
                    ) : null}
                    {updateState === 'error' ? (
                      <div className="text-rose-700">
                        {t({
                          it: 'Impossibile verificare aggiornamenti adesso. Riprova tra poco.',
                          en: 'Unable to verify updates right now. Please try again shortly.'
                        })}
                      </div>
                    ) : null}
                    {updateState === 'mandatory' ? (
                      <div className="text-rose-700">
                        {t({
                          it: `Aggiornamento richiesto. Versione disponibile: v${latestVersion || '-'}.`,
                          en: `Update required. Available version: v${latestVersion || '-'}.`
                        })}
                      </div>
                    ) : null}
                    {updateState === 'available' ? (
                      <div className="text-amber-700">
                        {t({
                          it: `Nuova versione disponibile: v${latestVersion || '-'}.`,
                          en: `New version available: v${latestVersion || '-'}.`
                        })}
                      </div>
                    ) : null}
                    {updateState === 'upToDate' ? (
                      <div className="text-emerald-700">{t({ it: 'Il software e aggiornato.', en: 'The software is up to date.' })}</div>
                    ) : null}
                    {updateStatus?.error ? <div className="mt-1 text-xs text-slate-500">{String(updateStatus.error)}</div> : null}
                    {updateStatus?.publishedAt ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {t({ it: 'Release pubblicata', en: 'Release published' })}: {formatCheckedAt(Date.parse(updateStatus.publishedAt))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {updateStatus?.downloadUrl ? (
                      <a
                        href={canDownload ? updateStatus.downloadUrl : undefined}
                        target={canDownload ? '_blank' : undefined}
                        rel={canDownload ? 'noreferrer' : undefined}
                        aria-disabled={!canDownload}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white ${
                          canDownload
                            ? updateState === 'mandatory'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-primary hover:bg-primary/90'
                            : 'cursor-not-allowed bg-slate-300'
                        }`}
                        onClick={(event) => {
                          if (!canDownload) event.preventDefault();
                        }}
                      >
                        <Download size={15} />
                        {t({ it: 'Scarica aggiornamento', en: 'Download updates' })}
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-300 px-3 py-2 text-sm font-semibold text-white"
                      >
                        <Download size={15} />
                        {t({ it: 'Scarica aggiornamento', en: 'Download updates' })}
                      </button>
                    )}
                    {updateStatus?.releaseNotesUrl ? (
                      <a
                        href={updateStatus.releaseNotesUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Note di rilascio', en: 'Release notes' })}
                      </a>
                    ) : null}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default UpdateCheckModal;
