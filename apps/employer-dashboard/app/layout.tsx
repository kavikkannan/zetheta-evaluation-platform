import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Employer Dashboard",
  description: "Real-time candidate funnel and score visibility.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
