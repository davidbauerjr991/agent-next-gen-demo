// P-LAYOUT-F3 11: under each Layout preset row, one sentence (the selected option's description); anything longer is
// the row's (?) help.
import { describe, expect, it } from "vitest";
import { HOME_CONTENT_WIDTH_ROW, PRESET_ROWS } from "./layout-preset-rows";

/** Sentence ends: a period, ! or ? followed by a space or the end (not "e.g." mid-sentence, which none use). */
const sentences = (text: string) => text.trim().split(/[.!?](?:\s+|$)/).filter((s) => s.trim().length > 0).length;

describe("Layout preset descriptions", () => {
  for (const row of [...PRESET_ROWS, HOME_CONTENT_WIDTH_ROW]) {
    it(`${row.field}: every option has a one-sentence description, and the row has help`, () => {
      expect(row.help, row.field).toBeTruthy();
      for (const option of row.options) {
        expect(option.description, `${row.field}.${option.value}`).toBeTruthy();
        expect(sentences(option.description!), `${row.field}.${option.value}: ${option.description}`).toBe(1);
      }
    });
  }
});
