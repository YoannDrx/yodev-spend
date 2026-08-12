"use client";

import { GitBranch } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignInButton({label,locale}:{label:string;locale:string}) { return <button className="button button-primary" type="button" onClick={() => authClient.signIn.social({provider:"github",callbackURL:`/${locale}/dashboard`})}><GitBranch size={16}/>{label}</button>; }
