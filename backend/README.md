# RoadBuddy — Backend API (Phase 6)

Express + SQLite backend. No external database server needed — SQLite creates a single `roadbuddy.db` file automatically on first run.

---

## Quick Start

```bash
cd backend
cp .env.example .env      # copy env file (edit JWT_SECRET before deploying)
npm install               # install dependencies
node server.js            # start the server
```

Server runs at **http://localhost:3001**

---

## Demo Credentials (auto-seeded on first run)

| Role     | Email                  | Password     |
|----------|------------------------|--------------|
| Motorist | maria@test.com         | password123  |
| Provider | autofix@test.com       | password123  |
| Admin    | admin@roadbuddy.ph     | Admin@1234   |

Admin invite code for `register-admin.html`: **ROAD-BUDD-YADM**

---

## API Reference

### Auth
| Method | Endpoint                    | Body / Notes                              |
|--------|-----------------------------|-------------------------------------------|
| POST   | /api/auth/register          | email, password, role, firstName, lastName, [phone, vehicleType, businessName, serviceType] |
| POST   | /api/auth/login             | email, password, [role]                  |
| POST   | /api/auth/admin/login       | email, password                           |
| POST   | /api/auth/admin/register    | inviteCode, email, password, firstName, lastName, adminRole, department |
| POST   | /api/admin/verify-invite    | code → { valid, role, message }          |

### Users (requires Bearer token)
| Method | Endpoint      | Notes               |
|--------|---------------|---------------------|
| GET    | /api/users/me | Current user + provider profile |
| PUT    | /api/users/me | firstName, lastName, phone, vehicleType |

### Providers
| Method | Endpoint                       | Notes                           |
|--------|--------------------------------|---------------------------------|
| GET    | /api/providers/nearby          | ?lat=&lng=&type=                |
| GET    | /api/providers/:id             | Provider details                |

### Requests (requires auth)
| Method | Endpoint                     | Notes                           |
|--------|------------------------------|---------------------------------|
| POST   | /api/requests                | serviceType, description, locationLat, locationLng, locationAddress, [providerId] |
| GET    | /api/requests                | Filtered by user role           |
| GET    | /api/requests/:id            | Single request details          |
| PUT    | /api/requests/:id/status     | { status } one of: pending / matched / in-progress / completed / cancelled |

### Messages (requires auth)
| Method | Endpoint                          | Notes                      |
|--------|-----------------------------------|----------------------------|
| GET    | /api/messages/:requestId          | All messages + marks read  |
| POST   | /api/messages/:requestId          | { content }                |
| GET    | /api/messages/:requestId/unread   | Unread count               |

### Reviews
| Method | Endpoint                        | Notes                           |
|--------|---------------------------------|---------------------------------|
| POST   | /api/reviews                    | requestId, providerId, rating, [comment] (auth required) |
| GET    | /api/reviews/provider/:id       | Public                          |

### Admin (requires admin Bearer token)
| Method | Endpoint                             | Notes                     |
|--------|--------------------------------------|---------------------------|
| GET    | /api/admin/users                     | All motorists + providers |
| GET    | /api/admin/providers                 | All providers             |
| POST   | /api/admin/providers/:id/approve     | Approve a provider        |
| POST   | /api/admin/providers/:id/reject      | Reject a provider         |
| POST   | /api/admin/providers/:id/suspend     | Suspend a provider        |
| GET    | /api/admin/requests                  | All requests [?status=]   |
| GET    | /api/admin/reviews                   | All reviews               |
| PATCH  | /api/admin/reviews/:id/flag          | Toggle flag               |
| GET    | /api/admin/analytics                 | Platform stats            |
| GET    | /api/admin/audit-log                 | Last 100 entries          |
| GET    | /api/admin/settings                  | All settings              |
| PUT    | /api/admin/settings                  | { settings: { key: value } } |
| GET    | /api/admin/admins                    | All admin accounts        |

### Health
```
GET /api/health  →  { status: 'ok', version: '1.0.0', phase: 6 }
```

---

## Database

Single SQLite file: `backend/roadbuddy.db`

Tables: `users` · `providers` · `requests` · `messages` · `reviews` · `admin_users` · `invite_codes` · `audit_log` · `settings`

To reset the database and re-seed: delete `roadbuddy.db` and restart the server.

---

## Development

```bash
npm run dev    # uses nodemon — auto-restarts on file changes
```
