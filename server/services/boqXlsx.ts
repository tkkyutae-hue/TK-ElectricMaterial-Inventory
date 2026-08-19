import { inflateRawSync } from "node:zlib";

export type BoqSpreadsheetRow = {
  itemName: string;
  spec: string | null;
  qty: number;
  unit: string | null;
  section: string | null;
  sortOrder: number;
  category: null;
};

export class XlsxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XlsxParseError";
  }
}

type ZipEntry = {
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type Worksheet = { name: string; path: string };

const MAX_ZIP_ENTRIES = 2_000;
const MAX_WORKBOOK_XML_BYTES = 8 * 1024 * 1024;
const MAX_SHARED_STRINGS_BYTES = 32 * 1024 * 1024;
const MAX_WORKSHEET_XML_BYTES = 32 * 1024 * 1024;
const MAX_SHEET_COUNT = 64;

function decodeXml(value: string): string {
  return value.replace(/&(?:#x([0-9a-f]+)|#(\d+)|amp|lt|gt|quot|apos);/gi, (entity, hex, decimal) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (decimal) return String.fromCodePoint(parseInt(decimal, 10));
    return ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" } as Record<string, string>)[entity.toLowerCase()] ?? entity;
  });
}

function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`\\b${escaped}=(["'])(.*?)\\1`, "i").exec(tag);
  return match ? decodeXml(match[2]) : null;
}

function columnNumber(reference: string): number | null {
  const letters = /^([A-Z]+)/i.exec(reference)?.[1];
  if (!letters) return null;
  let value = 0;
  for (const letter of letters.toUpperCase()) value = value * 26 + letter.charCodeAt(0) - 64;
  return value;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new XlsxParseError("지원하지 않는 Excel 파일입니다. 새 .xlsx 파일로 저장한 후 다시 시도해 주세요.");
}

function readZipEntries(buffer: Buffer): Map<string, ZipEntry> {
  if (buffer.length < 22 || buffer.subarray(0, 2).toString("ascii") !== "PK") {
    throw new XlsxParseError("올바른 .xlsx 파일이 아닙니다.");
  }
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount > MAX_ZIP_ENTRIES || directoryOffset + directorySize > buffer.length) {
    throw new XlsxParseError("Excel 파일 구조가 너무 복잡합니다. B.O.Q 시트만 새 파일로 저장해 다시 시도해 주세요.");
  }

  const entries = new Map<string, ZipEntry>();
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new XlsxParseError("Excel 파일의 ZIP 구조를 읽을 수 없습니다.");
    }
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const end = offset + 46 + filenameLength + extraLength + commentLength;
    if (end > buffer.length) throw new XlsxParseError("Excel 파일의 ZIP 구조가 손상되었습니다.");
    entries.set(buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8"), {
      compressionMethod: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });
    offset = end;
  }
  return entries;
}

function readZipXml(buffer: Buffer, entries: Map<string, ZipEntry>, fileName: string, maxBytes: number): string | null {
  const entry = entries.get(fileName);
  if (!entry) return null;
  if (entry.uncompressedSize > maxBytes) {
    throw new XlsxParseError("Excel 시트가 너무 커서 안전하게 읽을 수 없습니다. 필요한 B.O.Q 범위만 새 파일로 저장해 주세요.");
  }
  const offset = entry.localHeaderOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new XlsxParseError("Excel 파일의 ZIP 구조가 손상되었습니다.");
  }
  const filenameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const contentStart = offset + 30 + filenameLength + extraLength;
  const contentEnd = contentStart + entry.compressedSize;
  if (contentEnd > buffer.length) throw new XlsxParseError("Excel 파일의 ZIP 데이터가 손상되었습니다.");

  try {
    const compressed = buffer.subarray(contentStart, contentEnd);
    const content = entry.compressionMethod === 0
      ? Buffer.from(compressed)
      : entry.compressionMethod === 8
        ? inflateRawSync(compressed, { maxOutputLength: maxBytes })
        : null;
    if (!content) throw new XlsxParseError("지원하지 않는 Excel 압축 방식입니다.");
    if (content.length > maxBytes) throw new XlsxParseError("Excel 시트가 너무 커서 안전하게 읽을 수 없습니다.");
    return content.toString("utf8");
  } catch (error) {
    if (error instanceof XlsxParseError) throw error;
    throw new XlsxParseError("Excel 시트를 안전하게 압축 해제할 수 없습니다.");
  }
}

function readWorksheets(buffer: Buffer, entries: Map<string, ZipEntry>): Worksheet[] {
  const workbookXml = readZipXml(buffer, entries, "xl/workbook.xml", MAX_WORKBOOK_XML_BYTES);
  const relationshipsXml = readZipXml(buffer, entries, "xl/_rels/workbook.xml.rels", MAX_WORKBOOK_XML_BYTES);
  if (!workbookXml || !relationshipsXml) throw new XlsxParseError("Excel 워크북 정보를 읽을 수 없습니다.");

  const relationshipPaths = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(/<Relationship\b[^>]*\/?>/gi)) {
    const id = attribute(match[0], "Id");
    const target = attribute(match[0], "Target");
    if (id && target) relationshipPaths.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }

  const worksheets: Worksheet[] = [];
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*\/?>/gi)) {
    const name = attribute(match[0], "name");
    const relationshipId = attribute(match[0], "r:id");
    const relativePath = relationshipId ? relationshipPaths.get(relationshipId) : null;
    if (!name || !relativePath) continue;
    const path = relativePath.startsWith("worksheets/")
      ? `xl/${relativePath}`
      : `xl/${relativePath.replace(/^\.\//, "")}`;
    if (path.startsWith("xl/worksheets/")) worksheets.push({ name, path });
  }
  if (worksheets.length > MAX_SHEET_COUNT) {
    throw new XlsxParseError("Excel 파일에 시트가 너무 많습니다. 필요한 B.O.Q 시트만 새 파일로 저장해 주세요.");
  }
  return worksheets;
}

function readSharedStrings(buffer: Buffer, entries: Map<string, ZipEntry>): string[] {
  const xml = readZipXml(buffer, entries, "xl/sharedStrings.xml", MAX_SHARED_STRINGS_BYTES);
  if (!xml) return [];
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) {
    let value = "";
    for (const text of match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)) value += decodeXml(text[1]);
    strings.push(value);
  }
  return strings;
}

function cellText(cellXml: string, cellTag: string, sharedStrings: string[]): string {
  const type = attribute(cellTag, "t");
  if (type === "inlineStr") {
    return Array.from(cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi))
      .map((match) => decodeXml(match[1])).join("");
  }
  const value = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(cellXml)?.[1];
  if (value == null) return "";
  const decoded = decodeXml(value);
  if (type === "s") {
    const index = Number.parseInt(decoded, 10);
    return Number.isSafeInteger(index) ? (sharedStrings[index] ?? "") : "";
  }
  return decoded;
}

function forEachWorksheetRow(
  worksheetXml: string,
  sharedStrings: string[],
  onRow: (cells: Map<number, string>) => boolean | void,
): void {
  for (const row of worksheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const cells = new Map<number, string>();
    for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const reference = attribute(cell[1], "r");
      const column = reference ? columnNumber(reference) : null;
      if (column !== null) cells.set(column, cellText(cell[2], cell[1], sharedStrings));
    }
    if (onRow(cells) === false) return;
  }
}

function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;
  const quantity = Number.parseFloat(normalized);
  return Number.isFinite(quantity) ? quantity : null;
}

export function extractBoqRowsFromXlsx(buffer: Buffer): BoqSpreadsheetRow[] | null {
  const entries = readZipEntries(buffer);
  const worksheets = readWorksheets(buffer, entries);
  const boqSheet = worksheets.find((sheet) => sheet.name.trim().toLowerCase() === "b.o.q");
  if (!boqSheet) return null;

  const worksheetXml = readZipXml(buffer, entries, boqSheet.path, MAX_WORKSHEET_XML_BYTES);
  if (!worksheetXml) throw new XlsxParseError("B.O.Q 시트를 읽을 수 없습니다.");
  const sharedStrings = readSharedStrings(buffer, entries);
  const items: BoqSpreadsheetRow[] = [];
  let currentSection: string | null = null;
  const skipPatterns = [
    /^\[?\s*sub\s*total\s*\]?$/i, /^\[?\s*total\s*\]?$/i,
    /grand\s*total/i, /direct\s*construction/i, /indirect\s*construction/i,
    /description\s*of\s*work/i, /construction\s*period/i, /subcontractor/i,
    /safety\s*\/\s*management/i, /conditions\s*and\s*terms/i,
    /approved\s*by/i, /^date\s*:/i, /quotation/i, /b\.o\.q/i,
  ];

  forEachWorksheetRow(worksheetXml, sharedStrings, (cells) => {
    const name = (cells.get(3) ?? "").trim();
    const spec = (cells.get(5) ?? "").trim();
    const unit = (cells.get(6) ?? "").trim();
    const quantityText = (cells.get(7) ?? "").trim();
    if (!name || skipPatterns.some((pattern) => pattern.test(name))) return;
    if (name.startsWith("■") || /^\d+\./.test(name)) return;

    if (name.startsWith("□") || name.startsWith(" □")) {
      if (unit === "L/S" && quantityText === "1") return;
      currentSection = name.replace(/^[\s□]+/, "").trim();
      return;
    }

    const qty = parseQuantity(quantityText);
    if (qty === null) return;
    items.push({
      itemName: name,
      spec: spec || null,
      qty,
      unit: unit || null,
      section: currentSection,
      sortOrder: items.length + 1,
      category: null,
    });
  });
  return items;
}

export function extractXlsxTextPreview(buffer: Buffer, maxLines = 300): string {
  const entries = readZipEntries(buffer);
  const worksheets = readWorksheets(buffer, entries);
  const sharedStrings = readSharedStrings(buffer, entries);
  const lines: string[] = [];

  for (const worksheet of worksheets) {
    const worksheetXml = readZipXml(buffer, entries, worksheet.path, MAX_WORKSHEET_XML_BYTES);
    if (!worksheetXml) continue;
    forEachWorksheetRow(worksheetXml, sharedStrings, (cells) => {
      const values = Array.from(cells.entries())
        .sort(([left], [right]) => left - right)
        .map(([, value]) => value.trim())
        .join("\t");
      if (values.trim()) lines.push(values);
      return lines.length < maxLines;
    });
    if (lines.length >= maxLines) break;
  }
  return lines.join("\n");
}