export const calculateEducationGaps = (entries = []) => {
    const ordered = [...entries].sort((a, b) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(a.startDate) - new Date(b.startDate);
    });
    const gaps = [];
    let previous = null;
    let uncertain = false;

    for (const entry of ordered) {
        if (!entry.startDate || (!entry.endDate && entry.status !== "ongoing")) {
            uncertain = true;
            if (previous) gaps.push({ status: "possible", months: null });
            continue;
        }
        if (previous) {
            if (!previous.endDate || !entry.startDate) {
                gaps.push({ status: "possible", months: null });
            } else {
                const end = new Date(previous.endDate);
                const start = new Date(entry.startDate);
                const monthDistance = (start.getUTCFullYear() - end.getUTCFullYear()) * 12
                    + start.getUTCMonth() - end.getUTCMonth();
                const months = Math.max(0, monthDistance - (start.getUTCDate() < end.getUTCDate() ? 1 : 0));
                if (months > 0) gaps.push({ status: "confirmed", months });
            }
        }
        if (!previous || (entry.endDate && (!previous.endDate || new Date(entry.endDate) > new Date(previous.endDate)))) {
            previous = entry;
        }
    }

    return {
        gaps,
        confirmedMonths: ordered.length < 2 || uncertain || gaps.some((gap) => gap.status === "possible")
            ? null
            : gaps.reduce((total, gap) => total + gap.months, 0),
        hasPossibleGap: uncertain || gaps.some((gap) => gap.status === "possible")
    };
};
