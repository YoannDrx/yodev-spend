import { Plus } from "lucide-react";
import { createProject } from "@/server/actions/portfolio";

export function ProjectForm({locale,clients,labels}:{locale:string;clients:Array<{id:string;name:string}>;labels:{name:string;client:string;submit:string}}){if(!clients.length)return null;return <form action={createProject} className="form-card"><input type="hidden" name="locale" value={locale}/><div className="field"><label>{labels.name}</label><input name="name" required minLength={2}/></div><div className="field"><label>{labels.client}</label><select name="clientId">{clients.map((client)=><option key={client.id} value={client.id}>{client.name}</option>)}</select></div><button className="button button-primary" type="submit"><Plus size={14}/>{labels.submit}</button></form>}
