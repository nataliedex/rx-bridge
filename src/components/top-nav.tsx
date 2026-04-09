"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/ledger", label: "Ledger", match: "/ledger" },
  { href: "/med-spas", label: "Med Spas", match: "/med-spas" },
  { href: "/treatments", label: "Pricing", match: "/treatments" },
  { href: "/partnerships/pharmacies", label: "Pharmacies", match: "/partnerships/pharmacies" },
];

export function TopNav() {
  const pathname = usePathname();

  function isActive(match: string): boolean {
    return pathname === match || pathname.startsWith(match + "/");
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {navItems.map((item) => {
        const active = isActive(item.match);
        return (
          <Link key={item.href} href={item.href}
            className={`px-3 py-1 rounded-md transition-colors ${
              active
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}>
            {item.label}
          </Link>
        );
      })}

      <div className="ml-3">
        <Link href="/settings"
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
            pathname.startsWith("/settings")
              ? "text-gray-700 bg-gray-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
          title="Settings">
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
