export const isMobileBrowser = () => {
	if (typeof navigator === "undefined") return false;
	const ua = navigator.userAgent || navigator.vendor;
	const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
	return (
		coarse ||
		/android|iphone|ipad|ipod|iemobile|opera mini|blackberry|webos/i.test(ua)
	);
};

export const lockLandscapeOrientation = async () => {
	if (typeof screen === "undefined") return false;
	try {
		const orientation = (
			screen as unknown as {
				orientation?: { lock?: (type: "landscape") => Promise<void> };
			}
		).orientation;
		if (orientation && typeof orientation.lock === "function") {
			await orientation.lock("landscape");
			return true;
		}
	} catch {
		// Some browsers reject without a user gesture; fall back silently.
	}
	return false;
};

export const isPortrait = () =>
	window.matchMedia?.("(orientation: portrait)")?.matches ?? false;
