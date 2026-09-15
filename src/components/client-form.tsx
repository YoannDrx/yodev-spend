import { ActionForm } from "@/components/action-form";
import { Plus } from "lucide-react";
import { createClient } from "@/server/actions/portfolio";

export function ClientForm({locale,labels}:{locale:string;labels:{name:string;description:string;submit:string}}){return <ActionForm action={createClient} className="form-card"><input type="hidden" name="locale" value={locale}/><div className="field"><label htmlFor="client-name">{labels.name}</label><input id="client-name" name="name" required minLength={2} maxLength={140}/></div><div className="field"><label htmlFor="client-description">{labels.description}</label><input id="client-description" maxLength={2000} name="description"/></div><button className="button button-primary" type="submit"><Plus size={14}/>{labels.submit}</button></ActionForm>}
