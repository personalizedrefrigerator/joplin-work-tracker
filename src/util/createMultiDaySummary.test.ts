import createMultiDaySummary from './createMultiDaySummary.ts';
import type { DateToMinutes } from './createMultiDaySummary.ts';

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

describe('createMultiDaySummary', () => {
	let i = 0;
	for (const { dateToMinutes, expectedTableContent } of [
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
	]) {
		test(`should build table correctly (case ${++i})`, () => {
			const result = createMultiDaySummary({ dateToMinutes, hourlyWage: 1 });

			const calendarLines = result.calendarText.split('\n');
			assert.equal(calendarLines[0], '| Dates | Sun | Mon | Tue | Wed | Thu | Fri | Sat | SUM (hr) |');
			assert.equal(calendarLines[1], '|--|--|--|--|--|--|--|--|--|');

			const calendarContent = calendarLines.slice(2).join('\n');
			assert.equal(calendarContent, expectedTableContent);
		});
	}
});
