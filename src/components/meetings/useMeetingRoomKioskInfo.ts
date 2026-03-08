import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { fetchMeetingRoomSchedule } from '../../api/meetings';

type Options = {
  roomId?: string | null;
  enabled?: boolean;
  qrWidth?: number;
};

export const getMeetingRoomKioskFallbackLink = (roomId: string) => {
  const path = `/meetingroom/${encodeURIComponent(String(roomId))}`;
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
};

export const useMeetingRoomKioskInfo = ({ roomId, enabled = true, qrWidth = 300 }: Options) => {
  const [link, setLink] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!enabled || !roomId) {
      setLink('');
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    const fallback = getMeetingRoomKioskFallbackLink(roomId);
    fetchMeetingRoomSchedule(String(roomId))
      .then((res: any) => String(res?.kioskPublicUrl || '').trim() || fallback)
      .catch(() => fallback)
      .then((nextLink) => {
        if (cancelled) return;
        setLink(nextLink);
        return QRCode.toDataURL(nextLink, { margin: 1, width: qrWidth })
          .then((url: string) => {
            if (!cancelled) setQrDataUrl(url);
          })
          .catch(() => {
            if (!cancelled) setQrDataUrl('');
          });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, qrWidth, roomId]);

  return { link, qrDataUrl };
};
