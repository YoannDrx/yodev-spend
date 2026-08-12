type LogValue = string | number | boolean | null | undefined;
const forbidden=/secret|token|password|authorization|content|privateKey/i;

export function logEvent(event:string,fields:Record<string,LogValue>={}){const safe=Object.fromEntries(Object.entries(fields).filter(([key])=>!forbidden.test(key)).map(([key,value])=>[key,typeof value==="string"?value.slice(0,240):value]));console.info(JSON.stringify({timestamp:new Date().toISOString(),event,...safe}));}
