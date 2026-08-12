# Scanner

## Pipeline

1. Resolve default branch SHA and skip unchanged repositories unless forced.
2. Load a recursive Git tree without cloning.
3. Select high-signal files within mode-specific limits.
4. Decode selected text in memory.
5. For `.env.example`, `.sample` and `.template`, discard everything right of `=` immediately.
6. Match the typed fingerprint registry.
7. Calculate and persist sanitized evidence and confidence.
8. Reconcile only after a complete successful scan.

Quick scans inspect manifests, environment templates, deployment configuration, workflows and IaC. Deep scans additionally inspect JavaScript/TypeScript imports and API domains.

Limits are defined in `candidate-files.ts`: 100 files/2 MiB for quick scans and 400 files/10 MiB for deep scans, with 256 KiB per file and 20,000 tree entries. A truncated or limit-bound run is `partial`; positive evidence is useful, absence is not.

## Confidence

Package 35, import 35, environment variable 25, config 30, IaC 40, domain 25, workflow 20 and manual 100, capped at 100. Only scores of at least 60 create discoveries. A human still confirms strong findings.

## Adding a provider

1. Add global catalog metadata in `src/server/providers/catalog.ts`.
2. Add conservative signals to `src/server/scanner/fingerprints/registry.ts`.
3. Add a fixture representing real configuration without secrets.
4. Test positive signals and a plausible false-positive case.
5. Run scanner tests and regenerate seed data if the provider appears in demonstrations.

Never add a fingerprint that depends on retrieving production secret values or an LLM conclusion.
