import '@testing-library/jest-dom/vitest';

// jsdom implements neither the Pointer Events capture API nor
// scrollIntoView, both of which Reka UI's Select relies on to open via a
// pointerdown handler. Needed by any spec that interacts with a <Select>.
if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}
