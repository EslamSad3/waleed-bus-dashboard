import type { Metadata } from "next";
import { Cairo, Poppins } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-cairo",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "منصة العربيات | لوحة تحكم المشرف",
  description: "لوحة تحكم المشرف العام لمنصة العربيات",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} ${poppins.variable} antialiased`} style={{ fontFamily: "var(--font-cairo), var(--font-poppins), sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
