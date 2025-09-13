import { BasePlugin } from "../core/BasePlugin";
import type { CellCommand, CellId, RowCommand } from "../core/types";
import { FocusPlugin } from "./FocusPlugin";

export class SelectPlugin extends BasePlugin {
    readonly name = "selection";
    readonly version: string = "1.0.0";
    readonly dependencies: string[] = ['focus-plugin'];
    readonly processLast: boolean = false;

    private focusPlugin: FocusPlugin | null = null;
    private anchorCell: CellId | null = null; // TODO: Implement selection anchor

    private selectionSet: Set<string> = new Set();

    onInit(): void {
        this.focusPlugin = this.getPlugin<FocusPlugin>('focus-plugin')
    }

    onDestroy(): void {

    }

    onBeforeRowCommand(_command: RowCommand): boolean | void {
        return true;
    }

    onBeforeCellCommand(command: CellCommand): boolean | void {
        const { name } = command;
        if (name === 'click') {
           this.clearSelection()
        }
        if (name === 'keydown') {
            this.handleKeyDown(command.payload.event);
            return true;
        }
        if (name === 'keyup') {
            this.handleKeyUp(command.payload.event);
            return true;
        }

        return true;
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Shift" || e.key === "Alt") {
            const anchor = this.focusPlugin?.getFocused();
            if (anchor) {

                this.anchorCell = anchor;
            }
        }

        if (this.isArrow(e.key)) {
            if (this.anchorCell) {
                const toCell = this.focusPlugin?.getFocused();
                if (e.shiftKey && toCell && !e.altKey && !e.metaKey && !e.ctrlKey) {
                    this.clearSelection();
                    this.linearSelection(this.anchorCell, toCell);
                }
                if (toCell && e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                    this.clearSelection();
                    this.rectangularSelection(this.anchorCell, toCell);
                }
            }
        }

        if (e.key === 'Escape') {
            this.clearSelection()
        }
    }

    private clearSelection() {
        this.selectionSet.forEach(id => {
            this.unselect(id);
        })
        this.selectionSet.clear();
    }

    private linearSelection(from: CellId, to: CellId) {
        const vSorted = this.tableAPIs?.compareVertical(from, to);

        if (!vSorted) {
            // Same row - simple horizontal selection
            const hSorted = this.tableAPIs?.compareHorizontal(from, to);
            if (hSorted) {
                this.selectHorizontalRange(hSorted.left, hSorted.right);
            }
            return;
        }

        // Different rows - start from top row
        const topCell = this.tableAPIs?.getCell(vSorted.top);
        const bottomCell = vSorted.bottom;

        if (!topCell) return;

        // Get the starting row
        let currentRow = this.tableAPIs?.getRow(topCell.rowId);

        let atTopRow = true;
        while (currentRow) {
            // Walk this row's cells array (ordered left to right)

            if (atTopRow) {
                this.selectHorizontalRange(vSorted.top, currentRow.cells[currentRow.cells.length - 1]);
                atTopRow = false;

                if (currentRow.bottom) {
                    currentRow = this.tableAPIs?.getRow(currentRow.bottom);
                    continue;
                } else {
                    break; // No more rows
                }
            }
            for (const cellId of currentRow.cells) {
                this.select(cellId);

                // If we found the target bottom cell, we're done
                if (this.cellsEqual(cellId, bottomCell)) {
                    return;
                }
            }

            // Move to next row using bottom row ID
            if (currentRow.bottom) {
                currentRow = this.tableAPIs?.getRow(currentRow.bottom);
            } else {
                break; // No more rows
            }
        }
    }

    private selectHorizontalRange(left: CellId, right: CellId) {
        // For same row, we can still use the row's cells array for efficiency
        const leftCell = this.tableAPIs?.getCell(left);
        if (!leftCell) return;

        const row = this.tableAPIs?.getRow(leftCell.rowId);
        if (!row) return;

        let selecting = false;
        for (const cellId of row.cells) {
            if (this.cellsEqual(cellId, left)) selecting = true;

            if (selecting) {
                this.select(cellId);
            }

            if (this.cellsEqual(cellId, right)) break;
        }
    }

    private cellsEqual(cell1: CellId, cell2: CellId): boolean {
        return cell1 === cell2; // Since they're the same string IDs
    }

    private rectangularSelection(_from: CellId, _to: CellId) {
        // TODO: Implement rectangular selection
    }

    private isArrow(key: string) {
        return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
    }

    private handleKeyUp(e: KeyboardEvent) {
        if (e.key === "Shift" || e.key === "Alt") {
            this.anchorCell = null;
        }
    }

    private select(id: CellId) {
        this.selectionSet.add(id);
        this.tableAPIs?.createCellCommand(id, { name: 'select' });
    }

    private unselect(id: CellId) {
        this.selectionSet.delete(id);
        this.tableAPIs?.createCellCommand(id, { name: 'unselect' });
    }
}
