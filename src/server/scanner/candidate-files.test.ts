import { describe,expect,it } from "vitest";
import { isCandidateFile,selectCandidatePaths } from "./candidate-files";

describe("candidate selection",()=>{it("separates quick from deep and ignores generated paths",()=>{expect(isCandidateFile("package.json","quick")).toBe(true);expect(isCandidateFile("src/app.ts","quick")).toBe(false);expect(isCandidateFile("src/app.ts","deep")).toBe(true);expect(isCandidateFile("node_modules/resend/index.js","deep")).toBe(false);});it("marks bounded selections partial",()=>{const files=Array.from({length:101},(_,i)=>({path:`workspace-${i}/package.json`,size:10}));const result=selectCandidatePaths(files,"quick");expect(result.selected).toHaveLength(100);expect(result.partial).toBe(true);});});
