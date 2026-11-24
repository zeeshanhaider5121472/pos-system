import { PWARegister } from "@/components/PWARegister";
import { LanguageProvider } from "@/lib/i18n";
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Nastaliq_Urdu } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-nastaliq",
});

export const metadata: Metadata = {
  title: "Clothing POS",
  description: "Offline-first clothing shop management",
};
export const viewport: Viewport = { themeColor: "#18181b" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${nastaliq.variable} font-sans antialiased bg-background`}
      >
        <LanguageProvider>{children}</LanguageProvider>
        <Toaster richColors position="top-center" />
        <PWARegister />
      </body>
    </html>
  );
}
