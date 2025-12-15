const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class Prng {
	private state: number;

	constructor(seed: number) {
		// Avoid a zeroed state so the generator advances.
		this.state = seed >>> 0 || 1;
	}

	next() {
		// Mulberry32
		let t = (this.state += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	nextInt(maxExclusive: number) {
		if (maxExclusive <= 0) return 0;
		return Math.floor(this.next() * maxExclusive);
	}
}

export const hashSeed = (seed: string) => {
	// FNV-1a 32-bit
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
};

export const getWeeklySeed = (now = Date.now()) => {
	const weekIndex = Math.floor(now / WEEK_MS);
	const seedId = `week-${weekIndex}`;
	const seedValue = hashSeed(seedId) || 1;
	return { seedId, seedValue };
};

export const pickFromList = <T>(items: T[], rng: Prng): T => {
	if (items.length === 0) {
		throw new Error("pickFromList called with empty list");
	}
	return items[rng.nextInt(items.length)];
};
