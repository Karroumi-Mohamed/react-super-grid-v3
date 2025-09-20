export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// String-based Y indexing utilities for infinite row positioning
export class StringPositionGenerator {

  // Generate a string that sorts higher than the given string
  static generateHigherString(existing: string): string {
    const num = parseInt(existing, 10);
    if (isNaN(num)) {
      return existing + "1";
    }
    return (num + 10).toString();
  }

  // Generate a string that sorts lower than the given string
  static generateLowerString(existing: string): string {
    const num = parseInt(existing, 10);
    if (isNaN(num)) {
      return "0" + existing;
    }

    if (num <= 10) {
      const newNum = Math.max(1, num - 5);
      return newNum.toString().padStart(2, '0');
    }

    return (num - 10).toString();
  }

  // Generate a string that sorts between two given strings
  static generateBetweenStrings(higher: string, lower: string): string {
    const higherNum = parseInt(higher, 10);
    const lowerNum = parseInt(lower, 10);

    if (!isNaN(higherNum) && !isNaN(lowerNum)) {
      const diff = higherNum - lowerNum;

      if (diff > 1) {
        const middle = Math.floor((higherNum + lowerNum) / 2);
        return middle.toString();
      } else {
        // Insert between "40" and "39" → "395"
        return lower + "5";
      }
    }

    return lower + "5";
  }

  // Find the appropriate position string for a new row
  static generatePositionString(existingRowStrings: string[], position: 'top' | 'bottom'): string {
    if (existingRowStrings.length === 0) {
      return "20";
    }

    const sorted = [...existingRowStrings].sort();

    if (position === 'top') {
      const highest = sorted[sorted.length - 1];
      return this.generateHigherString(highest);
    } else {
      const lowest = sorted[0];
      return this.generateLowerString(lowest);
    }
  }

  // Validate that a position string maintains proper order
  static validateStringOrder(newString: string, existingStrings: string[], position: 'top' | 'bottom'): boolean {
    if (existingStrings.length === 0) return true;

    const sorted = [...existingStrings].sort();

    if (position === 'top') {
      const highest = sorted[sorted.length - 1];
      return newString > highest;
    } else {
      const lowest = sorted[0];
      return newString < lowest;
    }
  }
}
