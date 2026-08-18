import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

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
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div className="flex flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 lg:pl-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
