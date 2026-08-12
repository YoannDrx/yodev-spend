import { redirect } from "next/navigation";
export default async function OnboardingPage({params}:PageProps<"/[locale]/onboarding">){const {locale}=await params;redirect(`/${locale}/settings/github`)}
