import test from "node:test";
import assert from "node:assert/strict";
import { calculateEducationGaps } from "../utils/educationGap.js";

test("calculates a confirmed gap in calendar months", () => {
    const result = calculateEducationGaps([
        { startDate: "2018-08-01", endDate: "2020-05-01", status: "completed" },
        { startDate: "2021-01-01", endDate: "2024-01-01", status: "completed" }
    ]);
    assert.deepEqual(result.gaps, [{ status: "confirmed", months: 8 }]);
    assert.equal(result.confirmedMonths, 8);
});

test("does not call overlapping education periods a gap", () => {
    const result = calculateEducationGaps([
        { startDate: "2018-08-01", endDate: "2022-05-01", status: "completed" },
        { startDate: "2021-08-01", endDate: "2023-05-01", status: "completed" }
    ]);
    assert.deepEqual(result.gaps, []);
    assert.equal(result.confirmedMonths, 0);
});

test("treats back-to-back school months as continuous and counts empty months only", () => {
    const continuous = calculateEducationGaps([
        { startDate: "2018-08-01", endDate: "2020-05-31", status: "completed" },
        { startDate: "2020-06-01", endDate: "2024-05-31", status: "completed" }
    ]);
    const oneEmptyMonth = calculateEducationGaps([
        { startDate: "2018-08-01", endDate: "2020-05-31", status: "completed" },
        { startDate: "2020-07-01", endDate: "2024-05-31", status: "completed" }
    ]);
    assert.equal(continuous.confirmedMonths, 0);
    assert.equal(oneEmptyMonth.confirmedMonths, 1);
});

test("year-only or missing dates remain unverified rather than becoming a zero gap", () => {
    const result = calculateEducationGaps([
        { completionYear: 2020, status: "completed" },
        { completionYear: 2024, status: "completed" }
    ]);
    assert.equal(result.confirmedMonths, null);
    assert.equal(result.hasPossibleGap, true);
});
