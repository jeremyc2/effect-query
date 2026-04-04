# Vite Plus Effect Query Example

This example is a very small multi-page React app scaffolded with `vp create vite -- --template react-ts` and then rewritten to use:

- Effect Atom for local UI state
- `effect-query` for query atom factories, query atoms, invalidation, and mutations
- TanStack Router for the page shell

## What it shows

- An overview page backed by a dashboard query atom
- A tasks page where a local atom selects the active task-list query atom
- A task detail page with mutations, invalidation, and manual `setData` updates
- Hover prefetch for the detail page

## Run it

```bash
vp dev
```

## Validate it

```bash
vp check
vp build
```
