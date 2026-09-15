export function assertWorkspaceAccess(authorisedWorkspaceId:string,requestedWorkspaceId:string){if(authorisedWorkspaceId!==requestedWorkspaceId)throw new Error("Workspace access denied.");}
export function assertWorkspaceRole(role:string,allowedRoles:string[]){if(!role.split(",").some((value)=>allowedRoles.includes(value.trim())))throw new Error("Workspace role denied.");}
