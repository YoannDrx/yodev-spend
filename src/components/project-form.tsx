import { ActionForm } from "@/components/action-form";
import { Plus } from "lucide-react";
import { createProject } from "@/server/actions/portfolio";

export function ProjectForm({locale,clients,labels}:{locale:string;clients:Array<{id:string;name:string}>;labels:{name:string;client:string;submit:string}}){if(!clients.length)return null;return <ActionForm action={createProject} className="form-card"><input type="hidden" name="locale" value={locale}/><div className="field"><label htmlFor="project-name">{labels.name}</label><input id="project-name" name="name" required minLength={2} maxLength={140}/></div><div className="field"><label htmlFor="project-client">{labels.client}</label><select id="project-client" name="clientId">{clients.map((client)=><option key={client.id} value={client.id}>{client.name}</option>)}</select></div><button className="button button-primary" type="submit"><Plus size={14}/>{labels.submit}</button></ActionForm>}
