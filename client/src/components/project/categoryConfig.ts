import {
  Pipette, Wrench, LayoutGrid, Zap, Shield, Box, ToggleLeft, Cpu,
} from "lucide-react";
import type React from "react";

export const CATEGORY_ORDER = [
  "Conduit",
  "Fittings & Connectors",
  "Cable Tray",
  "Cable / Wire",
  "Grounding",
  "Boxes",
  "Devices",
  "Equipment",
];

type SubGroupDef = { key: string; label: string };

type CategoryConfig = {
  accent: string;
  iconBg: string;
  subtitle: string;
  subGroups?: SubGroupDef[];
};

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  "Conduit": {
    accent: "#0f766e", iconBg: "#f0fdfa",
    subtitle: "EMT · Rigid · Flexible · Liquidtight",
    subGroups: [
      { key: "emt",      label: "EMT" },
      { key: "rigid",    label: "Rigid" },
      { key: "flexible", label: "Flexible / Liquidtight" },
    ],
  },
  "Fittings & Connectors": {
    accent: "#0369a1", iconBg: "#f0f9ff",
    subtitle: "Coupling · Connector · Elbow · Strap",
    subGroups: [
      { key: "emt",      label: "EMT Fittings" },
      { key: "rigid",    label: "Rigid Fittings" },
      { key: "flexible", label: "Flexible Fittings" },
    ],
  },
  "Cable Tray": {
    accent: "#b45309", iconBg: "#fffbeb",
    subtitle: "Ladder · Wire Mesh · Solid Bottom",
  },
  "Cable / Wire": {
    accent: "#7c3aed", iconBg: "#faf5ff",
    subtitle: "THHN · MC Cable · Feeder · Control",
  },
  "Grounding": {
    accent: "#16a34a", iconBg: "#f0fdf4",
    subtitle: "Ground Rod · Wire · Bushing · Lug",
  },
  "Boxes": {
    accent: "#1d6ecc", iconBg: "#dbeafe",
    subtitle: "Junction Box · Pull Box · Panel",
  },
  "Devices": {
    accent: "#ea580c", iconBg: "#fff7ed",
    subtitle: "Receptacle · Switch · Lighting",
  },
  "Equipment": {
    accent: "#7e22ce", iconBg: "#f3e8ff",
    subtitle: "Transformer · Motor · Special",
  },
};

export const CAT_ICONS: Record<string, React.ElementType> = {
  "Conduit":               Pipette,
  "Fittings & Connectors": Wrench,
  "Cable Tray":            LayoutGrid,
  "Cable / Wire":          Zap,
  "Grounding":             Shield,
  "Boxes":                 Box,
  "Devices":               ToggleLeft,
  "Equipment":             Cpu,
};

export function resolveDisplayCategory(storedCat: string | null | undefined, itemName: string): string {
  const name = itemName.toLowerCase();
  const cat  = (storedCat ?? "").trim().toLowerCase();

  if (name.includes("cable tray") || name.includes("checkered")) return "Cable Tray";

  if (
    (name.includes("ground") && (name.includes("wire") || name.includes("rod") || name.includes("bar"))) ||
    cat === "grounding"
  ) return "Grounding";

  const isFitting =
    name.includes("connector") ||
    name.includes("coupling") ||
    name.includes("strap") ||
    (name.includes("bushing") && !name.includes("ground")) ||
    name.includes("locknut") ||
    name.includes("pipe clamp") ||
    name.includes("conduit clamp") ||
    name.includes("lug") ||
    (name.includes("elbow") && !name.includes("cable tray"));
  if (isFitting) return "Fittings & Connectors";

  const isConduit =
    (name.includes("conduit") && !name.includes("connector") && !name.includes("clamp")) ||
    name.includes("mc cable");
  if (isConduit) return "Conduit";

  const isCableOrWire =
    (name.includes("wire") && !name.includes("ground")) ||
    (name.includes("cable") && !name.includes("cable tray") && !name.includes("ground")) ||
    name.includes("thhn") ||
    name.includes("conductor") ||
    name.includes("(c+g)") ||
    name.includes("single wire") ||
    name.includes("multi-conductor");
  if (isCableOrWire) return "Cable / Wire";

  const isBox =
    name.includes("box") ||
    name.includes("enclosure") ||
    name.includes("pull box") ||
    name.includes("junction");
  if (isBox) return "Boxes";

  const isDevice =
    name.includes("receptacle") ||
    name.includes("switch") ||
    name.includes("outlet") ||
    name.includes("fixture") ||
    name.includes("exit sign") ||
    name.includes("duplex") ||
    name.includes("plug");
  if (isDevice) return "Devices";

  const isEquipment =
    name.includes("transformer") ||
    name.includes("motor") ||
    name.includes("mcc") ||
    name.includes("panel") ||
    name.includes("vfd") ||
    name.includes("ups");
  if (isEquipment) return "Equipment";

  const catMap: Record<string, string> = {
    "conduit":               "Conduit",
    "flexible":              "Conduit",
    "fittings":              "Fittings & Connectors",
    "fittings & connectors": "Fittings & Connectors",
    "supports / strut":      "Fittings & Connectors",
    "cable / wire":          "Cable / Wire",
    "cable tray":            "Cable Tray",
    "tray / covers":         "Cable Tray",
    "grounding":             "Grounding",
    "boxes":                 "Boxes",
    "boxes / devices":       "Boxes",
    "devices":               "Devices",
    "equipment / special":   "Equipment",
    "equipment":             "Equipment",
    "other":                 "Equipment",
    "emt support":           "Fittings & Connectors",
    "rigid support":         "Fittings & Connectors",
  };
  return catMap[cat] || "Equipment";
}

export function resolveSubGroup(displayCat: string, itemName: string): string | null {
  const name = itemName.toLowerCase();
  if (displayCat === "Conduit" || displayCat === "Fittings & Connectors") {
    if (
      name.includes("liquidtight") ||
      (name.includes("flexible") && (name.includes("conduit") || name.includes("connector")))
    ) return "flexible";
    if (name.includes("emt")) return "emt";
    if (name.includes("rigid")) return "rigid";
  }
  return null;
}

export function normalizeCategory(cat: string | null | undefined): string {
  return resolveDisplayCategory(cat, "");
}
