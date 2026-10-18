import "@testing-library/jest-dom/vitest"

// jsdom lacks a few browser APIs that Radix UI (Select, Popper) relies on.
class ResizeObserverStub {
  observe(): void {
    // nothing to observe in tests
  }
  unobserve(): void {
    // nothing to observe in tests
  }
  disconnect(): void {
    // nothing to observe in tests
  }
}
globalThis.ResizeObserver = ResizeObserverStub

const stubs = {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
}
for (const [name, value] of Object.entries(stubs)) {
  Object.defineProperty(Element.prototype, name, { value, configurable: true, writable: true })
}
