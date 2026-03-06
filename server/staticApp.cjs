const fs = require('fs');
const path = require('path');
const express = require('express');

const attachStaticApp = (app, deps = {}) => {
  const distDir = deps.distDir || path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) return;

  const readIndexHtml = () => fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

  const renderKioskIndexHtml = (roomId) => {
    const rid = encodeURIComponent(String(roomId || '').trim());
    let html = readIndexHtml();
    const kioskManifestHref = `/manifest-kiosk/${rid}.webmanifest`;
    if (html.includes('rel="manifest"')) {
      html = html.replace(/<link\s+rel="manifest"\s+href="[^"]*"\s*\/?>/i, `<link rel="manifest" href="${kioskManifestHref}">`);
    } else {
      html = html.replace(/<\/head>/i, `  <link rel="manifest" href="${kioskManifestHref}"></head>`);
    }
    return html;
  };

  const renderMobileIndexHtml = () => {
    let html = readIndexHtml();
    const mobileManifestHref = `/manifest-mobile.webmanifest`;
    if (html.includes('rel="manifest"')) {
      html = html.replace(/<link\s+rel="manifest"\s+href="[^"]*"\s*\/?>/i, `<link rel="manifest" href="${mobileManifestHref}">`);
    } else {
      html = html.replace(/<\/head>/i, `  <link rel="manifest" href="${mobileManifestHref}"></head>`);
    }
    return html;
  };

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

module.exports = { attachStaticApp };
