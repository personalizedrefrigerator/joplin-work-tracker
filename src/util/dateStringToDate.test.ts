import dateStringToDate from './dateStringToDate.ts';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

describe('dateStringToDate', () => {
	test('should convert date strings to dates', () => {
		const date = dateStringToDate('2024/10/01');
		assert.equal(date.getUTCDate(), 1); // 1st of the month
		assert.equal(date.getUTCDay(), 2); // Tuesday
		assert.equal(date.getUTCMonth() + 1, 10); // October
		assert.equal(date.getUTCFullYear(), 2024); // Tuesday
	});
});
