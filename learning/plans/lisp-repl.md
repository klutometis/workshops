# Lisp REPL Integration Plan

## Background

PR #162 ("Add Lisp workspaces") by Jim White was merged into `google-gemini/workshops`
(upstream) on Dec 11 2025 but not into our fork (`klutometis/workshops`). This plan
tracks porting it cleanly into our codebase.

Uses **JSCL** (a Common Lisp → JavaScript compiler) loaded from CDN, running entirely
in-browser — no server changes needed.

## Files to add / modify

| File | Action | Notes |
|------|--------|-------|
| `app/components/LispScratchpad.tsx` | **Add** | Jim's component verbatim — self-contained |
| `types/browser-globals.d.ts` | **Add** | Adds `Window.jscl` type; also adds `loadPyodide` type we're currently missing |
| `app/layout.tsx` | **Edit** | Add JSCL CDN script tag alongside existing Pyodide tag |
| `app/components/SocraticDialogue.tsx` | **Edit** | Import `LispScratchpad`, add `workspaceType` prop, render Lisp scratchpad when type is `'lisp'` |

## SocraticDialogue integration details

Jim's upstream version adds a `workspaceType?: 'python' | 'lisp'` prop. When `'lisp'`,
the scratchpad tab shows `LispScratchpad` instead of `PythonScratchpad`. The library
type (`lib.type === 'markdown'` vs notebook) drives which scratchpad is shown — PAIP
chapters (markdown, Common Lisp content) get the Lisp REPL; Python notebooks get Python.

Key integration points in `SocraticDialogue.tsx`:
- Import `LispScratchpad` from `./LispScratchpad`
- Add `workspaceType?: 'python' | 'lisp'` to `SocraticDialogueProps`
- Pass `workspaceType` through to the scratchpad render section
- When `workspaceType === 'lisp'`, render `<LispScratchpad>` instead of `<PythonScratchpad>`
- Starter code for Lisp: `;;; Common Lisp scratchpad for exploring <concept>`

## How workspaceType gets set

In `InteractiveLibrary.tsx` (or wherever `SocraticDialogue` is instantiated), pass
`workspaceType` based on the library's source type:
- `source_type === 'markdown'` → `'lisp'` (PAIP chapters are Common Lisp)
- `source_type === 'notebook'` → `'python'` (Pytudes are Python)
- Default → `'python'`

## Steps

- [x] Write plan (`learning/plans/lisp-repl.md`)
- [x] Add `app/components/LispScratchpad.tsx`
- [x] Add `types/browser-globals.d.ts`
- [x] Edit `app/layout.tsx` — add JSCL script tag
- [x] Edit `app/components/SocraticDialogue.tsx` — wire in Lisp scratchpad
- [x] Edit `InteractiveLibrary.tsx` — pass `workspaceType` based on library type
- [x] Verify build passes (`npm run build`)
- [ ] Commit

## JSCL CDN

```
https://cdn.jsdelivr.net/npm/jscl@0.9.0/jscl.js
```

Note: Jim's PR used `0.9.0`. Our Pyodide is on `v0.29.0`. Both loaded in `<head>`.
