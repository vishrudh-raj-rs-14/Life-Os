"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-strong)]",
        secondary:
          "bg-[var(--surface)] text-[var(--ink-1)] border border-[var(--border)] hover:bg-[var(--surface-2)]",
        ghost:
          "text-[var(--ink-2)] hover:bg-[var(--surface)] hover:text-[var(--ink-1)]",
        danger:
          "bg-[var(--danger)] text-[var(--ink-1)] hover:opacity-90",
        success:
          "bg-[var(--success)] text-[var(--bg)] hover:opacity-90",
        outline:
          "bg-transparent border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-10 px-3.5 text-sm",
        lg: "h-12 px-5 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, loading, disabled, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(button({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>{children}</span>
          </>
        ) : children}
      </button>
    );
  }
);
