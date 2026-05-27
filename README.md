# Vegam Revenue Management Platform

> Commercial Operations & Revenue Governance Platform

A centralized operational and financial visibility system for managing long-cycle customer engagements, milestone-based commercial execution, and multi-stage revenue realization processes.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Ant Design 5 + Vite |
| Backend | Node.js + Express.js + TypeScript |
| Database | MongoDB + Mongoose |
| Auth | JWT (JSON Web Tokens) |

## Project Structure

```
vegam-revenue-management/
├── client/          # React frontend
├── server/          # Express backend
├── docs/            # Product specification documents
└── package.json     # Monorepo root
```

## Modules

1. **Dashboard** — Executive cockpit with KPIs and operational alerts
2. **Forecast** — Future revenue planning and distribution
3. **SOW** — Statement of Work document governance
4. **PO** — Customer Purchase Order management
5. **Invoice** — Revenue recognition and billing operations
6. **Payment / Realization** — Collections and cash tracking
7. **Cashflow & Runway** — Future liquidity planning
8. **Bulk Upload** — Historical data onboarding
9. **Commercial Repository** — MSAs, rate cards, agreements
10. **Reports** — KPIs and management visibility

## User Roles

| Role | Description |
|------|-------------|
| `finance_admin` | Full access — invoices, payments, cashflow, admin |
| `management` | Full visibility — dashboards, runway, scenario planning |
| `am_pm` | Commercial ops — forecasts, SOWs, invoice requests |
| `read_only_pm` | Read-only operational visibility |

## Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB >= 6.0
- npm >= 9

### Installation

```bash
# Install all dependencies
npm install

# Copy environment file
cp server/.env.example server/.env
# Edit server/.env with your MongoDB URI and JWT secret

# Run in development (both client and server)
npm run dev
```

### Individual Development

```bash
# Run only the backend
npm run dev --workspace=server

# Run only the frontend
npm run dev --workspace=client
```

## Ports

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Environment Variables

See `server/.env.example` for required environment variables.
