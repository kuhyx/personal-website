import { markupSegments } from "./markup";

describe("markupSegments", () => {
  it("returns plain text as a single plain run", () => {
    expect(markupSegments("plain text")).toEqual([{ text: "plain text", bold: false }]);
  });

  it("marks **wrapped** runs bold and drops the empty edges", () => {
    expect(markupSegments("**React**, Angular and **Go**")).toEqual([
      { text: "React", bold: true },
      { text: ", Angular and ", bold: false },
      { text: "Go", bold: true },
    ]);
  });

  it("returns nothing for an empty string", () => {
    expect(markupSegments("")).toEqual([]);
  });
});
