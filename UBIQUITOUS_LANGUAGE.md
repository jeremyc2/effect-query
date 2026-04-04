# Ubiquitous language

Shared vocabulary. This document is **normative**: it states how we *want* to think and speak about this project—not a mirror of every identifier in the repository.

Source code, documentation, examples, and conversation should all use the terms in this document.

## Guide

| Column | Meaning |
| --- | --- |
| **Canonical** | The preferred project term. |
| **Aliases to avoid** | Terms we should steer away from in code, docs, and conversation. |
| **Origin** | **TanStack Query** or **Coined**. |
| **Prolif.** | Proliferation in *this* repository: **0**–**10**. Higher means more touchpoints; re-score when the codebase shifts. |
| **Learn** | How important the term is to learn early: **0**–**10** (**10** = unavoidable). |

## Terms

| Canonical | Aliases to avoid | Origin | Prolif. | Learn |
| --- | --- | --- | --- | --- |
| **query atom factory** | `query family`, `query hook factory`, `observer factory` | Coined | 8 | 9 |
| **query atom** | `useQuery result`, `observer result`, `query family member` | Coined | 7 | 8 |
| **mutation atom factory** | `mutation family`, `action factory`, `command factory` | Coined | 3 | 5 |
| **mutation atom** | `useMutation result`, `mutation hook`, `action hook` | Coined | 4 | 6 |
| **query runtime** | `query client`, `cache client` | Coined | 7 | 8 |
| **gc time** | `idle TTL`, `idleTimeToLive` | TanStack Query | 5 | 6 |
| **reactivity keys** | `query filters`, `cache selectors` | Coined | 9 | 9 |
| **mutation** | `write operation`, `remote write` | TanStack Query | 7 | 8 |
| **hydrate** / **dehydrate** | `rehydrate cache`, `cache snapshot API` | TanStack Query | 6 | 7 |
