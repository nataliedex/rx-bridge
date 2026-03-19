"use client";

import { useRouter } from "next/navigation";

export function ClickableRow({ href, className, children }: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      onClick={() => router.push(href)}
      className={`cursor-pointer ${className || ""}`}
    >
      {children}
    </tr>
  );
}
