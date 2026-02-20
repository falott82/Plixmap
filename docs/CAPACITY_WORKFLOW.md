# Capacity Workflow

## Overview
Plixmap 3.1.2 introduces a full capacity workflow built around three connected features:
- Capacity dashboard by `Client -> Site -> Floor`.
- Guided placement wizard (`Trova sistemazione`) for new technicians.
- Room-level department mapping linked to imported real-user directories.

The goal is to make room assignment decisions measurable and auditable with live + historical data.

## Data model
`Room` now supports:
- `departmentTags?: string[]`

Each room can be associated to one or more departments. Tags are managed from the room modal and are suggested from imported users (`dept1/dept2/dept3`) when available.

## Capacity metrics (live)
Frontend metrics are computed from the current workspace state (`clients/sites/floorPlans`) and include:
- `totalCapacity`: sum of finite room capacities.
- `totalUsers`: user objects assigned to rooms (`user`, `real_user`, `generic_user`).
- `occupancyPct`: `totalUsers / totalCapacity` when capacity is finite.
- `usersPerSqm`: `totalUsers / totalSurfaceSqm`.
- `sqmPerUser`: `totalSurfaceSqm / totalUsers`.
- `overCapacityRooms`: count of rooms where assigned users exceed declared capacity.

Metrics are available at global/client/site/floor granularity.

## Guided placement (`Trova sistemazione`)
The modal flow is:
1. Select client.
2. Select site.
3. Select department for the new technician.
4. Enter number of technicians to place.

Ranking strategy:
- Prefer rooms that match the selected department.
- If no match is found, user can expand search to empty rooms.
- If still no match, user can include rooms from other departments.
- Within the same class, best-fit rooms are prioritized by residual capacity after placement.

Result cards show:
- Room/floor/site context.
- Occupancy ratio (`users/capacity`).
- Available seats.
- Department labels and match/fallback badges.

## Historical trend (backend)
Snapshots are persisted server-side in `app_settings` key `capacityHistoryV1`.

### Endpoints
- `GET /api/capacity/history`
  - Returns historical snapshots filtered by user visibility (RBAC).
  - Supports optional query params: `clientId`, `limit`.
- `POST /api/capacity/snapshot` (superadmin only)
  - Persists a new snapshot unless blocked by anti-spam interval on unchanged signature.

### Snapshot structure
Each snapshot stores lightweight totals per client/site:
- timestamp (`at`)
- per-client totals (capacity/users/surface/rooms/floors)
- per-site totals inside each client

The dashboard renders a multi-line trend chart of site capacity over time for the selected client.

## Permissions and safety
- History reads are filtered by the same visibility rules used for normal workspace access.
- Snapshot creation is restricted to superadmin.
- Snapshot creation is rate-limited and de-duplicated over short intervals when capacity signature is unchanged.

## UX placement
- `Rooms` popover now includes:
  - `Trova sistemazione`
  - `Stato capienza` (dashboard)
- Room modal now includes `Assigned departments` chip editor.

## Notes
- Historical snapshots are aggregate-only (no personal data payload).
- Live metrics are always derived from current state; historical data is used only for trend visualization.
