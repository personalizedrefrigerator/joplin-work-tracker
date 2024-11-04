import { msPerDay as msPerDay } from '../constants';
import dateStringToDate from './dateStringToDate';

type DateString = string;
export type DateToMinutes = [DateString, number][];

interface Props {
	dateToMinutes: DateToMinutes;
	linkifyDate?: (linkText: string, date: DateString) => string;
	hourlyWage: number;
}

const createMultiDaySummary = ({ dateToMinutes, hourlyWage, linkifyDate }: Props) => {
	const calendarHeader = [
		`| Dates | Sun | Mon | Tue | Wed | Thu | Fri | Sat | SUM (hr) |`,
		'|--|--|--|--|--|--|--|--|--|',
	];
	const calendarText = [...calendarHeader];
	const firstDayOfMonth = dateStringToDate(dateToMinutes[0][0]).getUTCDate();

	// Add empty rows for each non-tracked date
	for (let i = 7; i <= firstDayOfMonth; i += 7) {
		calendarText.push('| - | - | - | - | - | - | - | - | - |');
	}

	const costPerWeekTSV = ['\t\t\tHours\tCost'];
	let weekNum = 0;
	let sumForPastFewWeeks = 0;

	const numberFormatter = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
	});

	// Fill the table
	let totalWeekSums = 0;
	let noteIdx = 0;
	while (noteIdx < dateToMinutes.length) {
		const startDateString = dateToMinutes[noteIdx][0];
		const currentDate = new Date(startDateString);
		const currentDayOfWeek = currentDate.getUTCDay();

		let hoursInWeek = 0;
		let weekLine = '|';
		for (let j = 0; j < currentDayOfWeek; j++) {
			weekLine += ' - |';
		}

		let lastDateString = startDateString;
		for (let dayIdx = currentDayOfWeek; dayIdx < 7; noteIdx++, dayIdx++) {
			if (noteIdx >= dateToMinutes.length) {
				weekLine += ' . |';
			} else {
				const dateString = dateToMinutes[noteIdx][0];
				const minutes = dateToMinutes[noteIdx][1];
				const hours = minutes / 60;
				hoursInWeek += hours;

				const cellContent = numberFormatter.format(Math.floor(hours * 100) / 100);
				const linkedCellContent = linkifyDate ? linkifyDate(cellContent, dateString) : cellContent;
				weekLine += ` ${linkedCellContent} |`;
				lastDateString = dateToMinutes[noteIdx][0];
			}

			const tomorrowIsInWeek = dayIdx + 1 < 7;
			if (tomorrowIsInWeek && noteIdx + 1 < dateToMinutes.length) {
				const nowDateString = dateToMinutes[noteIdx][0];
				const nowTimeMs = dateStringToDate(nowDateString).getTime();
				const nextDateString = dateToMinutes[noteIdx + 1][0];
				const nextTimeMs = dateStringToDate(nextDateString).getTime();

				// Math.floor: Prevent inserting extra _s
				const timeDeltaDays = (nextTimeMs - nowTimeMs) / msPerDay;

				// Don't increase i -- we need to continue on to the next i index.
				// timeDeltaDays - 1: We expect a delta of 1, but sometimes it's more.
				//                    When the delta is 1, nothing should be added.
				// dayIdx + 1 < 7: Stop at the end of the week.
				for (let k = 0; k < timeDeltaDays - 1 && dayIdx + 1 < 7; k++, dayIdx++) {
					weekLine += ' _ |';
				}
			}
		}

		weekLine += ` ${numberFormatter.format(Math.floor(hoursInWeek * 100) / 100)} |`;
		calendarText.push(`| ${startDateString} - ${lastDateString} ` + weekLine);
		totalWeekSums += hoursInWeek;

		// Handle per week subtotals
		//
		const toRoundedString = (x: number) => {
			return numberFormatter.format(Math.floor(100 * x) / 100);
		};

		sumForPastFewWeeks += hoursInWeek;

		const roundedCost = toRoundedString(hoursInWeek * hourlyWage);
		costPerWeekTSV.push(
			`Week ${weekNum++ + 1}\t\t${toRoundedString(
				hoursInWeek,
			)}\t${roundedCost.toLocaleString()} USD`,
		);

		if (weekNum % 4 === 0 || noteIdx >= dateToMinutes.length) {
			const roundedTotalCost = toRoundedString(totalWeekSums * hourlyWage);
			const roundedSectionCost = toRoundedString(sumForPastFewWeeks * hourlyWage);

			costPerWeekTSV.push(
				`4 week sum:\t${toRoundedString(
					sumForPastFewWeeks,
				)}\t${roundedSectionCost.toLocaleString()} USD`,
			);
			costPerWeekTSV.push(
				`Subtotal:\t${toRoundedString(totalWeekSums)}\t${roundedTotalCost.toLocaleString()} USD`,
			);
			costPerWeekTSV.push('');

			sumForPastFewWeeks = 0;
		}
	}

	return {
		costPerWeekTSV: costPerWeekTSV.join('\n'),
		calendarText: calendarText.join('\n'),
		totalWeekSums,
	};
};

export default createMultiDaySummary;
