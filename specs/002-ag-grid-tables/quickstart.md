# Quickstart: AG Grid Community Tables

## Prerequisites

- Node.js and pnpm compatible with the repository.
- Dependencies installed with `pnpm install`.
- Local `bus_api` available with seeded super-admin credentials.
- `.env.local` configured according to `.env.example`.

## Install and run

```bash
pnpm install
pnpm dev
```

Open the dashboard URL printed by Next.js, sign in as `super_admin`, and use the
Arabic shell routes.

## Static validation

Run from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected result: all commands pass. Existing unrelated lint failures must be
recorded separately from failures introduced by the grid migration.

## Representative browser walkthrough

Use a fleet with at least 25 records in one representative collection, or load
multiple cursor pages.

1. Open `/fleets`, `/buses`, `/trips`, `/bookings`, and `/users`.
2. Confirm each collection renders in the shared Arabic RTL grid with stable
   columns, loading state, empty state, and row actions.
3. Enter an Arabic or Latin search term and confirm only matching loaded rows
   remain visible; clear it and confirm the rows return.
4. Open a text, number, or date column filter, apply it, clear it, and confirm the
   active result/page state changes without a full-page navigation.
5. Change page size and navigate forward/back through client pages.
6. Select the Arabic CSV export action and verify the downloaded file has Arabic
   headers, Western digits, expected loaded rows, no action column, and readable
   UTF-8 text.
7. Use the Arabic load-more action when `nextCursor` exists. Confirm rows append,
   active search/filter state remains usable, and the action disappears when the
   cursor becomes null.
8. Trigger a failed next-page request if available. Confirm loaded rows remain,
   an Arabic error is visible, and retry is possible.
9. Repeat one detail collection, such as fleet Members or bus Trips, and confirm
   detail/edit/delete actions still work and destructive actions still require
   their existing confirmation dialogs.
10. Repeat at a narrow viewport and with keyboard navigation. Confirm horizontal
    overflow is bounded, focus is visible, controls have Arabic accessible names,
    and no toolbar/grid/pagination content overlaps.

## Contract references

- UI behavior and props: [contracts/grid-ui.md](contracts/grid-ui.md)
- Client state model: [data-model.md](data-model.md)
- Technical decisions: [research.md](research.md)
- User requirements: [spec.md](spec.md)
