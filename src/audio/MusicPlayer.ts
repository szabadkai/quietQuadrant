// Mock soundtrack imports for test environment
let soundtrackImports: Record<string, { default: string }> = {};

// Only use import.meta.glob in browser environment
if (typeof window !== "undefined") {
    try {
        // @ts-ignore - import.meta.glob is a Vite feature and not available in test environment
        const importMeta = (globalThis as any).import?.meta;
        if (importMeta?.glob) {
            soundtrackImports =
                importMeta.glob("./music/*.{mp3,ogg,wav}", {
                    eager: true,
                }) || {};
        }
    } catch (e) {
        // Fallback if import.meta is not available
        soundtrackImports = {};
    }
}

const SOUNDTRACK_FILES = {
    title: "Juhani Junkala [Retro Game Music Pack] Title Screen.mp3",
    firstLevel: "Juhani Junkala [Retro Game Music Pack] Ending.mp3",
    otherLevels: [
        "Juhani Junkala [Retro Game Music Pack] Level 1.mp3",
        "Juhani Junkala [Retro Game Music Pack] Level 2.mp3",
        "Juhani Junkala [Retro Game Music Pack] Level 3.mp3",
    ],
} as const;

const getTrackUrl = (fileName: string) =>
    (
        soundtrackImports[`./music/${fileName}`] as
            | { default: string }
            | undefined
    )?.default;

const TITLE_TRACK_URL = getTrackUrl(SOUNDTRACK_FILES.title);
const FIRST_LEVEL_TRACK_URL = getTrackUrl(SOUNDTRACK_FILES.firstLevel);
const OTHER_LEVEL_TRACKS = SOUNDTRACK_FILES.otherLevels
    .map((file) => getTrackUrl(file))
    .filter(Boolean) as string[];
const ALL_TRACK_URLS = Object.values(soundtrackImports).map(
    (mod) => (mod as { default: string }).default
);

const shuffle = <T>(arr: T[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

class SoundtrackPlayer {
    private trackUrls: string[] = [];
    private currentIndex = 0;
    private currentElement?: HTMLAudioElement;
    private source?: MediaElementAudioSourceNode;
    private elementVolume = 1;
    private currentTrackUrl?: string;
    private ctx: AudioContext;
    private destination: GainNode;

    constructor(ctx: AudioContext, destination: GainNode) {
        this.ctx = ctx;
        this.destination = destination;
    }

    setTracks(urls: string[]) {
        this.trackUrls = shuffle(urls);
        this.currentIndex = 0;
    }

    playPlaylist(
        urls: string[],
        options?: { shuffle?: boolean; startIndex?: number }
    ) {
        const list = options?.shuffle === false ? [...urls] : shuffle(urls);
        this.trackUrls = list;
        this.currentIndex = Math.max(
            0,
            Math.min(options?.startIndex ?? 0, this.trackUrls.length - 1)
        );
        this.playTrack(this.currentIndex);
    }

    setVolume(volume: number) {
        this.elementVolume = volume;
        if (this.currentElement) {
            this.currentElement.volume = volume;
        }
    }

    play() {
        if (this.trackUrls.length === 0) return;
        if (this.currentElement && !this.currentElement.paused) return;
        this.playTrack(this.currentIndex);
    }

    resumeIfPaused() {
        if (this.currentElement?.paused) {
            this.currentElement.play().catch(() => {});
        }
    }

    private playTrack(index: number) {
        if (this.trackUrls.length === 0) return;
        this.cleanupElement();

        const url = this.trackUrls[index % this.trackUrls.length];
        const el = new Audio(url);
        el.loop = false;
        el.volume = this.elementVolume;
        const source = this.ctx.createMediaElementSource(el);
        source.connect(this.destination);
        el.addEventListener("ended", () => {
            this.cleanupElement();
            if (this.trackUrls.length > 1) {
                this.currentIndex = (index + 1) % this.trackUrls.length;
                this.playTrack(this.currentIndex);
            }
        });
        el.play().catch(() => {
            this.currentIndex = (index + 1) % this.trackUrls.length;
        });
        this.currentElement = el;
        this.source = source;
        this.currentTrackUrl = url;
    }

    private cleanupElement() {
        this.source?.disconnect();
        if (this.currentElement) {
            this.currentElement.pause();
        }
        this.currentElement = undefined;
        this.source = undefined;
        this.currentTrackUrl = undefined;
    }

    getCurrentTrackUrl() {
        return this.currentTrackUrl;
    }
}

export class MusicPlayer {
    private soundtrack?: SoundtrackPlayer;
    private levelPlaylistStarted = false;
    private ctx?: AudioContext;
    private musicGain?: GainNode;

    constructor() {}

    initialize(ctx: AudioContext, musicGain: GainNode) {
        this.ctx = ctx;
        this.musicGain = musicGain;
        this.soundtrack = new SoundtrackPlayer(ctx, musicGain);
    }

    resume() {
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
        this.soundtrack?.resumeIfPaused();
    }

    setVolume(volume: number) {
        this.soundtrack?.setVolume(volume);
    }

    playTitleMusic() {
        this.levelPlaylistStarted = false;
        this.playExclusiveTrack(TITLE_TRACK_URL);
    }

    prepareRunMusic() {
        this.levelPlaylistStarted = false;
    }

    playLevelTrack(waveNumber: number) {
        if (waveNumber <= 1) {
            this.levelPlaylistStarted = false;
            this.playExclusiveTrack(FIRST_LEVEL_TRACK_URL);
            return;
        }
        if (this.levelPlaylistStarted) return;
        if (OTHER_LEVEL_TRACKS.length === 0) return;
        this.resume();
        if (!this.soundtrack) return;
        this.levelPlaylistStarted = true;
        this.soundtrack.playPlaylist([...OTHER_LEVEL_TRACKS], {
            shuffle: false,
            startIndex: 0,
        });
    }

    startSoundtrack() {
        this.resume();
        const hasActiveTrack = !!this.soundtrack?.getCurrentTrackUrl();
        if (!hasActiveTrack) {
            this.playTitleMusic();
        }
    }

    private playExclusiveTrack(url?: string) {
        const resolvedUrl =
            url ??
            FIRST_LEVEL_TRACK_URL ??
            OTHER_LEVEL_TRACKS[0] ??
            TITLE_TRACK_URL ??
            ALL_TRACK_URLS[0];
        if (!resolvedUrl) return;
        this.resume();
        if (!this.soundtrack) return;
        if (this.soundtrack.getCurrentTrackUrl() === resolvedUrl) {
            this.soundtrack.resumeIfPaused();
            return;
        }
        this.soundtrack.playPlaylist([resolvedUrl], {
            shuffle: false,
            startIndex: 0,
        });
    }
}
