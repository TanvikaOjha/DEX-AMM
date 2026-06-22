import './globals.css';

export const metadata = {
  title: "Automated Market Maker DEX",
  description: "Swap tokens against an on-chain liquidity pool. x.y=k, transparently.",
};

export default function RootLayout({children}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}