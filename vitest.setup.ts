import '@testing-library/jest-dom/vitest';

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) globalThis.ResizeObserver = TestResizeObserver;
if (!window.matchMedia) window.matchMedia = (query: string) => ({matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }});
if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {};
