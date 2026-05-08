import { Buffer as BufferImpl } from "buffer";

const g = globalThis as typeof globalThis & {
  Buffer?: typeof BufferImpl;
  global?: typeof globalThis;
};

if (g.Buffer === undefined) g.Buffer = BufferImpl;
if (g.global === undefined) g.global = g;
