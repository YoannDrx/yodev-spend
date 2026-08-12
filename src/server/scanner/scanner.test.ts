import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { DeterministicRepositoryScanner } from "./index";

async function fixture(name:string,paths:string[]){return {repository:{owner:"fixture",name,defaultBranch:"main"},commitSha:"abc",partial:false,warnings:[],files:await Promise.all(paths.map(async(path)=>{const content=await readFile(join(process.cwd(),"fixtures/repos",name,path),"utf8");return {path,content,size:Buffer.byteLength(content)}}))};}

describe("deterministic scanner",()=>{it("finds Resend from three explainable signals without retaining values",async()=>{const snapshot=await fixture("resend-nextjs",["package.json",".env.example","src/email.ts"]);const result=await new DeterministicRepositoryScanner().scan(snapshot,"deep");const resend=result.detections.find((item)=>item.providerSlug==="resend");expect(resend?.confidence).toBe(95);expect(resend?.evidence.map((item)=>item.type).sort()).toEqual(["env_variable","import","package"]);expect(JSON.stringify(result)).not.toContain("re_do_not_store");});it("does not invent providers",async()=>{const result=await new DeterministicRepositoryScanner().scan(await fixture("no-services",["package.json"]),"quick");expect(result.detections).toEqual([]);});});
