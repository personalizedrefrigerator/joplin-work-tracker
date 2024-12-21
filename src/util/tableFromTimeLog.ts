import parseTimeLog from './parseTimeLog';

/**
 * Converts a list in the form
 * - 1:00-2:00: Message
 * - 2:00-3:00: Another message
 *
 * Into a table with a sum.
 */
const tableFromTimeLog = (timeLog: string) => {
	const parsedLog = parseTimeLog(timeLog);

	const mainResult: string[] = [];
	const warnings: string[] = parsedLog.warnings;
	const log = (newLine: string) => {
		mainResult.push(newLine);
	};

	const deltaHeader = 'Time delta';
	log(`| ${deltaHeader} | Description |`);
	log(`|-${'-'.repeat(deltaHeader.length)}-|-------------|`);

	for (const entry of parsedLog.entries) {
		if (entry.hidden) continue;

		const minutes = entry.minutes;
		const notCounted = !entry.counted;
		const minutesColumn = `${Math.floor(minutes / 60)}:${minutes % 60}`;
		const spacing = ' '.repeat(Math.max(0, deltaHeader.length - minutesColumn.length));
		log(
			`| ${minutesColumn}${spacing} | ${notCounted ? '**Not counted**: ' : ''}${
				entry.description
			} |`,
		);
	}

	if (warnings.length > 0) {
		log(`\n\n**Warnings**:\n${warnings.join('\n')}\n\n`);
	}

	log('');
	log(
		`Total: ${parsedLog.totalMinutes} mins = ${
			Math.floor((parsedLog.totalMinutes / 60) * 10) / 10
		} hours`,
	);

	const resultText = mainResult.join('\n');

	return {
		table: resultText,
		hadWarnings: warnings.length > 0,
		totalMinutes: parsedLog.totalMinutes,
	};
};

export default tableFromTimeLog;
