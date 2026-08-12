import type { DetectionEvidence, EvidenceType } from "./types";

export const EVIDENCE_WEIGHTS: Record<EvidenceType, number> = { package: 35, import: 35, env_variable: 25, config_file: 30, iac: 40, domain: 25, workflow: 20, manual: 100 };

export function confidenceFor(evidence: DetectionEvidence[]) {
  return Math.min(100, evidence.reduce((sum, item) => sum + item.weight, 0));
}

export function confidenceLevel(score: number) {
  if (score >= 85) return "strong" as const;
  if (score >= 60) return "likely" as const;
  if (score >= 30) return "possible" as const;
  return "weak" as const;
}
