export const getWsUrl = (locationLike: Pick<Location, 'protocol' | 'host'> = window.location) => {
  const proto = locationLike.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${locationLike.host}/ws`;
};

export const closeSocketSafely = (socket: WebSocket | null | undefined) => {
  if (!socket) return;
  if (socket.readyState === WebSocket.CONNECTING) {
    const closeLater = () => {
      try {
        socket.close();
      } catch {
        // ignore close failures during teardown
      }
    };
    socket.addEventListener('open', closeLater, { once: true });
    return;
  }
  try {
    socket.close();
  } catch {
    // ignore close failures during teardown
  }
};
