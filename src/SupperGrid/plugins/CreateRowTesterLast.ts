import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, RowCommandMap } from '../core/types';

export class CreateRowTesterLast extends BasePlugin {
    name = 'createRowTesterLast';
    version = '1.0.0';
    dependencies: string[] = [];
    processLast = true; // This plugin should be processed last

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        // Allow all cell commands
    }

    onBeforeRowCommand<K extends keyof RowCommandMap>(_command: RowCommand<K>): boolean | void {
        // Allow all row commands
    }

    onInit(): void {
        console.log('CreateRowTesterLast: Plugin initialized (processLast)');

        if (this.tableAPIs) {
            // Create empty row at top after 3 seconds
            setTimeout(() => {
                console.log('CreateRowTesterLast: Creating row at TOP (processLast space)');
                this.tableAPIs!.createRow(null, 'top');
            }, 3000);

            // Create another empty row at bottom after 5 seconds
            setTimeout(() => {
                console.log('CreateRowTesterLast: Creating row at BOTTOM (processLast space)');
                this.tableAPIs!.createRow(null, 'bottom');
            }, 5000);
        }
    }

    onDestroy(): void {
        console.log('CreateRowTesterLast: Plugin destroyed');
    }
}