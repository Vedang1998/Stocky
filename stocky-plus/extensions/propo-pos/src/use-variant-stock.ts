import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { lookupVariant, type ErrorView, type StockView } from "./lookup";

export type VariantStockView = { kind: "loading" } | ErrorView | StockView;

/**
 * Stock for one variant, loaded when the screen opens. `reload` repeats the
 * request; a reload that overtakes an earlier request discards the older one.
 */
export function useVariantStock(
  variantGid: string,
  locationId: number | null,
): { view: VariantStockView; reload: () => void } {
  const [view, setView] = useState<VariantStockView>({ kind: "loading" });
  const controllerRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  const reload = useCallback(async () => {
    sequenceRef.current += 1;
    const current = sequenceRef.current;
    controllerRef.current?.abort();
    controllerRef.current =
      typeof AbortController === "function" ? new AbortController() : null;

    setView({ kind: "loading" });
    const next = await lookupVariant(
      fetch,
      variantGid,
      locationId,
      controllerRef.current?.signal,
    );
    if (next === null || current !== sequenceRef.current) return;
    setView(next);
  }, [variantGid, locationId]);

  useEffect(() => {
    void reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return { view, reload: () => void reload() };
}
