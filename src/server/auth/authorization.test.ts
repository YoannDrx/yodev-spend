import { describe,expect,it } from "vitest";
import { assertWorkspaceAccess,assertWorkspaceRole } from "./authorization";

describe("tenant authorization",()=>{it("rejects cross-workspace identifiers",()=>{expect(()=>assertWorkspaceAccess("workspace-a","workspace-b")).toThrow("Workspace access denied");expect(()=>assertWorkspaceAccess("workspace-a","workspace-a")).not.toThrow();});it("enforces explicit roles",()=>{expect(()=>assertWorkspaceRole("member",["owner","admin"])).toThrow("Workspace role denied");expect(()=>assertWorkspaceRole("owner",["owner","admin"])).not.toThrow();});});
