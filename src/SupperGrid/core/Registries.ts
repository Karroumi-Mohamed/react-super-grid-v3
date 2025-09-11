import type {
  Cell,
  CellId,
  RegistryI,
  Row,
  RowId,
  Space,
  SpaceId,
} from "./types";

class Registry<T_ID, T_Obj> implements RegistryI<T_ID, T_Obj> {
  private store = new Map<T_ID, T_Obj>();

  register(id: T_ID, obj: T_Obj): boolean {
    const isNew = !this.store.has(id);
    this.store.set(id, obj);
    return isNew;
  }

  unregister(id: T_ID): boolean {
    return this.store.delete(id);
  }

  get(id: T_ID): T_Obj | undefined {
    return this.store.get(id);
  }

  has(id: T_ID): boolean {
    return this.store.has(id);
  }

  list(): T_ID[] {
    return Array.from(this.store.keys());
  }

  clear(): void {
    this.store.clear();
  }
}

class CellRegistry extends Registry<CellId, Cell> {
  private static instance: CellRegistry | null = null;

  private constructor() {
    super();
  }

  static getInstance(): CellRegistry {
    if (!CellRegistry.instance) {
      CellRegistry.instance = new CellRegistry();
    }
    return CellRegistry.instance;
  }
}

class RowRegistry<T> extends Registry<RowId, Row<T>> {
  private static instance: RowRegistry<any> | null = null;

  private constructor() {
    super();
  }

  static getInstance<T>(): RowRegistry<T> {
    if (!RowRegistry.instance) {
      RowRegistry.instance = new RowRegistry<T>();
    }
    return RowRegistry.instance as RowRegistry<T>;
  }
}

class SpaceRegistry extends Registry<SpaceId, Space> {
  private static instance: SpaceRegistry | null = null;

  private constructor() {
    super();
  }

  static getInstance(): SpaceRegistry {
    if (!SpaceRegistry.instance) {
      SpaceRegistry.instance = new SpaceRegistry();
    }
    return SpaceRegistry.instance;
  }
}

export { CellRegistry, SpaceRegistry, RowRegistry };
