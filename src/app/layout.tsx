import type { Metadata } from "next";
import { DM_Sans, Fira_Code } from "next/font/google";
import { Providers } from "@/components/providers";
import { getLocale } from "next-intl/server";
import "./globals.css";

const body = DM_Sans({ subsets: ["latin"], variable: "--font-yodev-body" });
const mono = Fira_Code({ subsets: ["latin"], variable: "--font-yodev-mono" });

export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"), title: { default: "Yodev Spend", template: "%s · Yodev Spend" }, description: "Know your stack. Know your spend." };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale} data-product="spend" suppressHydrationWarning className={`${body.variable} ${mono.variable}`}><body><Providers>{children}</Providers></body></html>;
}
