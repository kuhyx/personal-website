import { fillDurations } from "./cv-durations";

describe("fillDurations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15));
  });

  it("recomputes an ongoing job from today's date", () => {
    document.body.innerHTML = '<p><span data-duration-start="2024-06">stale</span></p>';
    expect(fillDurations(document)).toBe(1);
    expect(document.querySelector("span")?.textContent).toBe("2y 5m");
  });

  it("uses the end month when there is one", () => {
    document.body.innerHTML = '<span data-duration-start="2022-11" data-duration-end="2024-07">x</span>';
    fillDurations(document);
    expect(document.querySelector("span")?.textContent).toBe("1y 8m");
  });

  it("leaves spans without a start alone", () => {
    document.body.innerHTML = "<span>1.5 years</span>";
    expect(fillDurations(document)).toBe(0);
    expect(document.querySelector("span")?.textContent).toBe("1.5 years");
  });
});
