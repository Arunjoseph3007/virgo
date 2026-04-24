const inputClass =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500";

type TTextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  setValue?: (p:string)=>void;
};

export function TextInput({
  className,
  value,
  onChange,
  label,
  type,
  setValue,
  ...props
}: TTextInputProps) {
  return (
    <>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => {
          if (setValue) {
            setValue(e.target.value);
          } else if (onChange) {
            onChange(e);
          }
        }}
        className={inputClass + " " + className}
        {...props}
      />
    </>
  );
}
