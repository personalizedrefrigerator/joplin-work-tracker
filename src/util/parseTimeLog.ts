interface TimeLogEntry {
	line: number;
	counted: boolean;
	hidden: boolean;
	minutes: number;
	runningTotal: number;
	description: string;
}

interface TimeLog {
	entries: TimeLogEntry[];
	warnings: string[];
	totalMinutes: number;
}

/**
 * Converts a list in the form
 * - 1:00-2:00: Message
 * - 2:00-3:00: Another message
 *
 * Into a information about each line.
 */
const parseTimeLog = (timeLog: string): TimeLog => {
	const entries: TimeLogEntry[] = [];

	const warnings: string[] = [];
	const warn = (newLine: string) => {
		warnings.push(`- WARNING: ${newLine}`);
	};

	const lines = timeLog.split('\n');

	const isTimeLogStartLine = (lineNumber: number) => {
		return lineNumber < lines.length && lines[lineNumber].trim().startsWith('-');
	};

	let totalDeltaMinutes = 0;
	let lastHours: number | null = null;
	let isAM = true;
	let lastTime = 0;

	for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
		let line = lines[lineNumber].trim();
		if (!isTimeLogStartLine(lineNumber)) continue;

		// Include lines up to the next time log entry in the current.
		for (
			let nextLineNumber = lineNumber + 1;
			nextLineNumber < lines.length && !isTimeLogStartLine(nextLineNumber);
			nextLineNumber++, lineNumber++
		) {
			const nextLine = lines[nextLineNumber];
			if (nextLine.trim()) {
				line += `\n${nextLine}`;
			}
		}

		// Remove the starting "-" for the entry.
		line = line.replace(/^-\s*/, '');

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

		// @returns time delta in minutes
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
		let hidden = false;

		if (text.startsWith('!')) {
			hidden = true;
		}

		if (text.startsWith('%') || text.startsWith('!')) {
			notCounted = true;
			text = text.substring(1);
		}

		let deltaMinutes = 0;
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
			deltaMinutes += to - from;
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
			// Similarly, leading !s are used to hide entries
			.replace(/^[%!]\s*/, '')
			// Trailing whitespace should be removed
			.trimEnd()
			// We'll be removing newlines (and thus list formatting) so
			// re-format lists ourselves
			.replace(/\n(\s*)\* /g, '\n$1• ')
			// Newlines break tables
			.replace(/\n/g, '<br/>');

		if (!notCounted) {
			totalDeltaMinutes += deltaMinutes;
		}
		entries.push({
			line: lineNumber,
			counted: !notCounted,
			hidden,
			minutes: deltaMinutes,
			runningTotal: totalDeltaMinutes,
			description: lineDescription,
		});

		if (deltaMinutes < 0) {
			warn('Negative delta');
		}

		// Working more than 9 hours in one group is unlikely
		if (deltaMinutes / 60 > 9) {
			warn('Huge delta');
		}
	}

	return {
		entries,
		warnings,
		totalMinutes: totalDeltaMinutes,
	};
};

export default parseTimeLog;
