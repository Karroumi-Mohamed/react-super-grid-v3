import { BasePlugin, type TablePluginAPIs } from '../core/BasePlugin';
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

        if (name === 'click') {
            this.focusCell(targetId);
        }

        // Allow all commands to continue
        return true;
    }

    onBeforeRowCommand<K extends keyof RowCommandMap>(_command: RowCommand<K>): boolean | void {
        // For now, just allow all row commands
        return true;
    }
    private focusCell(id: CellId): void {
        if (this.focusedCell) {
            this.tableAPIs?.createCellCommand(this.focusedCell, { name: 'blur' })
        }
        this.focusedCell = id;
        this.tableAPIs?.createCellCommand(id, { name: 'focus' })
    }

}
