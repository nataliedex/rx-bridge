// Highlights matching portions of text. Server-safe (no "use client" needed).

export function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search || search.length < 2) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + search.length);
  const after = text.slice(idx + search.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 text-inherit rounded-sm px-0.5">{match}</mark>
      {after}
    </>
  );
}
