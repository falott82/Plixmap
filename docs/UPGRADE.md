# Upgrade Guide

This guide is for installations that already run Plixmap and need to move to a newer version.

## Before you start
- Read the release notes in [`CHANGELOG.md`](../CHANGELOG.md).
- Create a backup first.
- If you use customer SMTP/provisioning emails, verify `Settings > Email > Portal public URL` after the upgrade.
- If you customized service names, ports, or reverse proxy rules, keep your current deployment-specific values.

## Upgrade with Docker
From the existing installation directory:

```bash
git pull
docker compose build
docker compose up -d
```

What happens:
- the new application image is rebuilt
- containers restart with the updated code
- database migrations run automatically at backend startup
- data in `./data` is preserved if it is stored on the existing volume/bind mount

Recommended checks after upgrade:

```bash
docker compose ps
docker compose logs --tail=100
```

If you want a zero-surprise flow, create a DB backup before `docker compose up -d`.

## Upgrade with npm / traditional install
From the existing installation directory:

```bash
git pull
npm install
npm run build
```

Then restart the backend process you already use in production, for example:

```bash
npm start
```

Or restart your existing `systemd`, `pm2`, container, or supervisor-managed service.

What happens:
- dependencies are aligned with the new version
- the frontend bundle is rebuilt
- database migrations run automatically when the backend starts
- the SQLite database and uploads remain in your current `data/` path

## Suggested post-upgrade checks
- Open the app and verify login.
- Open `Settings > Email` and confirm `Portal public URL` if you use portal-user provisioning emails.
- Check:
  - users list
  - meetings
  - mobile app
  - kiosk mode
  - backups/health endpoints if you use them operationally

## Rollback note
If the upgrade fails, stop the service and restore the backup created before the upgrade. Do not rely on partial manual rollback of code only when DB migrations have already run.
