// Source fixture: every supported access pattern plus false-positive traps.

const a = process.env.PLAIN;
const b = process.env["BRACKET"];
const c = process.env['SINGLE_BRACKET'];
const d = import.meta.env.VITE_KEY;

// Template literal interpolation is real usage.
const e = `host: ${process.env.HOST} port: ${process.env.PORT}`;

// The following must NOT be detected:
const f = "process.env.IN_STRING";
const g = 'process.env.IN_SINGLE_STRING';
const h = `process.env.IN_TEMPLATE_STRING`;
// const i = process.env.COMMENTED_OUT;
/* const j = process.env.BLOCK_COMMENTED; */

const url = "https://example.com/path"; // comment with // inside a string is safe

export { a, b, c, d, e, f, g, h, url };
