import { useEffect, useRef, useState, type ReactNode } from "react";

const inputClass =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500";

type TTextInputProps<T> = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  label?: string;
  getSuggestions: (val: string) => Promise<T[]>;
  renderSuggestions: (p: { val: T }) => ReactNode;
};

export function AutoComplete<T>({
  className,
  label,
  getSuggestions,
  renderSuggestions,
  ...props
}: TTextInputProps<T>) {
  const ref = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState("");

  const [suggs, setSuggs] = useState<T[]>([]);

  useEffect(() => {
    getSuggestions(val).then(setSuggs);
  }, [val]);

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className={inputClass + className}
        ref={ref}
        {...props}
      />

      {ref.current && document.activeElement == ref.current && (
        <div className="absolute  right-0 left-0 top-full">
          {suggs.map((s) => renderSuggestions({ val: s }))}
        </div>
      )}
    </div>
  );
}
