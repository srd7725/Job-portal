const monthPattern = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:T[\d:.+-Z]*)?$/;

export const parseEducationMonth = (value) => {
    if (value == null || value === "") return { ok: true, month: null };
    if (value instanceof Date) {
        if (!Number.isFinite(value.getTime())) return { ok: false, month: null };
        return {
            ok: true,
            month: `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`
        };
    }
    if (typeof value !== "string") return { ok: false, month: null };
    const match = value.trim().match(monthPattern);
    if (!match) return { ok: false, month: null };
    const [, year, month, day] = match;
    const monthNumber = Number(month);
    if (monthNumber < 1 || monthNumber > 12) return { ok: false, month: null };
    if (day) {
        const date = new Date(Date.UTC(Number(year), monthNumber - 1, Number(day)));
        if (date.getUTCFullYear() !== Number(year) ||
            date.getUTCMonth() !== monthNumber - 1 ||
            date.getUTCDate() !== Number(day)) {
            return { ok: false, month: null };
        }
    }
    return { ok: true, month: `${year}-${month}` };
};

export const normalizeEducationDate = (value, isEndDate = false) => {
    const parsed = parseEducationMonth(value);
    if (!parsed.ok || !parsed.month) return parsed.ok ? null : value || null;
    const [year, monthNumber] = parsed.month.split("-");
    if (!isEndDate) return `${year}-${monthNumber}-01`;
    const endDay = new Date(Date.UTC(Number(year), Number(monthNumber), 0)).getUTCDate();
    return `${year}-${monthNumber}-${String(endDay).padStart(2, "0")}`;
};

export const validEducationEntry = (entry) => {
    if (!entry || typeof entry !== "object") return false;
    const startParsed = parseEducationMonth(entry.startDate);
    const endParsed = parseEducationMonth(entry.endDate);
    const start = startParsed.month ? new Date(`${startParsed.month}-01T00:00:00.000Z`) : null;
    const end = endParsed.month ? new Date(`${endParsed.month}-01T00:00:00.000Z`) : null;
    const completionYear = entry.completionYear;
    return typeof entry.qualification === "string" && entry.qualification.trim().length > 0 &&
        entry.qualification.length <= 120 &&
        (entry.institution == null || (typeof entry.institution === "string" && entry.institution.length <= 160)) &&
        ["ongoing", "completed"].includes(entry.status) &&
        startParsed.ok && endParsed.ok &&
        (!start || Number.isFinite(start.getTime())) &&
        (!end || Number.isFinite(end.getTime())) &&
        (!start || !end || start <= end) &&
        (completionYear === undefined || completionYear === null || completionYear === "" ||
            (Number.isInteger(Number(completionYear)) && Number(completionYear) >= 1900 && Number(completionYear) <= 2200));
};
