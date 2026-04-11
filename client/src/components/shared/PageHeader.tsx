/**
 * PageHeader
 * Consistent page-level heading with optional subtitle and action slot.
 *
 * size="default"  — compact heading (text-xl) for sub-pages and drawer headers
 * size="lg"       — primary page heading (text-3xl font-display) for top-level admin pages
 */

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  size?: "default" | "lg";
}

export function PageHeader({ title, subtitle, children, className, size = "default" }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div>
        <h1
          className={
            size === "lg"
              ? "text-3xl font-display font-bold text-slate-900"
              : "text-xl font-bold text-slate-900 leading-tight"
          }
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-500 mt-1 text-sm">{subtitle}</p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
