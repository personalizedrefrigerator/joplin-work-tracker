const createMinutesPerDayTable = (dateToMinutes: Array<[string, number]>, hourlyWage: number) => {
	const minutesPerDayTSV: string[] = [];
	let totalMinutes = 0;
	minutesPerDayTSV.push('Date\t\tMinutes worked');
	for (const [date, minutes] of dateToMinutes) {
		minutesPerDayTSV.push(`${date}\t${minutes}`);
		totalMinutes += minutes;
	}
	minutesPerDayTSV.push('');
	minutesPerDayTSV.push(`TOTAL (min)\t${totalMinutes}`);

	const totalHrs = totalMinutes / 60;
	minutesPerDayTSV.push(`TOTAL (hrs)\t${totalHrs}`);
	minutesPerDayTSV.push(`WAGE (USD/hr)\t${hourlyWage}`);
	minutesPerDayTSV.push(`COST (USD)\t${hourlyWage * totalHrs}`);

	return '```text\n' + minutesPerDayTSV.join('\n') + '\n```';
};

export default createMinutesPerDayTable;
