import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import "./styles/host.css";

/** TonConnect UI reads `matchMedia` for theme; jsdom does not provide it. */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
