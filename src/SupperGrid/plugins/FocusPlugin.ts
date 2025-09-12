import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, CellId, RowCommandMap } from '../core/types';

export class FocusPlugin extends BasePlugin {
    readonly name = 'focus-plugin';
    readonly version = '1.0.0';

    private focusedCell: CellId | null = null;

    onInit(): void {
        console.log('FocusPlugin: Initialized');
    }

    onDestroy(): void {
        console.log('FocusPlugin: Destroyed');
        this.focusedCell = null;
    }

    onBeforeCellCommand(command: CellCommand): boolean | void {
        // Check if APIs are initialized
        const { name, targetId } = command;
        if (!this.tableAPIs) {
            console.warn('FocusPlugin: TableAPIs not initialized yet, skipping command processing');
            return true; // Allow command to continue
        }

        // Handle cell-specific commands (with targetId)
        if (targetId && name === 'click') {
            this.focusCell(targetId);
        }

        // Handle keyboard commands without targetId (plugin-only)
        if (!targetId && name === 'keydown') {
            const event = command.payload.event;
            console.log('Keyboard command received:', event.key);

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
        if (!this.focusedCell) return;
        switch (direction) {
            case 'ArrowUp':
                const top = this.tableAPIs?.getCell(this.focusedCell)?.top
                if (top) {
                   this.focusCell(top)
                }
                break;
            case 'ArrowDown':
                const bottom = this.tableAPIs?.getCell(this.focusedCell)?.bottom
                if (bottom) {
                   this.focusCell(bottom)
                }
                break;
            case 'ArrowLeft':
                const left = this.tableAPIs?.getCell(this.focusedCell)?.left
                if (left) {
                   this.focusCell(left)
                }
                break;
            case 'ArrowRight':
                const right = this.tableAPIs?.getCell(this.focusedCell)?.right
                if (right) {
                   this.focusCell(right)
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
