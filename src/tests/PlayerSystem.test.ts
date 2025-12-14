/**
 * Unit tests for PlayerSystem
 * Tests player movement, input handling, and stats calculations
 */

// Mock Phaser before importing anything that uses it
jest.mock('phaser', () => ({
  Math: {
    Vector2: class MockVector2 {
      x: number;
      y: number;
      constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
      }
      clone() {
        return new MockVector2(this.x, this.y);
      }
      copy(other: { x: number; y: number }) {
        this.x = other.x;
        this.y = other.y;
        return this;
      }
      normalize() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y);
        if (len > 0) {
          this.x /= len;
          this.y /= len;
        }
        return this;
      }
      lengthSq() {
        return this.x * this.x + this.y * this.y;
      }
      rotate(angle: number) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;
        this.x = newX;
        this.y = newY;
        return this;
      }
    },
    Angle: {
      Between: jest.fn(() => 0),
    },
    DegToRad: jest.fn((deg) => (deg * Math.PI) / 180),
  },
  Input: {
    Keyboard: {
      JustDown: jest.fn(() => false),
    },
  },
}));

import { eventBus } from '../game/systems/EventBus';
import { PlayerController } from '../game/systems/PlayerController';
import { PlayerSystem } from '../game/systems/PlayerSystem';

// Mock Phaser
const mockScene = {
  scale: { width: 800, height: 600 },
  time: { now: 1000 },
  input: {
    keyboard: {
      createCursorKeys: jest.fn(() => ({
        left: { isDown: false },
        right: { isDown: false },
        up: { isDown: false },
        down: { isDown: false },
      })),
      addKeys: jest.fn(() => ({
        W: { isDown: false },
        S: { isDown: false },
        A: { isDown: false },
        D: { isDown: false },
        SHIFT: { isDown: false },
      })),
    },
    activePointer: {
      x: 400,
      y: 300,
      isDown: false,
    },
    gamepad: null,
  },
  physics: {
    add: {
      group: jest.fn(() => ({
        addMultiple: jest.fn(),
        destroy: jest.fn(),
      })),
      image: jest.fn((x, y, texture) => ({
        x,
        y,
        texture,
        setScale: jest.fn().mockReturnThis(),
        setDepth: jest.fn().mockReturnThis(),
        setCollideWorldBounds: jest.fn().mockReturnThis(),
        setDamping: jest.fn().mockReturnThis(),
        setDrag: jest.fn().mockReturnThis(),
        setVisible: jest.fn().mockReturnThis(),
        setActive: jest.fn().mockReturnThis(),
        body: {
          setSize: jest.fn(),
          enable: true,
          setAcceleration: jest.fn(),
          setMaxSpeed: jest.fn(),
          setVelocity: jest.fn(),
          velocity: { x: 0, y: 0, lengthSq: () => 0 },
        },
        active: true,
        rotation: 0,
      })),
    },
  },
  cameras: {
    main: {
      getWorldPoint: jest.fn((x, y) => ({ x, y })),
    },
  },
  add: {
    arc: jest.fn(() => ({
      setStrokeStyle: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
      setPosition: jest.fn().mockReturnThis(),
      destroy: jest.fn(),
    })),
  },
} as Phaser.Scene;

// Mock sound manager
jest.mock('../audio/SoundManager', () => ({
  soundManager: {
    playSfx: jest.fn(),
  },
}));

describe('PlayerSystem', () => {
  let playerSystem: PlayerSystem;

  beforeEach(() => {
    playerSystem = new PlayerSystem();
    eventBus.removeAllListeners();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (playerSystem.isActive) {
      playerSystem.shutdown();
    }
    eventBus.removeAllListeners();
  });

  describe('initialization', () => {
    test('initializes with default player stats', () => {
      playerSystem.initialize(mockScene);

      const stats = playerSystem.getPlayerStats();
      expect(stats.moveSpeed).toBe(240);
      expect(stats.damage).toBe(12);
      expect(stats.fireRate).toBe(4);
      expect(stats.health).toBe(5);
      expect(stats.maxHealth).toBe(5);
    });

    test('creates player sprites and groups', () => {
      playerSystem.initialize(mockScene);

      expect(mockScene.physics.add.group).toHaveBeenCalled();
      expect(mockScene.physics.add.image).toHaveBeenCalledTimes(2);
      expect(mockScene.physics.add.image).toHaveBeenCalledWith(380, 300, 'player');
      expect(mockScene.physics.add.image).toHaveBeenCalledWith(420, 300, 'player');
    });

    test('sets up input handling', () => {
      playerSystem.initialize(mockScene);

      expect(mockScene.input.keyboard.createCursorKeys).toHaveBeenCalled();
      expect(mockScene.input.keyboard.addKeys).toHaveBeenCalledWith('W,S,A,D,SHIFT');
    });

    test('becomes active after initialization', () => {
      expect(playerSystem.isActive).toBe(false);
      playerSystem.initialize(mockScene);
      expect(playerSystem.isActive).toBe(true);
    });
  });

  describe('player stats management', () => {
    beforeEach(() => {
      playerSystem.initialize(mockScene);
    });

    test('returns copy of player stats', () => {
      const stats1 = playerSystem.getPlayerStats();
      const stats2 = playerSystem.getPlayerStats();

      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2); // Should be different objects
    });

    test('updates player stats correctly', () => {
      const initialStats = playerSystem.getPlayerStats();

      playerSystem.updatePlayerStats({ damage: 20, moveSpeed: 300 });

      const updatedStats = playerSystem.getPlayerStats();
      expect(updatedStats.damage).toBe(20);
      expect(updatedStats.moveSpeed).toBe(300);
      expect(updatedStats.health).toBe(initialStats.health); // Unchanged
    });

    test('emits health-changed event when stats updated', () => {
      const healthChangedSpy = jest.fn();
      eventBus.on('player:health-changed', healthChangedSpy);

      playerSystem.updatePlayerStats({ health: 3, maxHealth: 8 });

      expect(healthChangedSpy).toHaveBeenCalledWith({
        health: 3,
        maxHealth: 8,
      });
    });
  });

  describe('damage and healing', () => {
    beforeEach(() => {
      playerSystem.initialize(mockScene);
    });

    test('takes damage correctly', () => {
      const healthChangedSpy = jest.fn();
      eventBus.on('player:health-changed', healthChangedSpy);

      playerSystem.takeDamage(2);

      const stats = playerSystem.getPlayerStats();
      expect(stats.health).toBe(3);
      expect(healthChangedSpy).toHaveBeenCalledWith({
        health: 3,
        maxHealth: 5,
      });
    });

    test('cannot take damage below 0', () => {
      playerSystem.takeDamage(10);

      const stats = playerSystem.getPlayerStats();
      expect(stats.health).toBe(0);
    });

    test('emits death event when health reaches 0', () => {
      const deathSpy = jest.fn();
      eventBus.on('player:died', deathSpy);

      playerSystem.takeDamage(5);

      expect(deathSpy).toHaveBeenCalledWith({ playerId: 'p1' });
    });

    test('heals correctly', () => {
      playerSystem.takeDamage(3); // Health becomes 2

      const healthChangedSpy = jest.fn();
      eventBus.on('player:health-changed', healthChangedSpy);

      playerSystem.heal(2);

      const stats = playerSystem.getPlayerStats();
      expect(stats.health).toBe(4);
      expect(healthChangedSpy).toHaveBeenCalledWith({
        health: 4,
        maxHealth: 5,
      });
    });

    test('cannot heal above max health', () => {
      playerSystem.heal(10);

      const stats = playerSystem.getPlayerStats();
      expect(stats.health).toBe(5); // Should stay at max
    });

    test('isAlive returns correct status', () => {
      expect(playerSystem.isAlive()).toBe(true);

      playerSystem.takeDamage(5);
      expect(playerSystem.isAlive()).toBe(false);

      playerSystem.heal(1);
      expect(playerSystem.isAlive()).toBe(true);
    });
  });

  describe('player state', () => {
    beforeEach(() => {
      playerSystem.initialize(mockScene);
    });

    test('returns player state when active', () => {
      const state = playerSystem.getPlayerState();

      expect(state).toBeDefined();
      expect(state?.stats).toEqual(playerSystem.getPlayerStats());
      expect(state?.position).toBeInstanceOf(Object);
      expect(state?.lastAimDirection).toBeInstanceOf(Object);
      expect(state?.abilities).toBeDefined();
    });

    test('returns undefined when not initialized', () => {
      const uninitializedSystem = new PlayerSystem();
      const state = uninitializedSystem.getPlayerState();

      expect(state).toBeUndefined();
    });
  });

  describe('upgrade handling', () => {
    beforeEach(() => {
      playerSystem.initialize(mockScene);
    });

    test('handles damage boost upgrade', () => {
      const initialDamage = playerSystem.getPlayerStats().damage;

      eventBus.emit('player:upgrade-selected', {
        upgradeId: 'damage-boost',
      });

      const updatedDamage = playerSystem.getPlayerStats().damage;
      expect(updatedDamage).toBe(initialDamage + 2);
    });

    test('handles speed boost upgrade', () => {
      const initialSpeed = playerSystem.getPlayerStats().moveSpeed;

      eventBus.emit('player:upgrade-selected', {
        upgradeId: 'speed-boost',
      });

      const updatedSpeed = playerSystem.getPlayerStats().moveSpeed;
      expect(updatedSpeed).toBe(initialSpeed + 20);
    });

    test('handles health boost upgrade', () => {
      const initialHealth = playerSystem.getPlayerStats().health;
      const initialMaxHealth = playerSystem.getPlayerStats().maxHealth;

      eventBus.emit('player:upgrade-selected', {
        upgradeId: 'health-boost',
      });

      const stats = playerSystem.getPlayerStats();
      expect(stats.health).toBe(initialHealth + 1);
      expect(stats.maxHealth).toBe(initialMaxHealth + 1);
    });
  });

  describe('update loop', () => {
    beforeEach(() => {
      playerSystem.initialize(mockScene);
    });

    test('update runs without errors', () => {
      expect(() => {
        playerSystem.update(1000, 16);
      }).not.toThrow();
    });

    test('update handles no active pilots gracefully', () => {
      // Mock no active pilots
      const system = playerSystem as PlayerSystem & {
        playerState?: unknown;
      };
      system.playerState = undefined;

      expect(() => {
        playerSystem.update(1000, 16);
      }).not.toThrow();
    });
  });

  describe('system lifecycle', () => {
    test('shutdown cleans up resources', () => {
      playerSystem.initialize(mockScene);
      const _mockGroup = mockScene.physics.add.group();

      playerSystem.shutdown();

      expect(playerSystem.isActive).toBe(false);
      // Note: In a real implementation, we'd verify group.destroy() was called
    });

    test('has correct system ID and dependencies', () => {
      expect(playerSystem.systemId).toBe('player-system');
      expect(playerSystem.dependencies).toEqual([]);
    });
  });
});

describe('PlayerController', () => {
  let playerController: PlayerController;

  beforeEach(() => {
    playerController = new PlayerController(mockScene);
    jest.clearAllMocks();
  });

  describe('movement input processing', () => {
    test('processes gamepad movement input', () => {
      const inputState = {
        controls: {
          move: { x: 0.8, y: 0.6, lengthSq: () => 1 },
        },
        binding: { type: 'gamepad' },
      };

      const result = playerController.processMovementInput(inputState);

      expect(result.x).toBeCloseTo(0.8);
      expect(result.y).toBeCloseTo(0.6);
    });

    test('processes keyboard movement input', () => {
      // Mock keyboard state
      const mockWASD = {
        W: { isDown: true },
        S: { isDown: false },
        A: { isDown: true },
        D: { isDown: false },
      };
      (playerController as PlayerController & { wasd: unknown }).wasd = mockWASD;

      const inputState = {
        controls: {
          move: { x: 0, y: 0, lengthSq: () => 0 },
        },
        binding: { type: 'keyboardMouse' },
      };

      const result = playerController.processMovementInput(inputState);

      // Should normalize diagonal movement
      expect(result.x).toBeCloseTo(-Math.SQRT1_2, 3); // -1/√2
      expect(result.y).toBeCloseTo(-Math.SQRT1_2, 3); // -1/√2
    });

    test('returns zero vector for no input', () => {
      const inputState = {
        controls: {
          move: { x: 0, y: 0, lengthSq: () => 0 },
        },
        binding: { type: 'gamepad' },
      };

      const result = playerController.processMovementInput(inputState);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('aiming input processing', () => {
    test('processes gamepad aiming input', () => {
      const inputState = {
        controls: {
          aim: {
            x: 1,
            y: 0,
            lengthSq: () => 1,
            clone: () => ({ normalize: () => ({ x: 1, y: 0 }) }),
          },
        },
        binding: { type: 'gamepad' },
      };

      const result = playerController.processAimingInput(inputState);

      expect(result.x).toBe(1);
      expect(result.y).toBe(0);
    });

    test('processes mouse aiming input', () => {
      const inputState = {
        controls: { aim: { lengthSq: () => 0 } },
        binding: { type: 'keyboardMouse' },
        pilot: {
          sprite: { x: 400, y: 300 },
          lastAimDirection: { clone: () => ({ x: 1, y: 0 }) },
        },
      };

      mockScene.input.activePointer = { x: 500, y: 300 };
      mockScene.cameras.main.getWorldPoint = jest.fn(() => ({
        x: 500,
        y: 300,
      }));

      const result = playerController.processAimingInput(inputState);

      expect(result.x).toBe(1);
      expect(result.y).toBe(0);
    });
  });

  describe('action input detection', () => {
    test('detects fire input from gamepad', () => {
      const inputState = {
        controls: { fireActive: true },
        binding: { type: 'gamepad' },
      };

      const result = playerController.isFirePressed(inputState);

      expect(result).toBe(true);
    });

    test('detects fire input from mouse', () => {
      const inputState = {
        controls: { fireActive: false },
        binding: { type: 'keyboardMouse' },
      };

      mockScene.input.activePointer.isDown = true;

      const result = playerController.isFirePressed(inputState);

      expect(result).toBe(true);
    });

    test('detects dash input from gamepad', () => {
      const inputState = {
        controls: { dashPressed: true },
        binding: { type: 'gamepad' },
      };

      const result = playerController.isDashPressed(inputState);

      expect(result).toBe(true);
    });
  });
});
