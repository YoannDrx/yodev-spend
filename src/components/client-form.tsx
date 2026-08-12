import { Plus } from "lucide-react";
import { createClient } from "@/server/actions/portfolio";

export function ClientForm({locale,labels}:{locale:string;labels:{name:string;description:string;submit:string}}){return <form action={createClient} className="form-card"><input type="hidden" name="locale" value={locale}/><div className="field"><label>{labels.name}</label><input name="name" required minLength={2}/></div><div className="field"><label>{labels.description}</label><input name="description"/></div><button className="button button-primary" type="submit"><Plus size={14}/>{labels.submit}</button></form>}
