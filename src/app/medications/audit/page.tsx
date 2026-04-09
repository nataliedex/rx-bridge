import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function PricingAuditRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  redirect(`/treatments${qs ? `?${qs}` : ""}`);
}
