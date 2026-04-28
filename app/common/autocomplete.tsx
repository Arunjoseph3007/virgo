import { useEffect, useRef, useState, type ReactNode } from "react";
import { TextInput } from "./input";
import { useQuery } from "@tanstack/react-query";
import useDebounce from "~/hooks/useDebounce";

type TTextInputProps<T> = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "onSelect"
> & {
  label?: string;
  getSuggestions: (val: string) => Promise<T[]>;
  renderSuggestion: (p: { val: T; active: boolean }) => ReactNode;
  onSelect: (val: T) => void;
  getKey?: (val: T) => string | number;
};

export function AutoComplete<T>({
  className,
  label,
  getSuggestions,
  renderSuggestion,
  onSelect,
  getKey,
  ...props
}: TTextInputProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState("");
  const debVal = useDebounce(val);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggsQuery = useQuery({
    queryKey: ["suggs-query", label, debVal],
    queryFn: () => getSuggestions(val),
    enabled: isOpen,
    initialData: [],
  });

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleSelect(item: T) {
    onSelect(item);
    setIsOpen(false);
    setVal("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggsQuery.data.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggsQuery.data[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showDropdown =
    isOpen && (suggsQuery.isLoading || suggsQuery.data.length > 0);

  return (
    <div className="relative space-y-1" ref={containerRef}>
      <TextInput
        label={label}
        value={val}
        setValue={setVal}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
        {...props}
      />
      {showDropdown && (
        <div className="absolute right-0 left-0 top-full z-10 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          {suggsQuery.isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-400">Loading…</div>
          ) : (
            suggsQuery.data.map((s, i) => (
              <div
                key={getKey ? getKey(s) : i}
                // onMouseDown prevents the input blur from firing before onClick
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {renderSuggestion({ val: s, active: i === activeIndex })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
