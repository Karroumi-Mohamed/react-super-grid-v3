import type { CellRegistry } from "./Registries";
import { RowRegistry } from "./Registries";
import type { CellCoordinate, CellCoordinatorI, CellId, RowId } from "./types";

export class CellCoordinator implements CellCoordinatorI {
  private static instance: CellCoordinator | null = null;
  private registry: CellRegistry; // explicit field
  private rowRegistry: RowRegistry<any>; // row registry for row linking

  private constructor(registry: CellRegistry) {
    this.registry = registry; // assign manually
    this.rowRegistry = RowRegistry.getInstance();
  }

  static getInstance(registry: CellRegistry): CellCoordinator {
    if (!CellCoordinator.instance) {
      CellCoordinator.instance = new CellCoordinator(registry);
    }
    return CellCoordinator.instance;
  }

  // Link two cells vertically: top <-> bottom
  linkVertical(topId: CellId, bottomId: CellId): void {
    const topCell = this.registry.get(topId);
    const bottomCell = this.registry.get(bottomId);
    if (!topCell || !bottomCell) return;

    topCell.bottom = bottomId;
    bottomCell.top = topId;

    this.registry.register(topId, topCell);
    this.registry.register(bottomId, bottomCell);
  }

  // Link two cells horizontally: left <-> right
  linkHorizontal(leftId: CellId, rightId: CellId): void {
    const leftCell = this.registry.get(leftId);
    const rightCell = this.registry.get(rightId);
    if (!leftCell || !rightCell) return;

    leftCell.right = rightId;
    rightCell.left = leftId;

    this.registry.register(leftId, leftCell);
    this.registry.register(rightId, rightCell);
  }

  // Clear a specific coordinate for a cell
  clearCoordinate(cellId: CellId, coord: CellCoordinate): void {
    const cell = this.registry.get(cellId);
    if (!cell) return;

    switch (coord) {
      case "Top":
        if (cell.top) {
          const neighbor = this.registry.get(cell.top);
          if (neighbor) neighbor.bottom = null;
          this.registry.register(cell.top, neighbor!);
        }
        cell.top = null;
        break;

      case "Bottom":
        if (cell.bottom) {
          const neighbor = this.registry.get(cell.bottom);
          if (neighbor) neighbor.top = null;
          this.registry.register(cell.bottom, neighbor!);
        }
        cell.bottom = null;
        break;

      case "Left":
        if (cell.left) {
          const neighbor = this.registry.get(cell.left);
          if (neighbor) neighbor.right = null;
          this.registry.register(cell.left, neighbor!);
        }
        cell.left = null;
        break;

      case "Right":
        if (cell.right) {
          const neighbor = this.registry.get(cell.right);
          if (neighbor) neighbor.left = null;
          this.registry.register(cell.right, neighbor!);
        }
        cell.right = null;
        break;
    }

    this.registry.register(cellId, cell);
  }

  // Link two rows vertically: top <-> bottom
  linkRows(topId: RowId, bottomId: RowId): void {
    const topRow = this.rowRegistry.get(topId);
    const bottomRow = this.rowRegistry.get(bottomId);
    if (!topRow || !bottomRow) return;

    topRow.bottom = bottomId;
    bottomRow.top = topId;

    this.rowRegistry.register(topId, topRow);
    this.rowRegistry.register(bottomId, bottomRow);
  }

  // Link cells from two rows (top row cells to bottom row cells)
  linkRowsCells(topCells: CellId[], bottomCells: CellId[]): void {
    const minLength = Math.min(topCells.length, bottomCells.length);
    
    for (let i = 0; i < minLength; i++) {
      this.linkVertical(topCells[i], bottomCells[i]);
    }
  }
}
