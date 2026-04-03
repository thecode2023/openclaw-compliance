import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ChatContextProvider } from "@/components/chat/ChatContext";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Complyze — AI Regulatory Intelligence Platform",
  description:
    "Track 74+ AI regulations across 35 jurisdictions. Audit your AI agent configurations against live regulatory data with zero hallucinated citations.",
  openGraph: {
    title: "Complyze — AI Regulatory Intelligence Platform",
    description:
      "Track 74+ AI regulations across 35 jurisdictions. Audit your AI agent configurations against live regulatory data with zero hallucinated citations.",
    url: "https://complyze.dev",
    siteName: "Complyze",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Complyze — AI Regulatory Intelligence Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Complyze — AI Regulatory Intelligence Platform",
    description:
      "Track 74+ AI regulations across 35 jurisdictions. Audit your AI agent configurations against live regulatory data with zero hallucinated citations.",
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
      className={`${firaSans.variable} ${firaCode.variable} dark h-full antialiased`}
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
          <ChatContextProvider>
            <ChatWidget />
          </ChatContextProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
