import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rentswitch",
  description:
    "Shows renters the cheapest bill and emissions cuts they can make without touching the building - and writes the landlord business case for the ones they can't.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        {children}
      </body>
    </html>
  );
}
