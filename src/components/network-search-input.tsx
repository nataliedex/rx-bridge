"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function NetworkSearchInput({ value, onChange, placeholder = "Search..." }: Props) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm w-72 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      {value && (
        <button type="button" onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
          &#10005;
        </button>
      )}
    </div>
  );
}
