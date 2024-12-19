import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import localization from './localization';
import { pluginPrefix } from './constants';
import SettingsManager from './SettingsManager';
import computeNewNoteContent from './util/computeNewNoteContent';
import createMinutesPerDayTable from './util/createMinutesPerDayTable';
import createMultiDaySummary from './util/createMultiDaySummary';

const isMobile = async () => {
	const version = await joplin.versionInfo();
	return 'platform' in version && version['platform'] === 'mobile';
};

const updateNoteContent = async (noteId: string, newContent: string) => {
	await joplin.data.put(['notes', noteId], null, { body: newContent });

	const selectedNoteIds = await joplin.workspace.selectedNoteIds();
	if (selectedNoteIds?.length === 1 && noteId === selectedNoteIds[0]) {
		try {
			await joplin.commands.execute('editor.execCommand', {
				name: 'setText',
				args: [newContent],
			});
		} catch (error) {
			console.log(
				"Failed to set editor content. This can happen if the editor isn't open. Error: ",
				error,
			);
		}
	}
};

joplin.plugins.register({
	onStart: async function () {
		const settingsManager = new SettingsManager();

		const toolbuttonCommand = `${pluginPrefix}processWorkLogs`;

		await joplin.commands.register({
			name: toolbuttonCommand,
			label: localization.processWorkLogs,
			iconName: 'fas fa-briefcase',
			execute: async () => {
				const settings = await settingsManager.getSettings();

				// Get all notes in the target folder
				const parentId = settings.workNotebookId;

				type NoteTitleIdRecord = { title: string; id: string; hrs: number };
				const duplicateNotes: NoteTitleIdRecord[] = [];
				const notesWithWarnings: NoteTitleIdRecord[] = [];
				let totalMinutes = 0;
				const dateToMinutes: Array<[string, number]> = [];
				const dateToTables: Array<[string, string]> = [];

				// Store the summary note ID/text if it already exists
				const summaryNoteTitle = 'Summary';
				let summaryId: string | null = null;

				const notesFetchFields = [
					'id',
					'title',
					'body',
					'is_todo',
					'todo_completed',
					'is_conflict',
				];
				let notes;
				let page = 0;

				const ignoredDates = new Set<string>();
				const seenDates = new Set<string>();

				do {
					notes = await joplin.data.get(['folders', parentId, 'notes'], {
						fields: notesFetchFields,
						page,
					});

					for (const item of notes.items) {
						if (item.is_conflict) {
							continue;
						}

						if (item.title === summaryNoteTitle) {
							summaryId = item.id;
							continue;
						}

						if (
							item.is_todo &&
							!item.todo_completed &&
							item.title.match(/^\s*2\d\d\d[/-]\d+[/-]\d+\s*([*]?)$/)
						) {
							if (seenDates.has(item.title)) {
								const newContent = computeNewNoteContent(item.body);
								duplicateNotes.push({
									title: item.title,
									id: item.id,
									hrs: newContent.totalMinutes / 60,
								});
								continue;
							}
							seenDates.add(item.title);

							const originalBody = item.body;
							const newContent = computeNewNoteContent(originalBody);

							if (newContent.hadWarnings) {
								notesWithWarnings.push({
									title: item.title,
									id: item.id,
									hrs: newContent.totalMinutes / 60,
								});
							}

							const ignored = item.title.endsWith('*');
							const title = !ignored ? item.title : item.title.substring(0, item.title.length - 1);

							if (!ignored) {
								dateToMinutes.push([title, newContent.totalMinutes]);
								totalMinutes += newContent.totalMinutes;
							} else {
								ignoredDates.add(title);
							}

							dateToTables.push([title, newContent.table]);

							if (newContent.newBody !== originalBody) {
								await updateNoteContent(item.id, newContent.newBody);
							}
						}
					}

					page++;
				} while (notes.has_more);

				const sortByDate = (array: Array<[string, any]>) => {
					array.sort((a, b) => {
						return new Date(a[0]).getTime() - new Date(b[0]).getTime();
					});
				};
				sortByDate(dateToMinutes);
				sortByDate(dateToTables);

				if (dateToMinutes.length === 0) {
					alert('No data to process');
					return;
				}

				const { costPerWeekTSV, calendarText, totalWeekSums } = createMultiDaySummary({
					dateToMinutes,
					hourlyWage: settings.hourlyWage,
					linkifyDate: (linkText, date) => {
						return `[${linkText}](#${date.replace(/[-/]/g, '')})`;
					},
				});

				const noteRecordToLink = (note: NoteTitleIdRecord) =>
					`[${note.title} (${Math.floor(note.hrs * 100) / 100} hr)](:/${note.id})`;

				const warningText =
					notesWithWarnings.length > 0
						? `Items with warnings: ${notesWithWarnings.map(noteRecordToLink).join(', ')}`
						: '';

				const duplicatesText =
					duplicateNotes.length > 0
						? `Duplicates: ${duplicateNotes.map(noteRecordToLink).join(', ')}`
						: '';

				const summaryText = [
					`# ${summaryNoteTitle}`,
					'',
					`Total: ${totalMinutes} min = ${totalMinutes / 60} hrs`,
					'',
					'## Raw data',
					'',
					createMinutesPerDayTable(dateToMinutes, settings.hourlyWage),
					'',
					'```text',
					costPerWeekTSV,
					'```',
					'',
					'## Calendar',
					calendarText,
					'',
					`Total: ${Math.floor(totalWeekSums * 100) / 100}`,
					'',
					warningText,
					'',
					duplicatesText,
					'',
					'## Details',
					'',
					dateToTables
						.map((item) => {
							const title = item[0];
							const ignoredText = ignoredDates.has(title) ? ' (ignored)' : '';
							const ignoredLines = ignoredDates.has(title)
								? ['> Not included in this time period.', '']
								: [];

							return [`### ${title}${ignoredText}`, ...ignoredLines, item[1]].join('\n');
						})
						.join('\n\n'),
					'',
				].join('\n');

				if (summaryId === null) {
					await joplin.data.post(['notes'], null, {
						title: 'Summary',
						body: summaryText,
						parent_id: parentId,
					});
				} else {
					await joplin.data.put(['notes', summaryId], null, { body: summaryText });
				}
			},
		});

		// Add to the edit menu. This allows users to assign a custom keyboard shortcut to the action.
		const toolMenuInsertDrawingButtonId = `${pluginPrefix}processWorkLogsButton`;
		await joplin.views.menuItems.create(
			toolMenuInsertDrawingButtonId,
			toolbuttonCommand,
			MenuItemLocation.Edit,
		);

		// Mobile doesn't have access to the edit menu
		if (await isMobile()) {
			await joplin.views.toolbarButtons.create(
				`${pluginPrefix}processWorkLogsToolbarButton`,
				toolbuttonCommand,
				ToolbarButtonLocation.NoteToolbar,
			);
		}
	},
});
