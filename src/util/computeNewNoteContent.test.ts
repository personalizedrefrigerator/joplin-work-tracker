import computeNewNoteContent from './computeNewNoteContent';

describe('computeNewNoteContent', () => {
	it('should preserve post-calculations section and calculate simple duration correctly', () => {
		const newContent = computeNewNoteContent(
			[
				'# Test',
				'Testing...',
				'',
				'# Log',
				'- 1:00-2:00: Something',
				'- 3-4: Test',
				'',
				'## Calculations',
				'',
				'Total 1',
				'',
				'## Scratch',
				'This',
				' Should',
				'   Be',
				'    Preserved',
				'',
			].join('\n'),
		);

		expect(newContent.totalMinutes).toBe(120);
		expect(newContent.hadWarnings).toBe(false);
		expect(newContent.newBody).toContain('Total: 120');
		expect(newContent.newBody).toContain(
			['', '## Scratch', 'This', ' Should', '   Be', '    Preserved'].join('\n'),
		);
	});
});
