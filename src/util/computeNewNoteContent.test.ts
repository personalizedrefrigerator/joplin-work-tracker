import computeNewNoteContent from './computeNewNoteContent.ts';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

describe('computeNewNoteContent', () => {
	test('should preserve post-calculations section and calculate simple duration correctly', () => {
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

		assert.equal(newContent.totalMinutes, 120);
		assert.equal(newContent.hadWarnings, false);
		assert.ok(newContent.newBody.includes('Total: 120'));
		assert.ok(newContent.newBody.includes(
			['', '## Scratch', 'This', ' Should', '   Be', '    Preserved'].join('\n'),
		));
	});
});
