export type Language = "ko" | "en" | "es";
export type LocalName = Record<Language, string>;
export type Category = { id: string; name: LocalName; image: string };
export type Item = {
  id: string; sku: string; name: LocalName; categoryId: string; family: string;
  brand: string; type: string; subcategory: string; size: string; stock: number;
  unit: string; location: string; image: string | null;
};

// Original, representative line illustrations; these are NOT product photographs.
export function materialSvg(kind: string): string {
  const drawings: Record<string, string> = {
    conduit: '<path d="M35 106L141 37l17 15-105 69z" fill="#b3c0b7"/><path d="M35 106L141 37m-96 76L150 44" stroke="#e8eee8" stroke-width="5"/><ellipse cx="45" cy="114" rx="13" ry="7" transform="rotate(-33 45 114)" fill="#54665a" stroke="#91a799" stroke-width="4"/><path d="M62 127l91-57 9 9-90 57z" fill="#8ca294"/>',
    fittings: '<path d="M52 46h39v40h39v38H74c-12 0-22-10-22-22z" fill="#aab9ae" stroke="#6a8171" stroke-width="3"/><ellipse cx="72" cy="46" rx="20" ry="8" fill="#506558" stroke="#aab9ae" stroke-width="5"/><ellipse cx="130" cy="105" rx="8" ry="19" fill="#506558" stroke="#aab9ae" stroke-width="5"/><path d="M56 63h32m17 29v28" stroke="#e1e8e0" stroke-width="4"/>',
    wire: '<ellipse cx="102" cy="86" rx="46" ry="49" fill="#aa906c" stroke="#78684e" stroke-width="3"/><path d="M70 58c-25 25-24 62 7 76M82 49c-28 24-29 64 0 87M94 43c-28 26-28 67-3 92M106 40c-26 28-27 69-5 94" fill="none" stroke="#405e48" stroke-width="8"/><ellipse cx="116" cy="85" rx="17" ry="24" fill="#bfac8e"/><ellipse cx="116" cy="85" rx="8" ry="12" fill="#596251"/><path d="M67 120q-33 22-37 2" stroke="#405e48" stroke-width="6" fill="none"/>',
    boxes: '<path d="M53 59l66-22 32 27v58l-67 22-31-28z" fill="#a3b3a9" stroke="#61796b" stroke-width="3"/><path d="M53 59l31 29 67-24M84 88v56" fill="none" stroke="#dce5dd" stroke-width="3"/><path d="M63 66v45l17 15V83z" fill="#50695a"/><ellipse cx="111" cy="107" rx="12" ry="15" fill="#839a8a" stroke="#607669" stroke-width="2"/><ellipse cx="127" cy="56" rx="11" ry="5" fill="#6b8172"/>',
    devices: '<path d="M69 32h65v107H69z" fill="#b1beb4" stroke="#64786b" stroke-width="3"/><rect x="78" y="46" width="47" height="80" rx="9" fill="#e7e6d8"/><circle cx="101" cy="67" r="15" fill="#d0d1c2"/><circle cx="101" cy="105" r="15" fill="#d0d1c2"/><path d="M94 59v9m13-9v9m-8 7h4M94 97v9m13-9v9m-8 7h4" stroke="#516452" stroke-width="3"/><circle cx="101" cy="38" r="2" fill="#64786b"/><circle cx="101" cy="133" r="2" fill="#64786b"/>',
    supports: '<path d="M50 115l90-66 18 13-90 66z" fill="#a9b9ac" stroke="#68806e" stroke-width="3"/><path d="M50 115v16l18 13 90-65V62" fill="none" stroke="#849e8a" stroke-width="5"/><path d="M75 105l9-7m10-7l9-7m11-8l9-7m10-7l9-7" stroke="#536b59" stroke-width="6" stroke-linecap="round"/>',
  };
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 165"><rect width="200" height="165" rx="10" fill="#e8eee7"/><ellipse cx="102" cy="143" rx="60" ry="5" fill="#d3ded2"/>${drawings[kind] || drawings.conduit}</svg>`)}`;
}

export const categories: Category[] = [
  { id: "conduit", name: { en: "Conduit", ko: "전선관", es: "Tubería" }, image: materialSvg("conduit") },
  { id: "fittings", name: { en: "Fittings", ko: "관 부속", es: "Conectores" }, image: materialSvg("fittings") },
  { id: "wire", name: { en: "Wire & cable", ko: "전선 · 케이블", es: "Cableado" }, image: materialSvg("wire") },
  { id: "boxes", name: { en: "Boxes", ko: "박스", es: "Cajas" }, image: materialSvg("boxes") },
  { id: "devices", name: { en: "Devices", ko: "배선 기구", es: "Dispositivos" }, image: materialSvg("devices") },
  { id: "supports", name: { en: "Supports", ko: "지지 자재", es: "Soportes" }, image: materialSvg("supports") },
];

const fixture = (
  id: string, categoryId: string, en: string, ko: string, es: string, family: string,
  brand: string, type: string, subcategory: string, size: string, stock: number, unit = "EA",
): Item => ({
  id, categoryId, name: { en, ko, es }, family, brand, type, subcategory, size, stock, unit,
  sku: `TK-${categoryId.slice(0, 3).toUpperCase()}-${id}`, location: `A-${(Number(id) % 4) + 1}`,
  image: materialSvg(categoryId),
});

export const items: Item[] = [
  fixture("101", "conduit", "EMT conduit", "EMT 전선관", "Tubo EMT", "EMT", "Allied", "Steel", "Galvanized", '1/2"', 147, "FT"),
  fixture("102", "conduit", "EMT conduit", "EMT 전선관", "Tubo EMT", "EMT", "Allied", "Steel", "Galvanized", '3/4"', 284, "FT"),
  fixture("103", "conduit", "EMT conduit", "EMT 전선관", "Tubo EMT", "EMT", "Wheatland", "Steel", "Galvanized", '1"', 18, "FT"),
  fixture("104", "conduit", "EMT aluminum conduit", "알루미늄 EMT 전선관", "Tubo EMT de aluminio", "EMT", "Allied", "Aluminum", "Uncoated", '1"', 0, "FT"),
  fixture("105", "conduit", "Rigid conduit", "후강 전선관", "Tubo rígido", "Rigid", "Wheatland", "Steel", "Galvanized", '1-1/4"', 76, "FT"),
  fixture("106", "conduit", "Schedule 40 PVC conduit", "스케줄 40 PVC 전선관", "Tubo PVC cédula 40", "PVC", "Cantex", "Schedule 40", "Nonmetallic", '2"', 63, "FT"),
  fixture("201", "fittings", "EMT set-screw connector", "EMT 세트스크루 커넥터", "Conector EMT de tornillo", "Connectors", "Bridgeport", "Set screw", "Zinc", '1/2"', 326),
  fixture("202", "fittings", "EMT compression coupling", "EMT 압착 커플링", "Cople EMT de compresión", "Couplings", "Bridgeport", "Compression", "Steel", '3/4"', 84),
  fixture("203", "fittings", "Rigid 90° elbow", "후강 90° 엘보", "Codo rígido de 90°", "Elbows", "Raco", "Threaded", "Galvanized", '1"', 0),
  fixture("301", "wire", "THHN copper wire · black", "THHN 동선 · 검정", "Cable THHN de cobre · negro", "THHN", "Southwire", "Single conductor", "Black", "12 AWG", 1850, "FT"),
  fixture("302", "wire", "THHN copper wire · white", "THHN 동선 · 흰색", "Cable THHN de cobre · blanco", "THHN", "Southwire", "Single conductor", "White", "10 AWG", 64, "FT"),
  fixture("303", "wire", "MC armored cable", "MC 금속 외장 케이블", "Cable armado MC", "MC", "AFC", "Multi conductor", "Aluminum armor", "12/2", 215, "FT"),
  fixture("401", "boxes", "4-inch square junction box", "4인치 사각 정션 박스", "Caja cuadrada de conexiones", "Junction", "Raco", "Square", "Deep", '4"', 58),
  fixture("402", "boxes", "Weatherproof outlet box", "방수 콘센트 박스", "Caja de contacto para intemperie", "Outlet", "Bell", "Weatherproof", "Single gang", '1/2"', 7),
  fixture("501", "devices", "Duplex receptacle", "듀플렉스 콘센트", "Contacto dúplex", "Receptacles", "Leviton", "Duplex", "White", "20 A", 92),
  fixture("502", "devices", "Single-pole toggle switch", "단극 토글 스위치", "Interruptor de un polo", "Switches", "Leviton", "Toggle", "White", "15 A", 16),
  fixture("601", "supports", "Slotted strut channel", "슬롯 스트럿 채널", "Canal ranurado de soporte", "Strut", "Unistrut", "Slotted", "Galvanized", '1-5/8"', 134, "FT"),
  fixture("602", "supports", "Conduit one-hole strap", "전선관 원홀 새들", "Abrazadera de un orificio", "Straps", "B-Line", "One hole", "Steel", '3/4"', 219),
];

export const vocabulary: Record<string, LocalName> = {
  Steel: { en: "Steel", ko: "강철", es: "Acero" },
  Aluminum: { en: "Aluminum", ko: "알루미늄", es: "Aluminio" },
  Galvanized: { en: "Galvanized", ko: "아연 도금", es: "Galvanizado" },
  Uncoated: { en: "Uncoated", ko: "무도장", es: "Sin recubrimiento" },
  Rigid: { en: "Rigid", ko: "후강", es: "Rígido" },
  Nonmetallic: { en: "Nonmetallic", ko: "비금속", es: "No metálico" },
  "Schedule 40": { en: "Schedule 40", ko: "스케줄 40", es: "Cédula 40" },
  Connectors: { en: "Connectors", ko: "커넥터", es: "Conectores" },
  Couplings: { en: "Couplings", ko: "커플링", es: "Coples" },
  Elbows: { en: "Elbows", ko: "엘보", es: "Codos" },
  "Set screw": { en: "Set screw", ko: "세트스크루", es: "Tornillo" },
  Compression: { en: "Compression", ko: "압착", es: "Compresión" },
  Threaded: { en: "Threaded", ko: "나사형", es: "Roscado" },
  Zinc: { en: "Zinc", ko: "아연", es: "Zinc" },
  "Single conductor": { en: "Single conductor", ko: "단심", es: "Un conductor" },
  "Multi conductor": { en: "Multi conductor", ko: "다심", es: "Multiconductor" },
  Black: { en: "Black", ko: "검정", es: "Negro" },
  White: { en: "White", ko: "흰색", es: "Blanco" },
  "Aluminum armor": { en: "Aluminum armor", ko: "알루미늄 외장", es: "Armadura de aluminio" },
  Junction: { en: "Junction", ko: "정션", es: "Conexiones" },
  Square: { en: "Square", ko: "사각", es: "Cuadrado" },
  Deep: { en: "Deep", ko: "깊은형", es: "Profundo" },
  Outlet: { en: "Outlet", ko: "콘센트", es: "Contacto" },
  Weatherproof: { en: "Weatherproof", ko: "방수", es: "Para intemperie" },
  "Single gang": { en: "Single gang", ko: "1구", es: "Una unidad" },
  Receptacles: { en: "Receptacles", ko: "콘센트", es: "Contactos" },
  Duplex: { en: "Duplex", ko: "듀플렉스", es: "Dúplex" },
  Switches: { en: "Switches", ko: "스위치", es: "Interruptores" },
  Toggle: { en: "Toggle", ko: "토글", es: "Palanca" },
  Strut: { en: "Strut", ko: "스트럿", es: "Canal" },
  Slotted: { en: "Slotted", ko: "슬롯형", es: "Ranurado" },
  Straps: { en: "Straps", ko: "새들", es: "Abrazaderas" },
  "One hole": { en: "One hole", ko: "원홀", es: "Un orificio" },
};
