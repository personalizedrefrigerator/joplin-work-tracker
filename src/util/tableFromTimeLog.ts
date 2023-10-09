/**
 * Converts a list in the form
 * - 1:00-2:00: Message
 * - 2:00-3:00: Another message
 *
 * Into a table with a sum.
 */
const tableFromTimeLog = (timeLog: string) => {
	const mainResult: string[] = [];
	const warnings: string[] = [];
	const log = (newLine: string) => {
		mainResult.push(newLine);
	};
	const warn = (newLine: string) => {
		warnings.push(`- WARNING: ${newLine}`);
	};

	log('| Time delta | Description |');
	log('|---|---|');

	const lines = timeLog
		.split(/(?:[\n]|^)\s*[-]\s*/g)
		.filter((part) => part.trim() !== '' && part !== '&nbsp;');

	let totalDelta = 0;
	let lastHours: number | null = null;
	let isAM = true;
	let lastTime = 0;

	for (const line of lines) {
		const mainTimeExp = /^(\d+)(:\d{2})?\s*(AM|PM)?/i;

		const toMinutes = (hrs: number, mins: number) => {
			if (hrs === 12) {
				hrs = 0;
			}

			if (!isAM) {
				hrs += 12;
			}

			let time = hrs * 60 + mins;

			// Handle midnight.
			if (time < lastTime) {
				time += 12 * 60;
			}
			lastTime = time;
			return time;
		};

		// Returns time delta in minutes
		const timeFrom = (text: string) => {
			// Just numeric?
			if (/^\d+$/.exec(text)) {
				let time = parseInt(text);
				return toMinutes(time, 0);
			} else {
				const timeMatch = mainTimeExp.exec(text);

				if (!timeMatch) {
					warn(
						'No match for content: ' +
							JSON.stringify({
								text,
								line,
							}),
					);
					return 0;
				}

				const AMPMMatch = timeMatch[3];
				let hours = parseInt(timeMatch[1]);
				const minutes = timeMatch[2] != null ? parseInt(timeMatch[2].substring(1)) : 0;

				if (AMPMMatch?.toUpperCase() === 'AM') {
					isAM = true;
				} else if (AMPMMatch?.toUpperCase() === 'PM') {
					isAM = false;
				} else if (isAM && lastHours && lastHours > hours) {
					// Switched from AM to PM
					isAM = false;
				} else if (isAM && lastHours && hours === 12 && lastHours !== 12) {
					isAM = false;
				}

				lastHours = hours === 12 ? 0 : hours;
				return toMinutes(hours, minutes);
			}
		};

		const startTimeExp = /^\s*([0-9:AMPMampm ]+[-][0-9:AMPMampm ]+),\s*/;
		let text = line;
		let match;
		let notCounted = false;

		if (text.startsWith('%')) {
			notCounted = true;
			text = text.substring(1);
		}

		let delta = 0;
		const process = (part: string) => {
			const sep = part.indexOf('-');

			if (sep === -1) {
				warn('Line missing - separator: ' + line + ', text: ' + text);
				return;
			}

			const preSep = part.substring(0, sep).trim();
			const postSep = part.substring(sep + 1).trim();

			const from = timeFrom(preSep);
			const to = timeFrom(postSep);
			delta += to - from;
		};

		// eslint-disable-next-line no-cond-assign
		while ((match = text.match(startTimeExp))) {
			text = text.substring(match[0].length);
			const currentPart = match[1];
			process(currentPart);
		}

		process(text);

		const lineDescription = line
			// Leading %s are used to mark as not conted (UI feedback already shown)
			.replace(/^%\s*/, '')
			// Trailing whitespace should be removed
			.trimEnd()
			// We'll be removing newlines (and thus list formatting) so
			// re-format lists ourselves
			.replace(/\n(\s*)\* /g, '\n$1• ')
			// Newlines break tables
			.replace(/\n/g, '<br/>');

		log(
			`| ${Math.floor(delta / 60)}:${delta % 60} | ${
				notCounted ? '**Not counted**: ' : ''
			}${lineDescription} |`,
		);

		if (delta < 0) {
			warn('Negative delta');
		}

		// Working more than 9 hours in one group is unlikely
		if (delta / 60 > 9) {
			warn('Huge delta');
		}

		if (!notCounted) {
			totalDelta += delta;
		}
	}

	if (warnings.length > 0) {
		log(`\n\n**Warnings**:\n${warnings.join('\n')}\n\n`);
	}

	log('');
	log(`Total: ${totalDelta} mins = ${Math.floor((totalDelta / 60) * 10) / 10} hours`);

	const resultText = mainResult.join('\n');

	return {
		table: resultText,
		hadWarnings: warnings.length > 0,
		totalMinutes: totalDelta,
	};
};

export default tableFromTimeLog;
