import dateStringToDate from './dateStringToDate';

describe('dateStringToDate', () => {
	test('should convert date strings to dates', () => {
		const date = dateStringToDate('2024/10/01');
		expect(date.getUTCDate()).toBe(1); // 1st of the month
		expect(date.getUTCDay()).toBe(2); // Tuesday
		expect(date.getUTCMonth() + 1).toBe(10); // October
		expect(date.getUTCFullYear()).toBe(2024); // Tuesday
	});
});
