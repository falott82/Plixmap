import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Download, LocateFixed, Maximize2, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

export type PhotoItem = {
  id: string;
  name?: string;
  description?: string;
  url: string;
  roomName?: string;
};

interface Props {
  open: boolean;
  photos: PhotoItem[];
  initialId?: string;
  title?: { it: string; en: string };
  countLabel?: { it: string; en: string };
  itemLabel?: { it: string; en: string };
  emptyLabel?: { it: string; en: string };
  onFocus?: (id: string) => void;
  onClose: () => void;
}

const getFileExtension = (url: string) => {
  if (!url) return 'jpg';
  if (url.startsWith('data:')) {
    const match = url.match(/^data:image\/([a-zA-Z0-9+.-]+);/);
    if (match?.[1]) return match[1].replace('jpeg', 'jpg');
    return 'jpg';
  }
  const cleaned = url.split('?')[0].split('#')[0];
  const last = cleaned.split('.').pop();
  if (last && last.length <= 5) return last.toLowerCase();
  return 'jpg';
};

const buildDownloadName = (photo: PhotoItem) => {
  const base = String(photo.name || 'foto').trim() || 'foto';
  const safe = base.replace(/[^\w-]+/g, '_');
  const ext = getFileExtension(photo.url);
  return `${safe}.${ext}`;
};

const PhotoViewerModal = ({ open, photos, initialId, title, countLabel, itemLabel, emptyLabel, onFocus, onClose }: Props) => {
  const t = useT();
  const [fullScreenId, setFullScreenId] = useState<string | null>(null);
  const titleText = title ? t(title) : t({ it: 'Foto', en: 'Photos' });
  const countLabelText = countLabel || { it: 'foto', en: 'photos' };
  const itemLabelText = itemLabel || { it: 'Foto', en: 'Photo' };
  const emptyHeaderText = emptyLabel ? t(emptyLabel) : t({ it: 'Nessuna foto disponibile', en: 'No photos available' });
  const handleClose = () => {
    if (fullScreenId) {
      setFullScreenId(null);
      return;
    }
    onClose();
  };

  const initialPhoto = useMemo(() => {
    if (initialId) {
      const match = photos.find((p) => p.id === initialId);
      if (match) return match;
    }
    return photos[0] || null;
  }, [initialId, photos]);
  const focusTargetId = fullScreenId || initialPhoto?.id || photos[0]?.id || null;
  const handleFocus = () => {
    if (!focusTargetId) return;
    onFocus?.(focusTargetId);
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setFullScreenId(null);
      return;
    }
    if (photos.length === 1 && initialPhoto) {
      setFullScreenId(null);
    } else {
      setFullScreenId(null);
    }
  }, [initialPhoto, open, photos.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (fullScreenId) {
          setFullScreenId(null);
          return;
        }
        onClose();
        return;
      }
      if (!fullScreenId || photos.length < 2) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      event.stopPropagation();
      const idx = photos.findIndex((p) => p.id === fullScreenId);
      if (idx < 0) return;
      const dir = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (idx + dir + photos.length) % photos.length;
      const next = photos[nextIndex];
      if (next) setFullScreenId(next.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullScreenId, onClose, open, photos]);

  const fullScreenPhoto = useMemo(() => {
    if (!fullScreenId) return null;
    return photos.find((p) => p.id === fullScreenId) || null;
  }, [fullScreenId, photos]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={handleClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-5xl modal-panel">
                <div className="modal-header items-center">
                  <div>
                    <Dialog.Title className="modal-title">{titleText}</Dialog.Title>
                    <div className="modal-description">
                      {photos.length
                        ? t({ it: `${photos.length} ${countLabelText.it}`, en: `${photos.length} ${countLabelText.en}` })
                        : emptyHeaderText}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {!photos.length ? (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    {t({ it: 'Nessuna foto da mostrare.', en: 'No photos to show.' })}
                  </div>
                ) : photos.length === 1 && initialPhoto ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-ink">{initialPhoto.name || t(itemLabelText)}</div>
                      {initialPhoto.description ? <div className="text-xs text-slate-500">{initialPhoto.description}</div> : null}
                      {initialPhoto.roomName ? <div className="text-[11px] text-slate-500">{initialPhoto.roomName}</div> : null}
                      <div className="ml-auto flex items-center gap-2">
                        <a
                          href={initialPhoto.url}
                          download={buildDownloadName(initialPhoto)}
                          className="btn-inline"
                          title={t({ it: 'Scarica foto', en: 'Download photo' })}
                        >
                          <Download size={14} />
                          {t({ it: 'Scarica', en: 'Download' })}
                        </a>
                        {onFocus ? (
                          <button
                            onClick={handleFocus}
                            className="btn-inline"
                            title={t({ it: 'Vai alla foto', en: 'Go to photo' })}
                          >
                            <LocateFixed size={14} />
                            {t({ it: 'Trova', en: 'Locate' })}
                          </button>
                        ) : null}
                        <button
                          onClick={() => setFullScreenId(initialPhoto.id)}
                          className="btn-inline"
                          title={t({ it: 'Apri a schermo intero', en: 'Open fullscreen' })}
                        >
                          <Maximize2 size={14} />
                          {t({ it: 'Fullscreen', en: 'Fullscreen' })}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFullScreenId(initialPhoto.id)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left"
                      title={t({ it: 'Apri a schermo intero', en: 'Open fullscreen' })}
                    >
                      <img src={initialPhoto.url} alt={initialPhoto.name || 'photo'} className="max-h-[70vh] w-full rounded-xl object-contain" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 grid max-h-[68vh] grid-cols-2 gap-3 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setFullScreenId(photo.id)}
                        className="group rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md"
                      >
                        <div className="relative h-32 w-full overflow-hidden rounded-xl bg-slate-100">
                          <img src={photo.url} alt={photo.name || 'photo'} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                        </div>
                        <div className="mt-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-ink">{photo.name || t(itemLabelText)}</div>
                            {photo.description ? (
                              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{photo.description}</div>
                            ) : null}
                            {photo.roomName ? (
                              <div className="mt-0.5 text-[11px] text-slate-500">{photo.roomName}</div>
                            ) : null}
                          </div>
                          <a
                            href={photo.url}
                            download={buildDownloadName(photo)}
                            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            title={t({ it: 'Scarica foto', en: 'Download photo' })}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>

        {fullScreenPhoto ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-6">
            <div className="absolute right-6 top-6 flex items-center gap-2">
              <a
                href={fullScreenPhoto.url}
                download={buildDownloadName(fullScreenPhoto)}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
              >
                {t({ it: 'Scarica', en: 'Download' })}
              </a>
              {onFocus ? (
                <button
                  onClick={handleFocus}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                  title={t({ it: 'Vai alla foto', en: 'Go to photo' })}
                >
                  {t({ it: 'Trova', en: 'Locate' })}
                </button>
              ) : null}
              <button
                onClick={() => setFullScreenId(null)}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
              >
                {t({ it: 'Chiudi', en: 'Close' })}
              </button>
            </div>
            <img src={fullScreenPhoto.url} alt={fullScreenPhoto.name || 'photo'} className="max-h-[90vh] max-w-[92vw] object-contain" />
          </div>
        ) : null}
      </Dialog>
    </Transition>
  );
};

export default PhotoViewerModal;
