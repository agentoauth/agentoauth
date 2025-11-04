import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentOAuth Invoice Payer Demo',
  description: 'Watch an AI agent autonomously pay invoices with verifiable policy enforcement',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-gradient-to-br from-primary-800 to-primary-500 min-h-screen">
        {children}
      </body>
    </html>
  );
}

