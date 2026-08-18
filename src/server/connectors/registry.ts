import "server-only";

import type { SpendConnector } from "./types";
import { VercelConnector } from "./vercel/connector";
import { OpenAIConnector } from "./openai/connector";
import { GitHubBillingConnector } from "./github/connector";
import { AwsCostExplorerConnector } from "./aws/connector";

const connectors = new Map<string, SpendConnector>([
  ["vercel", new VercelConnector()],
  ["openai", new OpenAIConnector()],
  ["github", new GitHubBillingConnector()],
  ["aws", new AwsCostExplorerConnector()],
]);

export function getConnector(providerSlug: string) {
  const connector = connectors.get(providerSlug);
  if (!connector) throw new Error(`No connector is implemented for provider: ${providerSlug}`);
  return connector;
}

export function listImplementedConnectors() {
  return [...connectors.values()].map((connector) => ({
    ...connector.manifest,
    storageCapabilities: connector.capabilities,
  }));
}
