import parseTimeLog from './parseTimeLog';

describe('parseTimeLog', () => {
	test('should parse a simple example', () => {
		expect(
			parseTimeLog(['- 1:00-2:00: Message', '- 2:00-3:00: Another message'].join('\n')),
		).toMatchObject({
			entries: [
				{
					line: 0,
					counted: true,
					minutes: 60,
					runningTotal: 60,
					description: '1:00-2:00: Message',
				},
				{
					line: 1,
					counted: true,
					minutes: 60,
					runningTotal: 120,
					description: '2:00-3:00: Another message',
				},
			],
		});
	});

	test('should handle multiple items on the same line', () => {
		expect(
			parseTimeLog(['- 1:00-2:00, 2:10-2:11: Message', '- 2:12-3:12: Another message'].join('\n')),
		).toMatchObject({
			entries: [
				{ line: 0, minutes: 61, runningTotal: 61 },
				{ line: 1, minutes: 60, runningTotal: 121 },
			],
		});
	});

	test('should handle items marked as not counted', () => {
		expect(
			parseTimeLog(['- %1:00-2:00, 2:10-2:11: Message', '- 2:12-3:12: Another message'].join('\n')),
		).toMatchObject({
			entries: [
				{ line: 0, minutes: 61, runningTotal: 0, counted: false },
				{ line: 1, minutes: 60, runningTotal: 60, counted: true },
			],
		});
	});

	test('should mark hidden entries as hidden', () => {
		expect(
			parseTimeLog(['- !1:00-1:01: Hidden!', '- 2:12-3:12: Not hidden'].join('\n')),
		).toMatchObject({
			entries: [
				{ line: 0, minutes: 1, runningTotal: 0, counted: false, hidden: true },
				{ line: 1, minutes: 60, runningTotal: 60, counted: true },
			],
		});
	});

	test('should handle incomplete items', () => {
		const timeLog = parseTimeLog(['- 1:00-2:00: First', '- 2:01-'].join('\n'));

		expect(timeLog).toMatchObject({
			entries: [
				{ line: 0, minutes: 60, runningTotal: 60, counted: true, hidden: false },
				{ line: 1, minutes: 0, runningTotal: 60, counted: true },
			],
		});

		expect(timeLog.warnings).toHaveLength(1);
		expect(timeLog.warnings[0]).toMatch(/Line missing end time/);
	});
});
