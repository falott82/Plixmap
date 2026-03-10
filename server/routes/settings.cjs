const nodemailer = require('nodemailer');
const {
  buildExpiredLogsCsv,
  buildLogRetentionPreview,
  normalizeLogRetentionSettings,
  purgeExpiredLogs,
  readLogRetentionSettings,
  writeLogRetentionSettings
} = require('../logRetention.cjs');

const requireSuperAdmin = (req, res) => {
  if (req.isSuperAdmin) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
};

const normalizeLogsMeta = (meta, resolveUsername) => {
  const normalized = {};
  Object.entries(meta || {}).forEach(([kind, info]) => {
    if (!info || typeof info !== 'object') return;
    const username = info.username || resolveUsername(info.userId);
    normalized[kind] = { ...info, username: username || null };
  });
  return normalized;
};

const buildMailTransportConfig = (config) => {
  const securityMode = config.securityMode || (config.secure ? 'ssl' : 'starttls');
  return {
    host: config.host,
    port: config.port,
    secure: securityMode === 'ssl',
    requireTLS: securityMode === 'starttls',
    ...(config.username ? { auth: { user: config.username, pass: config.password } } : {})
  };
};

const buildMailFromLabel = (config) => {
  const fromEmail = config.fromEmail || config.username;
  if (!fromEmail) return '';
  return config.fromName ? `"${String(config.fromName).replace(/"/g, '')}" <${fromEmail}>` : fromEmail;
};

const registerSettingsRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    getAuditVerboseEnabled,
    setAuditVerboseEnabled,
    getEmailConfigSafe,
    getEmailConfig,
    upsertEmailConfig,
    getClientEmailConfigSafe,
    getClientEmailConfig,
    upsertClientEmailConfig,
    normalizePortalPublicUrl,
    getPortalPublicUrl,
    setPortalPublicUrl,
    logEmailAttempt,
    listEmailLogs,
    readState,
    APP_BRAND,
    dataSecret,
    fallbackPortalPublicUrl,
    readLogsMeta,
    resolveUsername,
    markLogsCleared
  } = deps;

  app.put('/api/settings/audit', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const enabled = !!req.body?.auditVerbose;
    setAuditVerboseEnabled(db, enabled);
    writeAuditLog(db, { level: 'important', event: 'audit_settings_update', userId: req.userId, ...requestMeta(req), details: { auditVerbose: enabled } });
    res.json({ ok: true, auditVerbose: enabled });
  });

  app.get('/api/settings/email', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json({
      config: {
        ...(getEmailConfigSafe(db) || {}),
        portalPublicUrl: getPortalPublicUrl(db, fallbackPortalPublicUrl)
      }
    });
  });

  app.get('/api/clients/:clientId/email-settings', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    res.json({ config: getClientEmailConfigSafe(db, clientId) });
  });

  app.get('/api/clients/email-settings-summary', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const state = readState();
    const clients = Array.isArray(state?.clients) ? state.clients : [];
    const byClientId = {};
    for (const client of clients) {
      const cid = String(client?.id || '').trim();
      if (!cid) continue;
      const cfg = getClientEmailConfigSafe(db, cid);
      byClientId[cid] = !!(cfg && String(cfg.host || '').trim());
    }
    res.json({ byClientId });
  });

  app.put('/api/settings/email', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const payload = req.body || {};
    const normalizedPortalPublicUrl = normalizePortalPublicUrl(payload.portalPublicUrl);
    if (payload.portalPublicUrl !== undefined && String(payload.portalPublicUrl || '').trim() && !normalizedPortalPublicUrl) {
      res.status(400).json({ error: 'Invalid portal public URL' });
      return;
    }
    const updated = upsertEmailConfig(db, dataSecret, {
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      securityMode: payload.securityMode,
      username: payload.username,
      password: payload.password,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail
    });
    if (payload.portalPublicUrl !== undefined) {
      setPortalPublicUrl(db, normalizedPortalPublicUrl || '');
    }
    writeAuditLog(db, {
      level: 'important',
      event: 'email_settings_update',
      userId: req.userId,
      username: req.username,
      ...requestMeta(req),
      details: {
        host: updated?.host || null,
        port: updated?.port || null,
        securityMode: updated?.securityMode || null,
        portalPublicUrlConfigured: !!String(getPortalPublicUrl(db, fallbackPortalPublicUrl) || '').trim()
      }
    });
    res.json({
      ok: true,
      config: {
        ...(updated || {}),
        portalPublicUrl: getPortalPublicUrl(db, fallbackPortalPublicUrl)
      }
    });
  });

  app.put('/api/clients/:clientId/email-settings', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const payload = req.body || {};
    const updated = upsertClientEmailConfig(db, dataSecret, clientId, {
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      securityMode: payload.securityMode,
      username: payload.username,
      password: payload.password,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail
    });
    writeAuditLog(db, {
      level: 'important',
      event: 'client_email_settings_update',
      userId: req.userId,
      username: req.username,
      scopeType: 'client',
      scopeId: clientId,
      ...requestMeta(req),
      details: { host: updated?.host || null, port: updated?.port || null, securityMode: updated?.securityMode || null }
    });
    res.json({ ok: true, config: updated });
  });

  app.post('/api/settings/openai/test', requireAuth, rateByUser('openai_test', 5 * 60 * 1000, 15), async (req, res) => {
    if (!req.isAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const apiKey = String(req.body?.apiKey || '').trim();
    if (!apiKey) {
      res.status(400).json({ error: 'Missing OpenAI API key' });
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('https://api.openai.com/v1/models?limit=1', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal
      });
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const body = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          (body && typeof body === 'object' && (body.error?.message || body.message)) ||
          `OpenAI request failed (${response.status})`;
        writeAuditLog(db, {
          level: 'important',
          event: 'openai_key_test_failed',
          userId: req.userId,
          username: req.username,
          ...requestMeta(req),
          details: { status: response.status, reason: String(errorMessage || '').slice(0, 300) }
        });
        res.status(400).json({ ok: false, error: errorMessage, status: response.status });
        return;
      }
      const firstModel =
        body && typeof body === 'object' && Array.isArray(body.data) && body.data.length
          ? String(body.data[0]?.id || '').trim() || null
          : null;
      writeAuditLog(db, {
        level: 'important',
        event: 'openai_key_test_ok',
        userId: req.userId,
        username: req.username,
        ...requestMeta(req),
        details: { firstModel }
      });
      res.json({ ok: true, provider: 'openai', firstModel });
    } catch (err) {
      const detail = err?.name === 'AbortError' ? 'OpenAI request timeout' : err?.message || 'OpenAI request failed';
      writeAuditLog(db, {
        level: 'important',
        event: 'openai_key_test_failed',
        userId: req.userId,
        username: req.username,
        ...requestMeta(req),
        details: { status: 0, reason: String(detail || '').slice(0, 300) }
      });
      res.status(500).json({ ok: false, error: 'Failed to test OpenAI key', detail });
    } finally {
      clearTimeout(timeoutId);
    }
  });

  app.post('/api/settings/email/test', requireAuth, rateByUser('email_test', 5 * 60 * 1000, 5), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const recipient = String(req.body?.recipient || '').trim();
    const subjectInput = String(req.body?.subject || '').trim();
    if (!recipient) {
      res.status(400).json({ error: 'Missing recipient' });
      return;
    }
    const config = getEmailConfig(db, dataSecret);
    if (!config || !config.host) {
      res.status(400).json({ error: 'Missing SMTP host' });
      return;
    }
    if (config.username && !config.password) {
      res.status(400).json({ error: 'Missing SMTP password' });
      return;
    }
    const fromEmail = config.fromEmail || config.username;
    if (!fromEmail) {
      res.status(400).json({ error: 'Missing from email' });
      return;
    }
    const subject = subjectInput || 'Test Email';
    const fromLabel = buildMailFromLabel(config);
    const transport = nodemailer.createTransport(buildMailTransportConfig(config));
    try {
      const info = await transport.sendMail({
        from: fromLabel,
        to: recipient,
        subject,
        text: `This is a test email from ${APP_BRAND}.`
      });
      logEmailAttempt(db, {
        userId: req.userId,
        username: req.username,
        recipient,
        subject,
        success: true,
        details: {
          host: config.host,
          port: config.port,
          secure: !!config.secure,
          fromEmail,
          messageId: info?.messageId || null
        }
      });
      writeAuditLog(db, {
        level: 'important',
        event: 'email_test_sent',
        userId: req.userId,
        username: req.username,
        ...requestMeta(req),
        details: { recipient, messageId: info?.messageId || null }
      });
      res.json({ ok: true, messageId: info?.messageId || null });
    } catch (err) {
      logEmailAttempt(db, {
        userId: req.userId,
        username: req.username,
        recipient,
        subject,
        success: false,
        error: err?.message || 'Failed to send',
        details: {
          host: config.host,
          port: config.port,
          secure: !!config.secure,
          fromEmail
        }
      });
      writeAuditLog(db, {
        level: 'important',
        event: 'email_test_failed',
        userId: req.userId,
        username: req.username,
        ...requestMeta(req),
        details: { recipient, reason: String(err?.message || 'Failed to send').slice(0, 300) }
      });
      res.status(500).json({ error: 'Failed to send test email', detail: err?.message || null });
    }
  });

  app.post('/api/clients/:clientId/email-settings/test', requireAuth, rateByUser('client_email_test', 5 * 60 * 1000, 10), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const clientId = String(req.params.clientId || '').trim();
    const recipient = String(req.body?.recipient || '').trim();
    const subjectInput = String(req.body?.subject || '').trim();
    if (!clientId || !recipient) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }
    const state = readState();
    const clientName =
      (state.clients || []).find((c) => String(c?.id || '') === clientId)?.shortName ||
      (state.clients || []).find((c) => String(c?.id || '') === clientId)?.name ||
      clientId;
    const config = getClientEmailConfig(db, dataSecret, clientId);
    if (!config || !config.host) {
      res.status(400).json({ error: `SMTP non configurato per il cliente ${clientName}.` });
      return;
    }
    if (config.username && !config.password) {
      res.status(400).json({ error: `SMTP non completato per il cliente ${clientName} (password mancante).` });
      return;
    }
    const fromEmail = config.fromEmail || config.username;
    if (!fromEmail) {
      res.status(400).json({ error: `SMTP non completato per il cliente ${clientName} (mittente mancante).` });
      return;
    }
    const subject = subjectInput || 'Client SMTP Test Email';
    const fromLabel = buildMailFromLabel(config);
    const transport = nodemailer.createTransport(buildMailTransportConfig(config));
    try {
      const info = await transport.sendMail({ from: fromLabel, to: recipient, subject, text: `This is a client-scoped SMTP test email from ${APP_BRAND}.` });
      logEmailAttempt(db, {
        userId: req.userId,
        username: req.username,
        recipient,
        subject,
        success: true,
        details: { kind: 'client_email_test', clientId, messageId: info?.messageId || null }
      });
      writeAuditLog(db, {
        level: 'important',
        event: 'client_email_test_sent',
        userId: req.userId,
        username: req.username,
        scopeType: 'client',
        scopeId: clientId,
        ...requestMeta(req),
        details: { recipient, messageId: info?.messageId || null }
      });
      res.json({ ok: true, messageId: info?.messageId || null });
    } catch (err) {
      logEmailAttempt(db, {
        userId: req.userId,
        username: req.username,
        recipient,
        subject,
        success: false,
        error: err?.message || 'Failed to send',
        details: { kind: 'client_email_test', clientId }
      });
      writeAuditLog(db, {
        level: 'important',
        event: 'client_email_test_failed',
        userId: req.userId,
        username: req.username,
        scopeType: 'client',
        scopeId: clientId,
        ...requestMeta(req),
        details: { recipient, reason: String(err?.message || 'Failed to send').slice(0, 300) }
      });
      res.status(500).json({ error: 'Failed to send test email', detail: err?.message || null });
    }
  });

  app.get('/api/settings/email/logs', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const result = listEmailLogs(db, { q: req.query.q, limit: req.query.limit, offset: req.query.offset });
    res.json(result);
  });

  app.post('/api/settings/email/logs/clear', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const total = Number(db.prepare('SELECT COUNT(1) as c FROM email_log').get()?.c || 0);
    db.prepare('DELETE FROM email_log').run();
    markLogsCleared('mail', req.userId, req.username);
    writeAuditLog(db, {
      level: 'important',
      event: 'email_log_cleared',
      userId: req.userId,
      username: req.username,
      ...requestMeta(req),
      details: { count: total }
    });
    res.json({ ok: true, deleted: total });
  });

  app.get('/api/settings/logs-meta', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json({ meta: normalizeLogsMeta(readLogsMeta(), resolveUsername) });
  });

  app.get('/api/settings/logs-retention', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json({ settings: readLogRetentionSettings(db) });
  });

  app.post('/api/settings/logs-retention/preview', requireAuth, rateByUser('logs_retention_preview', 5 * 60 * 1000, 60), (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const settings = normalizeLogRetentionSettings(req.body?.settings);
    res.json({ preview: buildLogRetentionPreview(db, settings) });
  });

  app.post('/api/settings/logs-retention/export', requireAuth, rateByUser('logs_retention_export', 5 * 60 * 1000, 15), (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const kind = String(req.body?.kind || '').trim().toLowerCase();
    if (!kind) {
      res.status(400).json({ error: 'Missing kind' });
      return;
    }
    try {
      const settings = normalizeLogRetentionSettings(req.body?.settings);
      const csv = buildExpiredLogsCsv(db, kind, settings);
      writeAuditLog(db, {
        level: 'important',
        event: 'logs_retention_export',
        userId: req.userId,
        username: req.username,
        ...requestMeta(req),
        details: { kind, days: settings[kind]?.days || null }
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="plixmap-${kind}-logs-export.csv"`);
      res.send(csv);
    } catch (err) {
      res.status(400).json({ error: err?.message || 'Invalid retention export request' });
    }
  });

  app.put('/api/settings/logs-retention', requireAuth, rateByUser('logs_retention_update', 5 * 60 * 1000, 20), (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const settings = normalizeLogRetentionSettings(req.body?.settings);
    const purgeNow = req.body?.purgeNow !== false;
    const saved = writeLogRetentionSettings(db, settings);
    const preview = buildLogRetentionPreview(db, saved);
    const purgeSummary = purgeNow ? purgeExpiredLogs(db, saved) : null;
    writeAuditLog(db, {
      level: 'important',
      event: 'logs_retention_update',
      userId: req.userId,
      username: req.username,
      ...requestMeta(req),
      details: {
        settings: saved,
        purgeNow,
        totalEligible: preview.totalCount,
        totalDeleted: purgeSummary?.totalDeleted || 0
      }
    });
    res.json({ ok: true, settings: saved, preview, purgeSummary });
  });
};

module.exports = {
  buildMailFromLabel,
  buildMailTransportConfig,
  normalizeLogsMeta,
  registerSettingsRoutes
};
