import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, RowCommandMap } from '../core/types';

export class CreateRowTesterFirst extends BasePlugin {
    name = 'createRowTesterFirst';
    version = '1.0.0';
    dependencies: string[] = [];

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        // Allow all cell commands
    }

    onBeforeRowCommand<K extends keyof RowCommandMap>(_command: RowCommand<K>): boolean | void {
        // Allow all row commands
    }

    onInit(): void {
        console.log('CreateRowTesterFirst: Plugin initialized');

        if (this.tableAPIs) {
            // Create empty row at top after 2 seconds
            setTimeout(() => {
                console.log('CreateRowTesterFirst: Creating row at TOP');
                this.tableAPIs!.createRow(null, 'top');
            }, 2000);

            // Create another empty row at bottom after 4 seconds
            setTimeout(() => {
                console.log('CreateRowTesterFirst: Creating row at BOTTOM');
                this.tableAPIs!.createRow(null, 'bottom');
            }, 4000);
        }
    }

    onDestroy(): void {
        console.log('CreateRowTesterFirst: Plugin destroyed');
    }
}