import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PharmacyRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/partnerships/pharmacies/${id}`);
}
