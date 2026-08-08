# Catalog replay history contract

Candidate: `886bf000b25acb84463cf9a04f50dac08302f5cf` / tree `a5d80d21771e60bc8911e6110a97cac66066c5a7`.

The catalog entry is normalized in place with `replaceState({ entry: "catalog-root" })`; this does not increase history length. A place selection still creates exactly one `pushState({ entry: "sheet" })`. Escape closes idempotently by replacing only that sheet entry with `catalog-replay`, restoring DOM selection, scroll, and trigger focus without adding a selection history entry. The required real browser Back then traverses to the existing `catalog-root` entry.

Vinext always starts RSC traversal for any `popstate`, including same-document catalog-to-catalog replay. That traversal is redundant because the catalog client tree is already restored and, in this local runtime, it aborts `/.rsc?...` after the server returns 200. Close therefore arms a one-shot guard around Vinext's existing navigation function. The guard restores the original function on its next invocation and resolves without a fetch only when the reached history state is `catalog-root`; every non-sentinel navigation delegates unchanged. No request filtering or acceptance weakening is used.
