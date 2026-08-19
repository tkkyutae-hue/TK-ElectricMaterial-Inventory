import tkLogo from "@assets/tk_logo_1772726610288.png";

interface TkElectricBrandProps {
  compact?: boolean;
  className?: string;
  textClassName?: string;
  detailClassName?: string;
  textColor?: string;
  detail?: React.ReactNode;
}

export function TkElectricBrand({
  compact = false,
  className = "",
  textClassName = "",
  detailClassName = "",
  textColor = "#0f1f17",
  detail,
}: TkElectricBrandProps) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <img
        src={tkLogo}
        alt="TK Electric"
        className="w-auto object-contain flex-shrink-0"
        style={{
          height: compact ? 32 : 38,
        }}
      />
      <div className="flex-1 min-w-0 leading-none">
        <p
          className={`m-0 whitespace-nowrap ${textClassName}`}
          style={{
            color: textColor,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: compact ? 13 : 14,
            letterSpacing: 1.4,
          }}
        >
          TK ELECTRIC
        </p>
        {detail && <div className={detailClassName}>{detail}</div>}
      </div>
    </div>
  );
}