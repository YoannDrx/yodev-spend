import { createHash } from "node:crypto";
import { confidenceFor, confidenceLevel, EVIDENCE_WEIGHTS } from "./confidence";
import { evidenceTypeForField, fingerprints, type FingerprintField } from "./fingerprints/registry";
import { extractEnvironmentVariableNames, sanitizeMetadata } from "./sanitizer";
import type { DetectionEvidence, ProviderDetection, RepositoryScanner, RepositorySnapshot, ScanMode, SnapshotFile } from "./types";

const ENV_FILE = /(^|\/)\.env\.(example|sample|template)$/i;
const PACKAGE_FILE = /(^|\/)package\.json$/i;
const WORKFLOW_FILE = /(^|\/)\.github\/workflows\/.*\.ya?ml$/i;
const IAC_FILE = /\.tf$|Pulumi\.ya?ml$|serverless\.ya?ml$/i;
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

function packageNames(file: SnapshotFile) {
  if (!PACKAGE_FILE.test(file.path)) return [];
  try {
    const parsed = JSON.parse(file.content) as { dependencies?: Record<string,string>; devDependencies?: Record<string,string>; optionalDependencies?: Record<string,string> };
    return Object.keys({ ...parsed.dependencies, ...parsed.devDependencies, ...parsed.optionalDependencies });
  } catch { return []; }
}

function matches(file: SnapshotFile, field: FingerprintField, patterns: string[]) {
  if (field === "packages") return packageNames(file).filter((name) => patterns.includes(name));
  if (field === "envVariables") return ENV_FILE.test(file.path) ? extractEnvironmentVariableNames(file.content).filter((name) => patterns.includes(name)) : [];
  if (field === "configFiles") return patterns.filter((pattern) => file.path === pattern || file.path.endsWith(`/${pattern}`));
  if (field === "workflowPatterns" && !WORKFLOW_FILE.test(file.path)) return [];
  if (field === "iacPatterns" && !IAC_FILE.test(file.path)) return [];
  if (field === "importPatterns" && !SOURCE_FILE.test(file.path)) return [];
  return patterns.filter((pattern) => file.content.includes(pattern));
}

export class DeterministicRepositoryScanner implements RepositoryScanner {
  async scan(snapshot: RepositorySnapshot, mode: ScanMode) {
    const byProvider = new Map<string, DetectionEvidence[]>();
    for (const file of snapshot.files) {
      for (const fingerprint of fingerprints) {
        for (const field of Object.keys(evidenceTypeForField) as FingerprintField[]) {
          const patterns = fingerprint[field];
          if (!patterns?.length) continue;
          for (const key of matches(file, field, patterns)) {
            const type = evidenceTypeForField[field];
            const evidence: DetectionEvidence = { providerSlug: fingerprint.providerSlug, type, key, filePath: file.path, weight: EVIDENCE_WEIGHTS[type], metadata: sanitizeMetadata({ scanMode: mode }) };
            const current = byProvider.get(fingerprint.providerSlug) ?? [];
            if (!current.some((item) => item.type === type && item.key === key && item.filePath === file.path)) current.push(evidence);
            byProvider.set(fingerprint.providerSlug, current);
          }
        }
      }
    }
    const detections: ProviderDetection[] = [...byProvider].map(([providerSlug, evidence]) => { const confidence = confidenceFor(evidence); return { providerSlug, confidence, level: confidenceLevel(confidence), evidence }; }).sort((a,b) => b.confidence-a.confidence);
    return { detections, filesInspected: snapshot.files.length, bytesInspected: snapshot.files.reduce((sum,file) => sum + file.size, 0), partial: snapshot.partial, warnings: snapshot.warnings };
  }
}

export function evidenceSignature(evidence: DetectionEvidence[]) {
  return createHash("sha256").update(evidence.map((item) => `${item.providerSlug}:${item.type}:${item.key}:${item.filePath}`).sort().join("|")).digest("hex");
}

export * from "./types";
export * from "./sanitizer";
export * from "./confidence";
