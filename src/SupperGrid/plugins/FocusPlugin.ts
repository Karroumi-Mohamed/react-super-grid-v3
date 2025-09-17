import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, CellId, RowCommandMap } from '../core/types';

export class FocusPlugin extends BasePlugin {
    readonly name = 'focus-plugin';
    readonly version = '1.0.0';

    private focusedCell: CellId | null = null;

    onInit(): void {

        // Log space information
        if (this.tableAPIs) {
            const mySpace = this.tableAPIs.getMySpace();

            const spaceAbove = this.tableAPIs.getSpaceAbove(mySpace);
            const spaceBelow = this.tableAPIs.getSpaceBelow(mySpace);


            const spaceData = this.tableAPIs.getSpace(mySpace);
        }

        // Example: Delete first row after 5 seconds

        setTimeout(() => {
            if (this.tableAPIs) {
                const rowIds = this.tableAPIs.getRowIds();
                if (rowIds.length > 0) {
                    const firstRowId = rowIds[0];
                    this.tableAPIs.deleteRow(firstRowId);
                } else {
                }
            }
        }, 5000);
    }

    onDestroy(): void {
        this.focusedCell = null;
    }

    onBeforeCellCommand(command: CellCommand): boolean | void {
        // Check if APIs are initialized
        const { name, targetId } = command;
        if (!this.tableAPIs) {
            return true; // Allow command to continue
        }

        // Handle cell-specific commands (with targetId)
        if (targetId && name === 'click') {
            this.focusCell(targetId);
        }

        // Handle keyboard commands without targetId (plugin-only)
        if (!targetId && name === 'keydown') {
            const event = command.payload.event;

            if (this.isArrow(event.key)) {
                event.preventDefault();
                this.handleNavigation(event.key);
                return true; // Block further processing - we handled it
            }
        }

        // Allow all other commands to continue
        return true;
    }

    onBeforeRowCommand<K extends keyof RowCommandMap>(_command: RowCommand<K>): boolean | void {
        // For now, just allow all row commands
        return true;
    }

    private handleNavigation(direction: string) {
        if (!this.focusedCell) {
            return;
        }


        const currentCell = this.tableAPIs?.getCell(this.focusedCell);
        if (!currentCell) {
            return;
        }


        switch (direction) {
            case 'ArrowUp':
                const top = currentCell.top;
                if (top) {
                   this.focusCell(top)
                } else {
                }
                break;
            case 'ArrowDown':
                const bottom = currentCell.bottom;
                if (bottom) {
                   this.focusCell(bottom)
                } else {
                }
                break;
            case 'ArrowLeft':
                const left = currentCell.left;
                if (left) {
                   this.focusCell(left)
                } else {
                }
                break;
            case 'ArrowRight':
                const right = currentCell.right;
                if (right) {
                   this.focusCell(right)
                } else {
                }
                break;
            default:
                break;
        }
    }

    private isArrow(key: string) {
        return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
    }

    private blurCell(id: CellId) {
        this.tableAPIs?.createCellCommand(id, { name: 'blur' })
    }
    private focusCell(id: CellId): void {
        if (this.focusedCell) {
            this.blurCell(this.focusedCell);
        }
        this.focusedCell = id;
        this.tableAPIs?.createCellCommand(id, { name: 'focus' })
    }

    public getFocused(): CellId | null{
        return this.focusedCell;
    }
}
