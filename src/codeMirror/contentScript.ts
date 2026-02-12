import { CodeMirrorControl, ContentScriptContext } from 'api/types.ts';
import { Range } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import parseTimeLog from '../util/parseTimeLog.ts';

const percentFormatter = new Intl.NumberFormat('en-US', {
	style: 'percent',
	maximumSignificantDigits: 2,
});

class FeedbackWidget extends WidgetType {
	public constructor(
		private readonly minutesWorked: number,
		private readonly minutesPlanned: number,
		private readonly goalMinutes: number,
	) {
		super();
	}

	public override eq(other: WidgetType) {
		return (
			other instanceof FeedbackWidget &&
			this.minutesWorked === other.minutesWorked &&
			this.minutesPlanned === other.minutesPlanned &&
			this.goalMinutes === other.goalMinutes
		);
	}

	public override toDOM() {
		const container = document.createElement('span');
		container.classList.add('work-tracker-status-text');

		container.style.setProperty(
			'--fraction-done',
			`${Math.floor((this.minutesWorked / this.goalMinutes) * 100)}%`,
		);
		container.style.setProperty(
			'--fraction-planned',
			`${Math.floor((this.minutesPlanned / this.goalMinutes) * 100)}%`,
		);

		const donePercent = percentFormatter.format(this.minutesWorked / this.goalMinutes);
		const goalPercent = percentFormatter.format(this.minutesPlanned / this.goalMinutes);
		container.textContent = `Done: ${donePercent}, planned: ${goalPercent}`;

		return container;
	}
}

const makeFeedbackWidgets = (view: EditorView) => {
	const feedbackWidgets: Range<Decoration>[] = [];
	const doc = view.state.doc;

	const addFeedbackWidget = (lineNumber: number, goalMinutes: number) => {
		let dataEndLineNo = lineNumber + 1;
		for (; dataEndLineNo < doc.lines; dataEndLineNo++) {
			if (doc.line(dataEndLineNo).text.startsWith('#')) {
				dataEndLineNo--;
				break;
			}
		}

		const goalLine = doc.line(lineNumber);
		const dataEndLine = doc.line(dataEndLineNo);

		const timeLogRegion = view.state.sliceDoc(goalLine.to, dataEndLine.to);
		const parsedData = parseTimeLog(timeLogRegion);

		const hiddenMinutes = parsedData.entries.reduce((total, current) => {
			if (current.hidden) {
				return total + current.minutes;
			} else {
				return total;
			}
		}, 0);
		const minutesPlanned = hiddenMinutes + parsedData.totalMinutes;
		const decoration = Decoration.widget({
			widget: new FeedbackWidget(parsedData.totalMinutes, minutesPlanned, goalMinutes),
		});
		feedbackWidgets.push(decoration.range(goalLine.to));
	};

	for (const range of view.visibleRanges) {
		const startLine = doc.lineAt(range.from);
		const endLine = doc.lineAt(range.to);
		const lines = doc.iterLines(startLine.number, endLine.number);
		// The lines iterator seems to start just after the first line
		let lineNumber = startLine.number - 1;
		let lastLineContent = startLine.text;

		while (!lines.done) {
			const lineContent = lines.value;

			if (lastLineContent === '# Log') {
				const match = lineContent.match(
					/^(?:\*\*)?Goal(?:\*\*)?: (\d+(?:\.\d+)?)\s*(hr|hrs|mins)\s*$/,
				);
				if (match) {
					const count = Number(match[1]);
					const units = match[2];
					const minutes = units !== 'mins' ? count * 60 : count;
					addFeedbackWidget(lineNumber, minutes);
				}
			}

			// Skip blank lines
			if (lineContent) {
				lastLineContent = lineContent;
			}
			lines.next();
			lineNumber++;
		}
	}

	return Decoration.set(feedbackWidgets);
};

const createFeedbackExtension = () => {
	const viewPlugin = ViewPlugin.fromClass(
		class {
			public decorations: DecorationSet;
			public constructor(view: EditorView) {
				this.decorations = makeFeedbackWidgets(view);
			}

			public update(update: ViewUpdate) {
				if (update.viewportChanged || update.docChanged) {
					this.decorations = makeFeedbackWidgets(update.view);
				}
			}
		},
		{ decorations: (ext) => ext.decorations },
	);

	return [
		EditorView.theme({
			'& .work-tracker-status-text': {
				'--progress-done-color':
					'color-mix(in srgb, var(--joplin-color2) 30%, rgba(200, 0, 200, 0.2) 70%)',
				'--progress-planned-color':
					'color-mix(in srgb, var(--joplin-color2) 30%, rgba(200, 70, 23, 0.2) 70%)',
				background: `linear-gradient(
					to right, var(--progress-done-color) var(--fraction-done), transparent 2%
				), linear-gradient(
					to right, var(--progress-planned-color) var(--fraction-planned), transparent 4%
				)`,
				border: '1px solid var(--joplin-color)',
				borderRadius: '2px',
				fontSize: '0.9em',
				marginLeft: '2px',
				marginRight: '2px',
			},
		}),
		viewPlugin,
	];
};

export default (_context: ContentScriptContext) => {
	return {
		plugin: async (editorControl: CodeMirrorControl) => {
			editorControl.addExtension([createFeedbackExtension()]);
		},
	};
};
