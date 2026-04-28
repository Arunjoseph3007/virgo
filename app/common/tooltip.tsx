import type { ReactNode } from "react";

type TToolTipVariant =
  | "neutral"
  | "accent"
  | "danger"
  | "success"
  | "info"
  | "warn";

type TToolTipPosition = "top" | "bottom" | "left" | "right";

type TToolTipProps = {
  children: ReactNode;
  title: ReactNode;
  className?: string;
  variant?: TToolTipVariant;
  position?: TToolTipPosition;
  tail?: boolean;
};

const ToolTipVariantStyles: Record<TToolTipVariant, string> = {
  accent: "bg-orange-500 before:bg-orange-500",
  neutral: "bg-black before:bg-black",
  danger: "bg-red-500 before:bg-red-500",
  success: "bg-green-500 before:bg-green-500",
  info: "bg-blue-500 before:bg-blue-500",
  warn: "bg-yellow-500 before:bg-yellow-500",
};

const ToolTipPositionStyles: Record<TToolTipPosition, string> = {
  bottom:
    "top-[calc(100%+8px)] left-[50%] translate-x-[-50%] before:bottom-[100%] before:left-[50%] before:translate-y-[70%] before:translate-x-[-50%]",
  top: "bottom-[calc(100%+8px)] left-[50%] translate-x-[-50%] before:top-[100%] before:left-[50%] before:translate-y-[-70%] before:translate-x-[-50%]",
  left: "right-[calc(100%+8px)] top-[50%] translate-y-[-50%] before:left-[100%] before:top-[50%] before:translate-x-[-70%] before:translate-y-[-50%]",
  right:
    "left-[calc(100%+8px)] top-[50%] translate-y-[-50%] before:right-[100%] before:top-[50%] before:translate-x-[70%] before:translate-y-[-50%]",
};

export default function ToolTip({
  children,
  title,
  className = "",
  variant = "neutral",
  position = "bottom",
  tail = true,
}: TToolTipProps) {
  return (
    <div className="inline relative group">
      {children}
      <div
        className={[
          "absolute px-2 py-1 rounded z-20 opacity-0 pointer-events-none group-hover:opacity-100 transition",
          "before:absolute before:size-[15px] before:-z-10 before:rotate-45",
          className,
          ToolTipVariantStyles[variant],
          ToolTipPositionStyles[position],
          tail ? "" : "before:content-none",
        ].join(" ")}
      >
        {title}
      </div>
    </div>
  );
}
