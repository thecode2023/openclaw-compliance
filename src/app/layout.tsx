import type { Metadata } from "next";
import { JetBrains_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/components/providers/AuthProvider";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Complyze — AI Regulatory Intelligence Platform",
  description:
    "Track 42+ AI regulations across 24 jurisdictions. Audit your AI agent configurations against live regulatory data with zero hallucinated citations.",
  openGraph: {
    title: "Complyze — AI Regulatory Intelligence Platform",
    description:
      "Track 42+ AI regulations across 24 jurisdictions. Audit your AI agent configurations against live regulatory data with zero hallucinated citations.",
    url: "https://complyze.dev",
    siteName: "Complyze",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Complyze — AI Regulatory Intelligence Platform",
    description:
      "Track 42+ AI regulations across 24 jurisdictions. Audit your AI agent configurations against live regulatory data with zero hallucinated citations.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--border-dim)] py-4 px-4 text-center">
            <p className="text-[10px] text-[var(--text-tertiary)] max-w-3xl mx-auto leading-relaxed">
              Complyze provides regulatory intelligence for informational purposes only. This is not legal advice. Consult qualified counsel for compliance decisions.
            </p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
