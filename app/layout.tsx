import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "VIT Bhopal Student Poll",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
