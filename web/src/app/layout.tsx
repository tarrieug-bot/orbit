import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "@fontsource-variable/inter";
import "./globals.css";
import { ThemeScript } from "@/components/ui/theme-script";

export const metadata: Metadata = {
  title: { default: "Orbit", template: "%s · Orbit" },
  description: "Statistiques Facebook & Instagram des marques de l'agence.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
