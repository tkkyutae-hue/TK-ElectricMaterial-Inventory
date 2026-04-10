/**
 * SectionCard
 * A professional card container for grouping related content in a section.
 * Works in both Admin (light) and Field (dark) modes via className prop.
 */

import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  action?: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  children,
  className,
  headerClassName,
  bodyClassName,
  action,
}: SectionCardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || action) && (
        <div className={cn("flex items-center justify-between px-5 py-4 border-b border-slate-100", headerClassName)}>
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-800 leading-tight">{title}</h3>}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          {action && <div className="shrink-0 ml-4">{action}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
