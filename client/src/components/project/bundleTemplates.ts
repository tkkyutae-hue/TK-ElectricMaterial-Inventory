import type { BundleTemplateItem } from "./types";

export function getEMTTemplate(size: string): BundleTemplateItem[] {
  const isSmall = size === '3/4"' || size === '1"';
  const base: BundleTemplateItem[] = [
    { itemName: "EMT Conduit",               unit: "FT", category: "Conduit",               scopeType: "primary", searchWords: ["emt", "conduit"] },
    { itemName: "EMT Compression Coupling",  unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "compression", "coupling"] },
    { itemName: "EMT Compression Connector", unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "compression", "connector"] },
    { itemName: "EMT Set Screw Coupling",    unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "set", "screw", "coupling"] },
    { itemName: "EMT Set Screw Connector",   unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "set", "screw", "connector"] },
  ];
  if (isSmall) {
    return [
      ...base,
      { itemName: "EMT One-Hole Strap",      unit: "EA", category: "EMT Support", scopeType: "support", searchWords: ["emt", "strap"] },
      { itemName: "EMT Unistrut Pipe Clamp", unit: "EA", category: "EMT Support", scopeType: "support", searchWords: ["emt", "unistrut", "pipe", "clamp"] },
    ];
  }
  return [
    ...base,
    { itemName: "EMT Elbow 90°",        unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["emt", "elbow", "90"] },
    { itemName: "Unistrut Pipe Clamp",  unit: "EA", category: "EMT Support",            scopeType: "support", searchWords: ["unistrut", "pipe", "clamp"] },
  ];
}

export function getRigidTemplate(size: string): BundleTemplateItem[] {
  const isSmall = size === '3/4"' || size === '1"';
  const base: BundleTemplateItem[] = [
    { itemName: "Rigid Conduit",               unit: "FT", category: "Conduit",               scopeType: "primary", searchWords: ["rigid", "conduit"] },
    { itemName: "Rigid Compression Coupling",  unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["rigid", "compression", "coupling"] },
    { itemName: "Rigid Compression Connector", unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["rigid", "compression", "connector"] },
    { itemName: "Rigid Threaded Coupling",     unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["rigid", "threaded", "coupling"] },
  ];
  if (isSmall) {
    return [
      ...base,
      { itemName: "Rigid One-Hole Strap",      unit: "EA", category: "Rigid Support", scopeType: "support", searchWords: ["rigid", "strap"] },
      { itemName: "Rigid Unistrut Pipe Clamp", unit: "EA", category: "Rigid Support", scopeType: "support", searchWords: ["rigid", "unist", "pipe", "clamp"] },
    ];
  }
  return [
    ...base,
    { itemName: "Rigid Elbow 90°",     unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["rigid", "elbow", "90"] },
    { itemName: "Unistrut Pipe Clamp", unit: "EA", category: "Rigid Support",          scopeType: "support", searchWords: ["unistrut", "pipe", "clamp"] },
  ];
}

export function getFlexibleTemplate(flexType: string): BundleTemplateItem[] {
  if (flexType === "Metal Flexible") {
    return [
      { itemName: "Metal Flexible Conduit",                    unit: "FT", category: "Conduit",               scopeType: "primary", searchWords: ["metal", "flexible", "conduit"] },
      { itemName: "Metal Flexible Conduit Connector Straight", unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["metal", "flexible", "conduit", "connector", "straight"] },
      { itemName: "Metal Flexible Conduit Connector 90°",      unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["metal", "flexible", "conduit", "connector", "90"] },
    ];
  }
  if (flexType === "Liquidtight Flexible") {
    return [
      { itemName: "Liquidtight Flexible Conduit",                    unit: "FT", category: "Conduit",               scopeType: "primary", searchWords: ["liquidtight", "flexible", "conduit"] },
      { itemName: "Liquidtight Flexible Conduit Connector Straight", unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["liquidtight", "flexible", "conduit", "connector", "straight"] },
      { itemName: "Liquidtight Flexible Conduit Connector 90°",      unit: "EA", category: "Fittings & Connectors", scopeType: "support", searchWords: ["liquidtight", "flexible", "conduit", "connector", "90"] },
    ];
  }
  return [];
}

export const BUNDLE_DEFINITIONS: Record<string, BundleTemplateItem[]> = {
  "Flexible Conduit Bundle": [],
  "Cable Tray Bundle": [
    { itemName: "Cable Tray",               unit: "FT", category: "Cable Tray", scopeType: "primary", searchWords: ["cable", "tray"] },
    { itemName: "Cable Tray Coupler",       unit: "EA", category: "Cable Tray", scopeType: "support", searchWords: ["cable", "tray", "coupler"] },
    { itemName: "Cable Tray Elbow",         unit: "EA", category: "Cable Tray", scopeType: "support", searchWords: ["cable", "tray", "elbow"] },
    { itemName: "Cable Tray Cover",         unit: "FT", category: "Cable Tray", scopeType: "support", searchWords: ["cable", "tray", "cover"] },
    { itemName: "Cable Tray Support Hanger",unit: "EA", category: "Cable Tray", scopeType: "support", searchWords: ["cable", "tray", "support"] },
  ],
  "Box / Device Bundle": [
    { itemName: "4\" Square Box",      unit: "EA", category: "Boxes",   scopeType: "primary", searchWords: ["square", "box"] },
    { itemName: "4\" Square Box Cover", unit: "EA", category: "Boxes",   scopeType: "support", searchWords: ["square", "box", "cover"] },
    { itemName: "Device Box",           unit: "EA", category: "Boxes",   scopeType: "primary", searchWords: ["device", "box"] },
    { itemName: "Duplex Receptacle",    unit: "EA", category: "Devices", scopeType: "primary", searchWords: ["duplex", "receptacle"] },
    { itemName: "Single Pole Switch",   unit: "EA", category: "Devices", scopeType: "primary", searchWords: ["single", "pole", "switch"] },
    { itemName: "Cover Plate",          unit: "EA", category: "Devices", scopeType: "support", searchWords: ["cover", "plate"] },
  ],
  "Grounding Bundle": [
    { itemName: "Ground Rod",       unit: "EA", category: "Grounding", scopeType: "primary", searchWords: ["ground", "rod"] },
    { itemName: "Ground Rod Clamp", unit: "EA", category: "Grounding", scopeType: "support", searchWords: ["ground", "rod", "clamp"] },
    { itemName: "Grounding Wire",   unit: "FT", category: "Grounding", scopeType: "primary", searchWords: ["grounding", "wire"] },
    { itemName: "Grounding Bushing",unit: "EA", category: "Grounding", scopeType: "support", searchWords: ["grounding", "bushing"] },
    { itemName: "Grounding Lug",    unit: "EA", category: "Grounding", scopeType: "support", searchWords: ["grounding", "lug"] },
  ],
};

export const BUNDLE_SIZES: Record<string, string[]> = {
  "EMT Conduit Bundle":      ["3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","3-1/2\"","4\"","6\""],
  "Rigid Conduit Bundle":    ["3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","3-1/2\"","4\"","6\""],
  "Flexible Conduit Bundle": ["3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","3-1/2\"","4\"","6\""],
  "Cable Tray Bundle":       ["4\"","6\"","9\"","12\"","18\"","24\"","30\"","36\""],
  "Box / Device Bundle":     ["1G","2G","4\" Square","4-11/16\""],
  "Grounding Bundle":        ["#6","#4","#2","#1/0","#2/0","3/4\" Rod","5/8\" Rod"],
};
