import type { SpaceRegistry } from "./Registries";
import type { SpaceId, Space } from "./types";

export class SpaceCoordinator {
  private static instance: SpaceCoordinator | null = null;
  private registry: SpaceRegistry;

  private constructor(registry: SpaceRegistry) {
    this.registry = registry;
  }

  static getInstance(registry: SpaceRegistry): SpaceCoordinator {
    if (!SpaceCoordinator.instance) {
      SpaceCoordinator.instance = new SpaceCoordinator(registry);
    }
    return SpaceCoordinator.instance;
  }

  // Link two spaces vertically: top <-> bottom
  linkVertical(topId: SpaceId, bottomId: SpaceId): void {
    const topSpace = this.registry.get(topId);
    const bottomSpace = this.registry.get(bottomId);
    if (!topSpace || !bottomSpace) return;

    topSpace.bottom = bottomId;
    bottomSpace.top = topId;

    this.registry.register(topId, topSpace);
    this.registry.register(bottomId, bottomSpace);
  }

  // Create a new space for a plugin and link it to the bottom of the chain
  createPluginSpace(pluginName: string): SpaceId {
    const spaceId = `space-${pluginName}`;
    
    const newSpace: Space = {
      name: `${pluginName} Space`,
      owner: pluginName,
      top: null,
      bottom: null,
      rowIds: [] // Initialize empty rowIds array
    };

    // Find the bottom-most space
    const allSpaces = this.registry.list();
    let bottomSpaceId: SpaceId | null = null;
    
    for (const id of allSpaces) {
      const space = this.registry.get(id);
      if (space && !space.bottom) {
        bottomSpaceId = id;
        break;
      }
    }

    // Register the new space
    this.registry.register(spaceId, newSpace);

    // Link to bottom if there's an existing bottom space
    if (bottomSpaceId) {
      this.linkVertical(bottomSpaceId, spaceId);
    }

    return spaceId;
  }

  // Get the space above this one
  getSpaceAbove(spaceId: SpaceId): SpaceId | null {
    const space = this.registry.get(spaceId);
    return space?.top || null;
  }

  // Get the space below this one
  getSpaceBelow(spaceId: SpaceId): SpaceId | null {
    const space = this.registry.get(spaceId);
    return space?.bottom || null;
  }
}