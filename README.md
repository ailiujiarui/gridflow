# GridFlow

GridFlow is a dense, keyboard-friendly data workbench built with React, TypeScript, Vite and TanStack Virtual. It demonstrates the interaction model for browsing and editing a 100,000-record dataset without creating 100,000 row DOM nodes.

## Included

- Virtualized fixed-height rows with deterministic 100,000-record demo data
- Search, status filtering, sort direction and field controls
- Text, status, number, date and currency cell rendering
- Double-click editing with Enter/Escape/blur behavior
- Undo/redo, save status, empty state and keyboard shortcuts
- Responsive viewing layout with horizontal overflow for dense data

## Run

```bash
npm install
npm run dev
npm run build
```

The current demo keeps data in the client so the interaction and virtualization can be evaluated without a service dependency. The API contract and persistence boundary are documented in the parent implementation design and are the next backend increment.

## Performance notes

The grid uses `@tanstack/react-virtual` with a 40px row estimate and 10-row overscan. Measure DOM row count and scroll behavior in the browser before publishing any numeric claim.
