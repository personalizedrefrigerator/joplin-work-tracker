import joplin from 'api';
import { MenuItemLocation } from 'api/types';
import localization from './localization';
import { pluginPrefix } from './constants';
import SettingsManager from './SettingsManager';
import computeNewNoteContent from './util/computeNewNoteContent';
import createMinutesPerDayTable from './util/createMinutesPerDayTable';

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
				let summaryPrevText: string = '';

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
							summaryPrevText = item.body;
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
								await joplin.data.put(['notes', item.id], null, { body: newContent.newBody });
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

				const calendarHeader = [
					`| Dates | Sun | Mon | Tue | Wed | Thu | Fri | Sat | SUM (hr) |`,
					'|--|--|--|--|--|--|--|--|--|',
				];
				const calendarText = [...calendarHeader];
				const firstDayOfMonth = new Date(dateToMinutes[0][0]).getUTCDate();

				// Add empty rows for each non-tracked date
				for (let i = 7; i <= firstDayOfMonth; i += 7) {
					calendarText.push('| - | - | - | - | - | - | - | - | - |');
				}

				const dateTime = (date: string) => {
					return new Date(date).getTime();
				};

				const costPerWeekTSV = ['\t\t\tHours\tCost'];
				let weekNum = 0;
				let sumForPastFewWeeks = 0;

				// Fill the table
				let totalWeekSums = 0;
				let i = 0;
				while (i < dateToMinutes.length) {
					const startDateString = dateToMinutes[i][0];
					const currentDate = new Date(startDateString);
					const currentDayOfWeek = currentDate.getUTCDay();

					let hoursInWeek = 0;
					let weekLine = '|';
					for (let j = 0; j < currentDayOfWeek; j++) {
						weekLine += ' - |';
					}

					let lastDateString = startDateString;
					for (let j = currentDayOfWeek; j < 7; i++, j++) {
						if (i >= dateToMinutes.length) {
							weekLine += ' . |';
						} else {
							const minutes = dateToMinutes[i][1];
							const hours = minutes / 60;
							hoursInWeek += hours;
							weekLine += ` ${Math.floor(hours * 10) / 10} |`;
							lastDateString = dateToMinutes[i][0];
						}

						if (j + 1 < 7 && i + 1 < dateToMinutes.length) {
							const nowTime = dateTime(dateToMinutes[i][0]);
							const nextTime = dateTime(dateToMinutes[i + 1][0]);

							// Math.floor: Prevent inserting extra _s
							const timeDeltaDays =
								Math.floor(((nextTime - nowTime) / 1000 / 60 / 60 / 24) * 2) / 2;

							// Don't increase i -- we need to continue on to the next i index.
							// timeDeltaDays - 1: We expect a delta of 1, but sometimes it's more.
							for (let k = 0; k < timeDeltaDays - 1 && j < 7; k++, j++) {
								weekLine += ' _ |';
							}
						}
					}

					weekLine += ` ${Math.floor(hoursInWeek * 10) / 10} |`;
					calendarText.push(`| ${startDateString} - ${lastDateString} ` + weekLine);
					totalWeekSums += hoursInWeek;

					// Handle per week subtotals
					//
					const toRoundedString = (x: number) => {
						return (Math.floor(100 * x) / 100).toLocaleString();
					};

					sumForPastFewWeeks += hoursInWeek;

					const roundedCost = toRoundedString(hoursInWeek * settings.hourlyWage);
					costPerWeekTSV.push(
						`Week ${weekNum++ + 1}\t\t${toRoundedString(
							hoursInWeek,
						)}\t${roundedCost.toLocaleString()} USD`,
					);

					if (weekNum % 4 === 0 || i >= dateToMinutes.length) {
						const roundedTotalCost = toRoundedString(totalWeekSums * settings.hourlyWage);
						const roundedSectionCost = toRoundedString(sumForPastFewWeeks * settings.hourlyWage);

						costPerWeekTSV.push(
							`4 week sum:\t${toRoundedString(
								sumForPastFewWeeks,
							)}\t${roundedSectionCost.toLocaleString()} USD`,
						);
						costPerWeekTSV.push(
							`Subtotal:\t${toRoundedString(
								totalWeekSums,
							)}\t${roundedTotalCost.toLocaleString()} USD`,
						);
						costPerWeekTSV.push('');

						sumForPastFewWeeks = 0;
					}
				}

				const noteRecordToLink = (note: NoteTitleIdRecord) =>
					`[${note.title} (${Math.floor(note.hrs * 10) / 10} hr)](:/${note.id})`;

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
					...costPerWeekTSV,
					'```',
					'',
					'## Calendar',
					...calendarText,
					'',
					`Total: ${Math.floor(totalWeekSums * 10) / 10}`,
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
					'# Previous summaries',
					summaryPrevText,
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
	},
});
