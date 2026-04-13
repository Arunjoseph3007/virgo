import { useState, type ReactNode } from "react";

export function Dropdown({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="border rounded-lg px-4 py-2 flex items-center cursor-pointer hover:bg-gray-900 tr"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <svg
          className="w-4 h-4 ms-1.5 -me-0.5"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m19 9-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-[120%] bg-gray-900 rounded-lg border border-gray-700 flex flex-col divide-y-2 divide-gray-700 px-2 py-1 mb-3">
          {children}
        </div>
      )}
    </div>
  );
}
