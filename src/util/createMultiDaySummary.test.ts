import createMultiDaySummary, { DateToMinutes } from './createMultiDaySummary';

describe('createMultiDaySummary', () => {
	test.each([
		{
			dateToMinutes: <DateToMinutes>[
				['2024/10/1', 120],
				['2024/10/2', 240],
			],
			// Should fill final days in the chart with "."s
			expectedTableContent: [
				'| 2024/10/1 - 2024/10/2 | - | - | 2.00 | 4.00 | . | . | . | 6.00 |',
			].join('\n'),
		},
		{
			dateToMinutes: <DateToMinutes>[
				['2024/10/1', 2 * 60],
				['2024/10/2', 4 * 60],
				['2024/10/7', 3 * 60],
				['2024/10/8', 4 * 60],
			],
			// Should skip omitted dates.
			expectedTableContent: [
				'| 2024/10/1 - 2024/10/2 | - | - | 2.00 | 4.00 | _ | _ | _ | 6.00 |',
				'| 2024/10/7 - 2024/10/8 | - | 3.00 | 4.00 | . | . | . | . | 7.00 |',
			].join('\n'),
		},
		{
			dateToMinutes: <DateToMinutes>[
				['2024/10/1', 2 * 60],
				['2024/10/2', 4 * 60],
				['2024/10/14', 3 * 60],
			],
			// Should skip empty weeks
			expectedTableContent: [
				'| 2024/10/1 - 2024/10/2 | - | - | 2.00 | 4.00 | _ | _ | _ | 6.00 |',
				'| 2024/10/14 - 2024/10/14 | - | 3.00 | . | . | . | . | . | 3.00 |',
			].join('\n'),
		},
	])('should build table correctly (case %#)', ({ dateToMinutes, expectedTableContent }) => {
		const result = createMultiDaySummary({ dateToMinutes, hourlyWage: 1 });

		const calendarLines = result.calendarText.split('\n');
		expect(calendarLines[0]).toBe('| Dates | Sun | Mon | Tue | Wed | Thu | Fri | Sat | SUM (hr) |');
		expect(calendarLines[1]).toBe('|--|--|--|--|--|--|--|--|--|');

		const calendarContent = calendarLines.slice(2).join('\n');
		expect(calendarContent).toBe(expectedTableContent);
	});
});
