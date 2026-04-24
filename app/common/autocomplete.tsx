import { useEffect, useRef, useState, type ReactNode } from "react";
import { TextInput } from "./input";

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
  const [suggs, setSuggs] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced fetch — only runs while open
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);

    const timer = setTimeout(() => {
      getSuggestions(val)
        .then((results) => {
          setSuggs(results);
          setActiveIndex(-1);
        })
        .finally(() => setIsLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [val, isOpen, getSuggestions]);

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
    setSuggs([]);
    setVal("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggs.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggs[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showDropdown = isOpen && (isLoading || suggs.length > 0);

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
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-400">Loading…</div>
          ) : (
            suggs.map((s, i) => (
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
