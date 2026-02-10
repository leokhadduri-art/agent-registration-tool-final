import "./globals.css";

export const metadata = {
  title: "Agent Registration Tool",
  description: "State athlete agent registration form filler",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
