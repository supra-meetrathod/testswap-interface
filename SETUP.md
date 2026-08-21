# Setup

Fork of [Uniswap/interface](https://github.com/Uniswap/interface). Required changes to run standalone (outside Uniswap's internal infra) are listed below.

## Requirements

- Node `v22.22.2` (see `.nvmrc`, `engines.node` in `package.json`)
- Bun `>=1.3.14`

## Required changes from upstream `main`

1. **Node version**: pinned to `v22.22.2` via `.nvmrc` and `package.json` `engines.node`.
2. **Root `.env`**: add `SKIP_CONFIG_PULL=true` — skips Uniswap's internal `config:pull` step (`nx.json`, `apps/web/project.json`) which requires internal credentials.
3. **`apps/web/.env`**: cleared Privy credentials —
   - `PRIVY_APP_ID=""`
   - `PRIVY_CLIENT_ID=""`
4. **`package.json`**: removed `tools/uniswap-nx` from `workspaces` (internal Uniswap Nx tooling, not usable outside their infra).
5. **`tsconfig.json`**: removed project references to internal-only packages/apps:
   - `./tools/uniswap-nx`
   - `./apps/cli`
   - `./packages/transactional`
   - `./apps/dev-portal`
   - `./apps/mission-control`
6. **`apps/web/src/config.ts`**: `walletConnectProjectId` now reads `WALLET_CONNECT_PROJECT_ID` (was `WALLETCONNECT_PROJECT_ID`) to match `apps/web/.env`.

## Run

```bash
bun install
bun run web
```
