import "@testing-library/jest-dom";
import { vi, beforeEach, afterEach } from "vitest";

// Reset mocks and any faked timers between tests so duration-based
// assertions using vi.setSystemTime stay isolated.
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});
