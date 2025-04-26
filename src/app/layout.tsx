import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Binance Volume Tracker",
  description: "Theo dõi volume giao dịch trên sàn Binance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        {children}
      </body>
    </html>
  );
}
