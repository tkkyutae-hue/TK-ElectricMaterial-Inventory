/** Field filter reads: never turn HTTP failures into empty successful data. */
export async function readFieldFilter<T>(
  url: string, signal?: AbortSignal, shape: "array" | "items" = "array",
): Promise<T> {
  const response = await fetch(url, { credentials: "include", signal });
  if (!response.ok) throw new Error(`Field filter request failed (${response.status})`);
  const data = await response.json();
  const valid = shape === "array" ? Array.isArray(data)
    : data && Array.isArray(data.items) && Number.isSafeInteger(data.total) && data.total >= 0;
  if (!valid) throw new Error("Invalid field filter response");
  return data;
}

export const fieldFilterErrors = {
  ko: { title: "자재 또는 필터를 불러오지 못했습니다", description: "선택 조건은 유지됩니다. 연결을 확인한 뒤 다시 시도해 주세요.", retry: "다시 시도" },
  en: { title: "Unable to load materials or filters", description: "Your filters are preserved. Check your connection and try again.", retry: "Try again" },
  es: { title: "No se pudieron cargar los materiales o filtros", description: "Se conservan los filtros. Comprueba la conexión e inténtalo de nuevo.", retry: "Reintentar" },
};
