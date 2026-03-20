"use client";

import { useRouter } from "next/navigation";

export function ClickableRow({ href, className, children, as: Tag = "tr" }: {
  href: string;
  className?: string;
  children: React.ReactNode;
  as?: "tr" | "div";
}) {
  const router = useRouter();

  return (
    <Tag
      onClick={() => router.push(href)}
      className={`cursor-pointer ${className || ""}`}
    >
      {children}
    </Tag>
  );
}
