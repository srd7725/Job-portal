import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEducationDate, validEducationEntry } from "../utils/educationEntry.js";

const screenshotEntry = {
    qualification: "B.E",
    institution: "IET DAVV INDORE",
    startDate: "2024-05",
    endDate: "2027-05",
    completionYear: 2006,
    status: "ongoing"
};

test("accepts month inputs from the education form", () => {
    assert.equal(validEducationEntry(screenshotEntry), true);
});

test("accepts ISO datetimes returned after a previous save", () => {
    assert.equal(validEducationEntry({
        ...screenshotEntry,
        startDate: "2024-05-01T00:00:00.000Z",
        endDate: "2027-05-31T00:00:00.000Z"
    }), true);
});

test("accepts a null institution from older documents", () => {
    assert.equal(validEducationEntry({
        ...screenshotEntry,
        institution: null,
        endDate: null
    }), true);
});

test("rejects an invalid date string", () => {
    assert.equal(validEducationEntry({
        ...screenshotEntry,
        startDate: "May, 2024"
    }), false);
});

test("normalizes month and ISO values to calendar days", () => {
    assert.equal(normalizeEducationDate("2024-05"), "2024-05-01");
    assert.equal(normalizeEducationDate("2027-05", true), "2027-05-31");
    assert.equal(normalizeEducationDate("2024-05-01T00:00:00.000Z"), "2024-05-01");
    assert.equal(normalizeEducationDate("2027-05-31T00:00:00.000Z", true), "2027-05-31");
});
