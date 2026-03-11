const fs = require('fs');
const path = require('path');
const express = require('express');

const createStaticIndexRenderer = (distDir) => {
  const indexPath = path.join(distDir, 'index.html');
  const MAX_KIOSK_CACHE = 200;
  let cachedMtimeMs = -1;
  let cachedBaseHtml = '';
  let cachedMobileHtml = '';
  const cachedKioskHtmlByRoomId = new Map();

  const replaceManifestHref = (html, href) => {
    if (html.includes('rel="manifest"')) {
      return html.replace(/<link\s+rel="manifest"\s+href="[^"]*"\s*\/?>/i, `<link rel="manifest" href="${href}">`);
    }
    return html.replace(/<\/head>/i, `  <link rel="manifest" href="${href}"></head>`);
  };

  const ensureBaseHtml = () => {
    const stat = fs.statSync(indexPath);
    if (!cachedBaseHtml || stat.mtimeMs !== cachedMtimeMs) {
      cachedMtimeMs = stat.mtimeMs;
      cachedBaseHtml = fs.readFileSync(indexPath, 'utf8');
      cachedMobileHtml = '';
      cachedKioskHtmlByRoomId.clear();
    }
    return cachedBaseHtml;
  };

  const renderKioskIndexHtml = (roomId) => {
    const rid = encodeURIComponent(String(roomId || '').trim());
    if (!rid) return ensureBaseHtml();
    const cached = cachedKioskHtmlByRoomId.get(rid);
    if (cached) return cached;
    const html = replaceManifestHref(ensureBaseHtml(), `/manifest-kiosk/${rid}.webmanifest`);
    if (cachedKioskHtmlByRoomId.size >= MAX_KIOSK_CACHE) {
      const firstKey = cachedKioskHtmlByRoomId.keys().next().value;
      if (firstKey) cachedKioskHtmlByRoomId.delete(firstKey);
    }
    cachedKioskHtmlByRoomId.set(rid, html);
    return html;
  };

  const renderMobileIndexHtml = () => {
    if (cachedMobileHtml) return cachedMobileHtml;
    cachedMobileHtml = replaceManifestHref(ensureBaseHtml(), '/manifest-mobile.webmanifest');
    return cachedMobileHtml;
  };

  return {
    renderKioskIndexHtml,
    renderMobileIndexHtml
  };
};

const attachStaticApp = (app, deps = {}) => {
  const distDir = deps.distDir || path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) return;
  const { renderKioskIndexHtml, renderMobileIndexHtml } = createStaticIndexRenderer(distDir);

  app.get(/^\/meetingroom\/([^/]+)\/?$/, (req, res) => {
    try {
      const roomId = String(req.params?.[0] || '').trim();
      if (!roomId) return res.sendFile(path.join(distDir, 'index.html'));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(renderKioskIndexHtml(roomId));
    } catch {
      res.sendFile(path.join(distDir, 'index.html'));
    }
  });

  app.get(/^\/mobile\/?$/, (_req, res) => {
    try {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(renderMobileIndexHtml());
    } catch {
      res.sendFile(path.join(distDir, 'index.html'));
    }
  });

  const distAssetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(distAssetsDir)) {
    app.use(
      '/assets',
      express.static(distAssetsDir, {
        fallthrough: false,
        maxAge: '1y',
        immutable: true
      })
    );
  }

  app.use(express.static(distDir, { maxAge: 0 }));
  app.get(/.*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distDir, 'index.html'));
  });
};

module.exports = { attachStaticApp, createStaticIndexRenderer };
