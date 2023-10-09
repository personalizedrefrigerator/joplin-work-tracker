import joplin from 'api';
import localization from './localization';
import { SettingItemType, SettingStorage } from 'api/types';

export interface Settings {
	readonly workNotebookId: string;
	readonly hourlyWage: number;
}

type SettingsChangeListener = (settings: Settings) => void;

/** Returns `true` iff `a` and `b` are equivalent. */
const settingsEqual = (a: Settings | null, b: Settings | null) => {
	if (a === null || b === null) {
		return a === b;
	}

	if (a.workNotebookId !== b.workNotebookId) {
		return false;
	}

	return true;
};

export default class SettingsManager {
	private settings: Settings | null = null;
	private settingsChangeListeners: SettingsChangeListener[] = [];

	public constructor() {
		void this.registerAndApplySettings();
	}

	/**
	 * Adds a listener that is called both **now** and when settings next change
	 * (or is defered if settings haven't loaded yet).
	 */
	public onSettingsChangeAndNow(listener: SettingsChangeListener) {
		if (!this.settingsChangeListeners.includes(listener)) {
			this.settingsChangeListeners.push(listener);
		}

		if (this.settings) {
			listener(this.settings);
		}

		return {
			remove: () => {
				this.settingsChangeListeners = this.settingsChangeListeners.filter((other) => {
					return other !== listener;
				});
			},
		};
	}

	public getSettings(): Promise<Settings> {
		return new Promise<Settings>((resolve) => {
			let resolved = false;
			const listener = this.onSettingsChangeAndNow((settings) => {
				if (resolved) return;

				resolved = true;
				resolve(settings);

				// Remove the listener, but after onSettingsChangeAndNow returns
				setTimeout(() => {
					listener.remove();
				}, 0);
			});
		});
	}

	private async registerAndApplySettings() {
		// Joplin adds a prefix to the setting in settings.json for us.
		const workNotebookKey = 'work-notebook';
		const wageKey = 'work-wage';

		const applySettings = async () => {
			const workNotebookId = await joplin.settings.value(workNotebookKey);
			const hourlyWage = await joplin.settings.value(wageKey);

			const newSettings = { workNotebookId, hourlyWage };
			if (!settingsEqual(this.settings, newSettings)) {
				this.settings = newSettings;
				this.settingsChangeListeners.forEach((listener) => listener(newSettings));
			}
		};

		const sectionName = 'work-tracker';
		await joplin.settings.registerSection(sectionName, {
			label: 'Work tracker',
			iconName: 'fas fa-briefcase',
			description: 'Track the hours you work.',
		});

		// Editor fullscreen setting
		await joplin.settings.registerSettings({
			[workNotebookKey]: {
				public: true,
				section: sectionName,

				label: localization.workTrackerNotebookName,
				storage: SettingStorage.File,

				type: SettingItemType.String,
				value: '',
			},
			[wageKey]: {
				public: true,
				section: sectionName,

				label: localization.hourlyWage,
				storage: SettingStorage.Database,

				type: SettingItemType.Int,
				value: 38,
			},
		});

		await joplin.settings.onChange((_event) => {
			void applySettings();
		});

		await applySettings();
	}
}
