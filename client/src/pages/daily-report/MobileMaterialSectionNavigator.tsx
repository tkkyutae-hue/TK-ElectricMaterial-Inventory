import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ListTree, X } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { FT } from "./fieldTicketTheme";

export interface MaterialSectionNavigationItem {
  id: string;
  name: string;
  itemCount: number;
}

export function MobileMaterialSectionNavigator({
  sections,
  activeSectionId,
  onSelect,
}: {
  sections: MaterialSectionNavigationItem[];
  activeSectionId: string | null;
  onSelect: (sectionId: string) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const navigatorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const frameId = window.requestAnimationFrame(() => {
      const activeIndex = sections.findIndex((section) => section.id === activeSectionId);
      menuItemRefs.current[activeIndex >= 0 ? activeIndex : 0]?.focus();
    });
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (navigatorRef.current?.contains(event.target as Node)) return;
      closeMenu(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeSectionId, closeMenu, open, sections]);

  if (sections.length < 2) return null;

  return (
    <div
      ref={navigatorRef}
      className="sm:hidden"
      data-testid="mobile-material-section-navigator"
      style={{
        position: "fixed",
        right: 12,
        bottom: "max(16px, env(safe-area-inset-bottom))",
        zIndex: 45,
      }}
    >
      {open && (
        <div
          id="mobile-material-section-menu"
          role="menu"
          aria-label={t.newReportMaterialSectionList}
          data-testid="mobile-material-section-menu"
          onKeyDown={(event) => {
            const activeIndex = menuItemRefs.current.findIndex((item) => item === document.activeElement);
            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
              return;
            }
            if (event.key === "Tab") {
              closeMenu(false);
              return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const currentIndex = activeIndex >= 0 ? activeIndex : 0;
            const nextIndex = event.key === "Home" ? 0
              : event.key === "End" ? sections.length - 1
              : event.key === "ArrowDown" ? (currentIndex + 1) % sections.length
              : (currentIndex - 1 + sections.length) % sections.length;
            menuItemRefs.current[nextIndex]?.focus();
          }}
          style={{
            position: "absolute",
            right: 0,
            bottom: 52,
            width: "min(304px, calc(100vw - 24px))",
            maxHeight: "min(50dvh, 360px)",
            overflowY: "auto",
            padding: 6,
            border: `1px solid ${FT.RULE}`,
            borderRadius: 12,
            background: FT.PAPER,
            boxShadow: "0 12px 30px rgba(28, 28, 30, 0.24)",
          }}
        >
          <div
            style={{
              padding: "7px 8px 8px",
              color: FT.TEXT_MUTED,
              fontFamily: FT.FONT,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {t.newReportMaterialSectionList}
          </div>
          {sections.map((section, index) => {
            const isActive = activeSectionId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                role="menuitem"
                ref={(element) => { menuItemRefs.current[index] = element; }}
                data-testid={`mobile-material-section-option-${section.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  closeMenu();
                  onSelect(section.id);
                }}
                style={{
                  width: "100%",
                  minHeight: 42,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 9px",
                  border: "none",
                  borderRadius: 8,
                  background: isActive ? FT.PAPER_MUTED : "transparent",
                  color: FT.INK,
                  cursor: "pointer",
                  fontFamily: FT.FONT,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 18,
                    color: isActive ? FT.ACCENT : "transparent",
                    display: "inline-flex",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  aria-label={isActive ? t.newReportMaterialSectionCurrent : undefined}
                >
                  <Check style={{ width: 15, height: 15 }} />
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    fontWeight: isActive ? 800 : 700,
                  }}
                >
                  {section.name}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    padding: "2px 6px",
                    borderRadius: 10,
                    background: isActive ? FT.ACCENT : "rgba(28,28,30,0.08)",
                    color: isActive ? "#fff" : FT.TEXT_MUTED,
                    fontSize: 10,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t.newReportMaterialSectionItems.replace("{n}", String(section.itemCount))}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        data-testid="btn-mobile-material-section-navigator"
        aria-label={t.newReportMaterialSectionJump}
        aria-expanded={open}
        aria-controls="mobile-material-section-menu"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: 44,
          height: 44,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${FT.INK}`,
          borderRadius: "50%",
          background: open ? FT.ACCENT : FT.INK,
          color: "#fff",
          cursor: "pointer",
          boxShadow: "0 5px 14px rgba(28, 28, 30, 0.28)",
        }}
      >
        {open ? <X style={{ width: 19, height: 19 }} /> : <ListTree style={{ width: 20, height: 20 }} />}
      </button>
    </div>
  );
}