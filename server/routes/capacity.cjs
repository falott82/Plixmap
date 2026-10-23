const { requireSuperAdmin } = require('../access.cjs');
const { CAPACITY_SNAPSHOT_MIN_INTERVAL_MS, resolveVisibleClientsForRequest, buildCapacityTrendSnapshot, buildCapacitySnapshotSignature } = require('../capacityTrends.cjs');
const registerCapacityRoutes = (app, { db, requireAuth, rateByUser, readState, readCapacityHistory, writeCapacityHistory }) => {
  app.get('/api/capacity/history', requireAuth, rateByUser('capacity_history', 60 * 1000, 120), (req, res) => {
    const serverState = readState();
    const allClients = serverState.clients || [];
    const visibleClients = resolveVisibleClientsForRequest(req, allClients, db);
    const visibleClientIds = new Set((visibleClients || []).map((entry) => String(entry?.id || '').trim()).filter(Boolean));
    const requestedClientId = String(req.query.clientId || '').trim();
    if (requestedClientId && !visibleClientIds.has(requestedClientId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const requestedLimitRaw = Number(req.query.limit);
    const requestedLimit = Number.isFinite(requestedLimitRaw) ? Math.max(1, Math.min(720, Math.floor(requestedLimitRaw))) : 180;
    const store = readCapacityHistory();
    const snapshots = (store.snapshots || [])
      .slice(-requestedLimit)
      .map((snapshot) => {
        const clients = (snapshot.clients || []).filter((entry) => {
          const clientId = String(entry?.clientId || '').trim();
          if (!clientId) return false;
          if (!visibleClientIds.has(clientId)) return false;
          if (requestedClientId && clientId !== requestedClientId) return false;
          return true;
        });
        if (!clients.length) return null;
        return { at: snapshot.at, clients };
      })
      .filter(Boolean);
    res.json({ ok: true, snapshots, lastSnapshotAt: store.lastSnapshotAt || null });
  });

  app.post('/api/capacity/snapshot', requireAuth, rateByUser('capacity_snapshot', 60 * 1000, 30), (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const force = !!req.body?.force;
    const store = readCapacityHistory();
    const sourceClients = (readState().clients || []).filter(Boolean);
    const snapshot = buildCapacityTrendSnapshot(sourceClients, Date.now());
    const signature = buildCapacitySnapshotSignature(snapshot);
    const lastSnapshot = store.snapshots[store.snapshots.length - 1];
    let appended = true;
    if (
      !force &&
      lastSnapshot &&
      signature &&
      signature === store.lastSignature &&
      Number(lastSnapshot.at || 0) > 0 &&
      snapshot.at - Number(lastSnapshot.at || 0) < CAPACITY_SNAPSHOT_MIN_INTERVAL_MS
    ) {
      appended = false;
    }
    const nextSnapshots = appended ? [...store.snapshots, snapshot] : store.snapshots;
    const trimmed = writeCapacityHistory({
      snapshots: nextSnapshots,
      lastSignature: signature || store.lastSignature || '',
      lastSnapshotAt: appended ? snapshot.at : store.lastSnapshotAt || lastSnapshot?.at || snapshot.at
    });
    res.json({
      ok: true,
      appended,
      snapshotAt: appended ? snapshot.at : Number(store.lastSnapshotAt || lastSnapshot?.at || snapshot.at),
      totalSnapshots: trimmed.length
    });
  });
};

module.exports = { registerCapacityRoutes };
