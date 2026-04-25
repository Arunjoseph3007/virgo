import type { ReactNode } from "react";

type TToolTipVariant =
  | "neutral"
  | "accent"
  | "danger"
  | "success"
  | "info"
  | "warn";

type TToolTipProps = {
  children: ReactNode;
  title: ReactNode;
  className?: string;
  variant?: TToolTipVariant;
};

const ToolTipVariantStypes: Record<TToolTipVariant, string> = {
  accent: "bg-orange-500 before:bg-orange-500",
  neutral: "bg-black before:bg-black",
  danger: "bg-red-500 before:bg-red-500",
  success: "bg-green-500 before:bg-green-500",
  info: "bg-blue-500 before:bg-blue-500",
  warn: "bg-yellow-500 before:bg-yellow-500",
};

export default function ToolTip({
  children,
  title,
  className = "",
  variant = "neutral",
}: TToolTipProps) {
  return (
    <div className="relative group">
      {children}
      <div
        className={[
          "before:absolute before:size-[15px] before:bottom-[60%] before:-z-10 before:rotate-45 before:left-[50%] before:translate-x-[-50%]",
          "absolute px-2 py-1 rounded top-[calc(100%+8px)] z-20 opacity-0 pointer-events-none group-hover:opacity-100 transition",
          className,
          ToolTipVariantStypes[variant],
        ].join(" ")}
      >
        {title}
      </div>
    </div>
  );
}
