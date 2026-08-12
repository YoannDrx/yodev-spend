export type ScanMode = "quick" | "deep";
export type EvidenceType = "package" | "env_variable" | "import" | "config_file" | "domain" | "workflow" | "iac" | "manual";

export type RepositoryRef = { owner: string; name: string; defaultBranch: string };
export type ExternalRepository = RepositoryRef & { externalId: number; fullName: string; htmlUrl: string; isPrivate: boolean };
export type SnapshotFile = { path: string; content: string; size: number };
export type RepositorySnapshot = { repository: RepositoryRef; commitSha: string; files: SnapshotFile[]; partial: boolean; warnings: string[] };
export type DetectionEvidence = { providerSlug: string; type: EvidenceType; key: string; filePath: string; weight: number; metadata: Record<string, string | number | boolean | null> };
export type ProviderDetection = { providerSlug: string; confidence: number; level: "weak" | "possible" | "likely" | "strong"; evidence: DetectionEvidence[] };
export type ScanResult = { detections: ProviderDetection[]; filesInspected: number; bytesInspected: number; partial: boolean; warnings: string[] };

export interface RepositorySourceAdapter {
  listRepositories(installationId: string): Promise<ExternalRepository[]>;
  getDefaultBranchSha(repository: RepositoryRef): Promise<string>;
  loadSnapshot(repository: RepositoryRef, mode: ScanMode): Promise<RepositorySnapshot>;
}

export interface RepositoryScanner { scan(snapshot: RepositorySnapshot, mode: ScanMode): Promise<ScanResult>; }
