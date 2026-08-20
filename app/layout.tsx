import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Footer } from "@/components/footer";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "avixiatools — free browser tools",
    template: "%s — avixiatools",
  },
  description:
    "A collection of small, free tools that run entirely in your browser. No logins, no tracking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <div className="flex flex-1">
            <Sidebar />
            <main id="main" className="min-w-0 flex-1 lg:pl-0">
              {children}
            </main>
          </div>
          <Footer />
        </ThemeProvider>
        <CommandPalette />
      </body>
    </html>
  );
}