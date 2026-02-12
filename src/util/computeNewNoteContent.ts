import tableFromTimeLog from './tableFromTimeLog.ts';

enum Stage {
	BeforeLog,
	InLog,
	InCalculations,
	AfterCalculations,
}

const computeNewNoteContent = (originalBody: string) => {
	// Break into sections
	const lines = originalBody.split('\n');

	const beforeLog = [];
	const logContent = [];
	const calculationsContent = [];
	let afterCalculations = [];

	let stage: Stage = Stage.BeforeLog;

	let seenTotalLine = false;

	for (const line of lines) {
		const mappedLine = line.toLowerCase().trimEnd();

		if (stage === Stage.BeforeLog) {
			if (mappedLine === '# log') {
				stage = Stage.InLog;
			} else {
				beforeLog.push(line);
			}
		} else if (stage === Stage.InLog) {
			if (mappedLine.match(/^[#]+\s+calc/)) {
				stage = Stage.InCalculations;
			} else {
				logContent.push(line);
			}
		} else if (stage === Stage.InCalculations) {
			const isTotalLine = mappedLine.startsWith('total');
			seenTotalLine ||= isTotalLine;

			if (seenTotalLine && !isTotalLine && mappedLine !== '' && mappedLine !== '|') {
				stage = Stage.AfterCalculations;
				afterCalculations.push(line);
			} else {
				calculationsContent.push(line);
			}
		} else if (stage === Stage.AfterCalculations) {
			afterCalculations.push(line);
		} else {
			const exhaustivenessCheck: never = stage;
			return exhaustivenessCheck;
		}
	}

	// Update the calculations section
	const logText = logContent.join('\n');
	const { table: calculationsTable, totalMinutes, hadWarnings } = tableFromTimeLog(logText);

	if (afterCalculations.length > 0) {
		afterCalculations = ['', ...afterCalculations];
	}

	return {
		newBody: [
			...beforeLog,
			'# Log',
			...logContent,
			'## Calculations',
			'',
			calculationsTable,
			...afterCalculations,
		].join('\n'),
		totalMinutes,
		hadWarnings,
		table: calculationsTable,
	};
};

export default computeNewNoteContent;
