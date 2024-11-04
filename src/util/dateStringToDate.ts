// dateString should be in the format yyyy/mm/dd
const dateStringToDate = (dateString: string) => {
	const match = /^(\d{4})[/](\d{1,2})[/](\d{1,2})$/.exec(dateString.trim());
	if (!match) {
		throw new Error(
			`Invalid date string: ${JSON.stringify(dateString)} must be in the form YYYY/MM/DD.`,
		);
	}
	const year = match[1];
	const month = match[2];
	const day = match[3];
	return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T01:01:01.000Z`);
};

export default dateStringToDate;
