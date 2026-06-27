# Loopy Design Audit

This doctor-verified audit records Loopy's own design decisions. It exists to keep compatibility behavior explicit without making external lineage part of the product contract.

## Design Decisions

| Decision | Reason | Effect | Guard |
| --- | --- | --- | --- |
| `gate-shape-compatibility` | Existing users may have strict review or matrix gate JSON. | Loopy keeps both shapes accepted through local validators. | `test/golden-review-gate.test.js`, `test/golden-matrix-gate.test.js`, and `src/artifacts.js`. |
| `actor-field-policy` | Exact external role literals made compatibility look branded. | Actor fields now require non-empty identity text instead of a hard-coded role name. | `src/review-gate.js` and review-gate golden tests. |
| `native-naming` | Public code, docs, and tests should describe Loopy behavior directly. | Modules, tests, docs, CLI flags, and metadata use Loopy-native terms. | Native vocabulary doctor check and docs tests. |
| `install-reference` | The README should name the GitHub marketplace bootstrap pattern it intentionally follows. | One README line may cite the external GitHub install reference; runtime code and command names stay Loopy-native. | Native vocabulary doctor allow-list and `test/docs.test.js`. |
| `recorded-thresholds` | Later analysis should compare against earlier judgments. | `docs/loopy-loop-golden-set.md` stores score history and command evidence in one tracked place. | `docs/loopy-loop-golden-set.md` and `test/docs.test.js`. |

## Compatibility Boundary

Loopy supports strict gate shapes as data contracts, not as branded implementation lineage. The accepted shapes are:

- Review gate: reviewer, manual QA, gate review, iteration, and criteria coverage.
- Matrix gate: architecture review, executor QA, and iteration.
- Default gate: status plus artifact list.

All paths resolve through Loopy evidence confinement.

## Native Vocabulary

Native terms:

- review gate
- matrix gate
- comparison scan
- design audit
- gate notes
- Loopy evidence

Terms tied to source branding are not allowed in Git-visible files. The doctor native vocabulary scan verifies this directly.

Exception: `README.md` may cite the GitHub marketplace install-pattern reference used to sync Loopy's bootstrap behavior. That exception is exact and does not allow runtime modules, tests, hooks, or skills to adopt external product names.

## Decision Log

- Turn 0: baseline audit found source-branded names across runtime, docs, skill metadata, and tests.
- Turn 1: runtime modules, CLI flags, docs, tests, and audit policy were renamed to Loopy-native terms while preserving strict gate behavior.
- Final completion requires a fresh audit plus `node src/cli.js doctor --json` and `npm test`.
