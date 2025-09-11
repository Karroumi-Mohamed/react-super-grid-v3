import type { CellComponent, ExtractCellConfig } from "./types";

export function createColumn<T>() {
  return function <
    TKey extends keyof T,
    TCell extends CellComponent<T[TKey], any>,
  >(key: TKey, cell: TCell, config: ExtractCellConfig<TCell>) {
    return { key, cell, ...config };
  };
}
