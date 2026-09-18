import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taskline — Your tasks, in order",
  description: "Organize classes and everyday tasks with due dates, priorities, and recurring schedules.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
