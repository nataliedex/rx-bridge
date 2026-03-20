import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rx-Bridge",
  description: "Prescription order bridge for compound pharmacies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-14 items-center">
              <Link href="/orders" className="font-bold text-lg text-indigo-600">
                Rx-Bridge
              </Link>
              <div className="flex gap-6 text-sm">
                <Link href="/queue" className="text-gray-600 hover:text-gray-900">
                  Send Queue
                </Link>
                <Link href="/network" className="text-gray-600 hover:text-gray-900">
                  Network
                </Link>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900">
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
