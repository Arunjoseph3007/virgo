import { useEffect, type ReactNode } from "react";

type DialogAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  actions?: DialogAction[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const actionVariants: Record<NonNullable<DialogAction["variant"]>, string> = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    secondary: "bg-gray-700 hover:bg-gray-600 text-gray-100",
    danger: "bg-red-700 hover:bg-red-600 text-white",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col">
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <span className="text-base font-semibold text-gray-100">
              {title}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        {children && (
          <div className="px-5 py-4 text-sm text-gray-300">{children}</div>
        )}

        {/* Footer */}
        {actions && actions.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  actionVariants[action.variant ?? "secondary"]
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
