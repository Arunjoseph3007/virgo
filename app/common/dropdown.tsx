import { useEffect, useRef, useState, type ReactNode } from "react";

type TDropDownActions = {
  render: (p: {
    active: boolean;
    disabled: boolean;
    close: () => void;
  }) => ReactNode;
  onClick: (p: { close: () => void }) => void;
  disabled?: boolean;
};

type TDropdownProps = {
  title: ReactNode;
  actions: TDropDownActions[];
};

export function Dropdown({ title, actions }: TDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(act: TDropDownActions) {
    act.onClick({ close });
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, actions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      if (!actions[activeIndex].disabled) {
        handleSelect(actions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      close();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onKeyDown={handleKeyDown}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[10rem] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          {actions.map((action, i) => {
            const active = activeIndex == i;
            const disabled = action.disabled === true;

            return (
              <div
                key={i}
                className={`border-2 rounded ${active ? "border-gray-500" : "border-gray-800"} ${disabled ? "opacity-25" : ""}`}
                onClick={() => handleSelect(action)}
              >
                {action.render({ active, close, disabled })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
