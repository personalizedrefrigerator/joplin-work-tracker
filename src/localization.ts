interface AppLocalization {
	hourlyWage: string;
	workTrackerNotebookName: string;
	processWorkLogs: string;
}

const defaultStrings: AppLocalization = {
	workTrackerNotebookName: 'ID of notebook with hour logs',
	processWorkLogs: 'Process work logs',
	hourlyWage: 'Hourly wage',
};

const localizations: Record<string, AppLocalization> = {
	en: defaultStrings,
	es: {
		...defaultStrings,
	},
};

let localization: AppLocalization | undefined;

const languages = [...navigator.languages];
for (const language of navigator.languages) {
	const localeSep = language.indexOf('-');

	if (localeSep !== -1) {
		languages.push(language.substring(0, localeSep));
	}
}

for (const locale of languages) {
	if (locale in localizations) {
		localization = localizations[locale];
		break;
	}
}

if (!localization) {
	console.log('No supported localization found. Falling back to default.');
	localization = defaultStrings;
}

export default localization!;
