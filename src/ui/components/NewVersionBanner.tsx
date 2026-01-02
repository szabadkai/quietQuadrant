import { useEffect, useState } from "react";

const STORAGE_KEY = "qq_new_version_banner_dismissed_at";
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const NewVersionBanner = () => {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			const lastDismissed = raw ? Number(raw) : 0;
			if (!lastDismissed || Number.isNaN(lastDismissed)) {
				setVisible(true);
				return;
			}
			setVisible(Date.now() - lastDismissed >= COOLDOWN_MS);
		} catch {
			setVisible(true);
		}
	}, []);

	if (!visible) return null;

	return (
		<div className="version-banner" role="status">
			<span>
				New version available. Visit{" "}
				<a
					href="https://szabadkai.github.io/quietQuadrantv2/"
					target="_blank"
					rel="noreferrer"
				>
					quietQuadrant v2
				</a>
				.
			</span>
			<button
				type="button"
				className="version-banner-close"
				onClick={() => {
					try {
						window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
					} catch {
						// Ignore storage errors; still hide for this session.
					}
					setVisible(false);
				}}
			>
				Got it
			</button>
		</div>
	);
};
