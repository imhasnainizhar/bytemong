import type { Accent, CodeSnippet } from "./types";

export interface ArchNode {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  accent: Accent;
  group: "Front end" | "Loading" | "Runtime data" | "Execution" | "Memory management" | "Native";
  jvm: string;
  role: string;
  jvmLesson: string;
  build: string[];
  code?: CodeSnippet;
  lesson?: string;
}

export const archNodes: ArchNode[] = [
  {
    id: "source",
    label: "Wisp Source",
    sub: ".wisp files",
    x: 380,
    y: 34,
    accent: "blue",
    group: "Front end",
    jvm: ".java source files",
    role: "The text a user writes: functions, objects, closures and modules, with no classes.",
    jvmLesson: "The JVM never sees source code. Keeping the language and the VM separate is what lets many languages share one runtime.",
    build: [
      "Write a tiny grammar first: let, fn, if/while, return, object literals, property access, calls.",
      "Keep a corpus of example programs. They become your regression test suite.",
    ],
    lesson: "how-code-runs",
  },
  {
    id: "compiler",
    label: "Compiler",
    sub: "lex · parse · emit",
    x: 380,
    y: 110,
    accent: "violet",
    group: "Front end",
    jvm: "javac",
    role: "Turns source into bytecode: tokens, AST, scope resolution, then code emission with jump patching and a constant pool.",
    jvmLesson: "javac runs separate phases (parse, attribute, desugar, generate) and records max_stack and max_locals so frames can be sized ahead of time.",
    build: [
      "Lexer with spans, then a Pratt parser that produces an AST of Rust enums.",
      "Resolver pass: decide whether each name is local, upvalue or global.",
      "Code generator: post-order emission, jump back-patching, constant deduplication.",
    ],
    code: {
      lang: "rust",
      code: `let tokens  = lexer::lex(src)?;              // text   -> tokens
let program = parser::parse(tokens)?;         // tokens -> Vec<Stmt>
let script  = compiler::compile(&program, &mut vm.heap)?; // -> Function
vm.execute(vm.new_closure(script))?;`,
    },
    lesson: "front-end",
  },
  {
    id: "bytecode",
    label: "Bytecode",
    sub: "FunctionProto",
    x: 380,
    y: 186,
    accent: "cyan",
    group: "Front end",
    jvm: ".class file / method bytecode",
    role: "A compact array of one-byte opcodes with inline operands, plus constants and a line table. It's the contract between compiler and VM.",
    jvmLesson: "The class-file format is specified exactly: magic number, version, constant pool, methods. That precision is why bytecode is portable.",
    build: [
      "A #[repr(u8)] Op enum with roughly 30 opcodes to start.",
      "A FunctionProto holding code: Vec<u8>, constants, arity, upvalue count and line info.",
      "A disassembler, your own javap -c, written before anything else.",
    ],
    code: {
      lang: "rust",
      code: `pub struct Chunk {
    pub code: Vec<Op>,      // instructions, 4 bytes each
    pub lines: Vec<u32>,    // source line per instruction
    pub consts: Vec<Value>, // the constant pool
}`,
    },
    lesson: "bytecode",
  },
  {
    id: "loader",
    label: "Module Loader",
    sub: "load · link · init",
    x: 380,
    y: 262,
    accent: "violet",
    group: "Loading",
    jvm: "Class Loader Subsystem",
    role: "Finds modules, loads source or cached bytecode, verifies untrusted bytecode, links names lazily, and runs each module body exactly once.",
    jvmLesson: "Loading is lazy and staged, resolution is deferred until first use, and parent delegation makes core types impossible to spoof.",
    build: [
      "Module cache keyed by canonical path, with Loading, Loaded and Failed states (this also handles cycles).",
      "Resolve std/* from embedded built-ins before user paths.",
      "Verify .wispc files: magic, version, jump targets, stack depth.",
    ],
    lesson: "module-loading",
  },
  {
    id: "heap",
    label: "Heap",
    sub: "objects · closures",
    x: 90,
    y: 360,
    accent: "pink",
    group: "Runtime data",
    jvm: "Java Heap (Eden / Survivor / Old)",
    role: "Where every object, string, array, closure and upvalue lives. It's shared and managed by the GC.",
    jvmLesson: "Every object has a header (mark word plus class pointer). Most objects die young, so the JVM splits the heap into generations.",
    build: [
      "A shared ObjHeader { kind, marked, next } at the start of every heap object.",
      "Allocate through one function that counts bytes and can trigger a GC.",
      "Later, a bump-allocated nursery for short-lived objects.",
    ],
    code: {
      lang: "rust",
      code: `pub fn alloc(&mut self, obj: Obj) -> ObjRef {
    self.live += 1;
    if let Some(i) = self.free.pop() {        // reuse a freed slot
        self.objects[i as usize] = Some(obj);
        return ObjRef(i);
    }
    self.objects.push(Some(obj));
    ObjRef(self.objects.len() as u32 - 1)
}`,
    },
    lesson: "objects",
  },
  {
    id: "protos",
    label: "Protos & Shapes",
    sub: "code · shapes",
    x: 235,
    y: 360,
    accent: "amber",
    group: "Runtime data",
    jvm: "Method Area / Metaspace",
    role: "Long-lived metadata: compiled function prototypes, constant tables, interned symbols, and the shape tree that gives dynamic objects fixed layouts.",
    jvmLesson: "Class metadata lives outside the main object heap (Metaspace) because it's long-lived and has a different lifecycle.",
    build: [
      "Intern every identifier into a Sym (u32) so property lookups compare integers.",
      "A shape tree: each shape maps names to slot indices and holds transitions to child shapes.",
      "Keep protos immutable after compilation, apart from inline-cache slots.",
    ],
    lesson: "objects",
  },
  {
    id: "stack",
    label: "Value Stack",
    sub: "per fiber",
    x: 380,
    y: 360,
    accent: "blue",
    group: "Runtime data",
    jvm: "JVM Stacks",
    role: "One contiguous Vec<Value> per fiber. Locals, arguments and temporaries all live here, and each call frame is a window into it.",
    jvmLesson: "Stacks are per thread and frames are created and destroyed with calls, so locals never need GC. Deep recursion causes a StackOverflowError.",
    build: [
      "Preallocate the stack and never reallocate it while frames point into it.",
      "Check base + max_stack on CALL and raise a Wisp StackOverflow error.",
      "Pick a value representation: a tagged enum now, NaN-boxing later.",
    ],
    lesson: "functions",
  },
  {
    id: "frames",
    label: "Frames + IP",
    sub: "call stack",
    x: 525,
    y: 360,
    accent: "cyan",
    group: "Runtime data",
    jvm: "PC Register + frame data",
    role: "Each frame records the running closure, its instruction pointer and its base offset in the value stack. Error stack traces are built from these.",
    jvmLesson: "Each thread has its own PC register. Frames also hold a link to the constant pool and the return address.",
    build: [
      "CallFrame { closure, ip, base }, with the current frame's ip cached in a local inside run().",
      "Write ip back into the frame only on CALL, on an exception, or at a safepoint.",
      "Map ip to a line through the line table when you build error traces.",
    ],
    code: {
      lang: "rust",
      code: `struct CallFrame { closure: ObjRef, func: Rc<Function>, ip: usize, base: usize }`,
    },
    lesson: "functions",
  },
  {
    id: "fibers",
    label: "Fiber Scheduler",
    sub: "M:N · parking",
    x: 670,
    y: 360,
    accent: "violet",
    group: "Execution",
    jvm: "Virtual-thread scheduler (Loom)",
    role: "Switches between fibers (separate stacks and frames), parks fibers waiting on I/O, and wakes them when the I/O completes.",
    jvmLesson: "Virtual threads unmount from carrier threads when they block. Pinning, when a virtual thread can't unmount, defeats the whole design.",
    build: [
      "Fiber { stack, frames, state }, with run(fiber, budget) returning on yield, park or completion.",
      "A ready queue plus an event loop (mio) for parked fibers.",
      "Never let a Wisp call recurse into a Rust call, otherwise fibers can't be suspended.",
    ],
    lesson: "concurrency",
  },
  {
    id: "interp",
    label: "Interpreter",
    sub: "dispatch loop",
    x: 380,
    y: 462,
    accent: "emerald",
    group: "Execution",
    jvm: "Execution Engine (template interpreter)",
    role: "The fetch, decode, execute loop. It runs every instruction, collects profiles, and specializes itself through quickening and inline caches.",
    jvmLesson: "HotSpot generates machine code for each bytecode at startup, caches the top of stack in a register, and rewrites resolved bytecodes into faster forms.",
    build: [
      "A single loop with a match, keeping ip, code and base in locals.",
      "Fast paths for number arithmetic, with a slow path for everything else.",
      "Quickening (ADD to ADD_NUM) and per-instruction inline caches for property access.",
    ],
    code: {
      lang: "rust",
      code: `loop {
    let op = func.chunk.code[ip];
    ip += 1; // advance first, so jumps can overwrite ip
    match op {
        Op::Const(k) => self.push(func.chunk.consts[k as usize]),
        Op::GetLocal(s) => self.push(self.stack[base + s as usize]),
        Op::Call(argc) => { /* save ip, push a frame, switch hot state */ }
        Op::Return => { /* close upvalues, pop frame, restore caller */ }
        // ...
    }
}`,
    },
    lesson: "execution-engine",
  },
  {
    id: "jit",
    label: "JIT",
    sub: "optional tier",
    x: 620,
    y: 462,
    accent: "rose",
    group: "Execution",
    jvm: "C1 / C2 compilers",
    role: "Compiles hot functions to machine code, speculating on the types the interpreter observed, and deoptimizes back when a guess fails.",
    jvmLesson: "Tiered compilation: interpret, profile, compile quickly with C1, then aggressively with C2. Deoptimization keeps speculation safe.",
    build: [
      "Hotness counters on calls and loop back-edges, logged before anything else.",
      "A baseline JIT using Cranelift that calls the same runtime helpers as the interpreter.",
      "Only then add speculation with type guards and deopt metadata.",
    ],
    lesson: "jit",
  },
  {
    id: "gc",
    label: "Garbage Collector",
    sub: "mark · sweep",
    x: 140,
    y: 562,
    accent: "amber",
    group: "Memory management",
    jvm: "Serial / Parallel / G1 / ZGC",
    role: "Traces from the roots (stacks, frames, globals, open upvalues, module cache) and frees everything unreachable.",
    jvmLesson: "Reachability rather than reference counts collects cycles. Generations make the common case cheap, and barriers make concurrent collection possible.",
    build: [
      "Stop-the-world mark-sweep with an explicit gray worklist.",
      "Grow next_gc relative to the live heap after each collection.",
      "A --gc-stress flag that collects on every allocation, run in CI.",
    ],
    code: {
      lang: "rust",
      code: `fn collect(&mut self) {
    let roots = self.roots();   // stack, globals, frames, open upvalues
    self.heap.mark(roots);      // gray worklist -> black
    self.heap.sweep();          // free the white, next_gc = live * 2
}`,
    },
    lesson: "gc",
  },
  {
    id: "ffi",
    label: "Native Interface",
    sub: "NativeFn · handles",
    x: 380,
    y: 562,
    accent: "cyan",
    group: "Native",
    jvm: "JNI / Panama FFM",
    role: "Lets Wisp call Rust and C. Natives receive &mut Vm and argument values, and must keep any temporaries rooted.",
    jvmLesson: "Native code only gets handles to objects, never raw pointers, so the GC stays in control. Crossing the boundary has a cost.",
    build: [
      "type NativeFn = fn(&mut Vm, &[Value]) -> Result<Value>.",
      "A root table for handles that natives keep across allocations.",
      "Buffers whose bytes live off-heap, with only a small header on the GC heap.",
    ],
    lesson: "ffi",
  },
  {
    id: "natives",
    label: "Native Libraries",
    sub: "std/io · std/math",
    x: 620,
    y: 562,
    accent: "blue",
    group: "Native",
    jvm: "Native method libraries (.so / .dll)",
    role: "The standard library modules implemented in Rust: I/O, time, math, strings. They're exposed to Wisp as ordinary module objects.",
    jvmLesson: "Much of java.base relies on native methods for OS access. The VM is a small core plus a large library around it.",
    build: [
      "Tables of (name, arity, NativeFn) turned into module objects at startup.",
      "Blocking operations return Pending(token) so fibers can park instead of pinning.",
      "Optional dynamic FFI through libloading and libffi, behind a flag.",
    ],
    lesson: "ffi",
  },
];

/** [from, to] — the data/control flow between components. */
export const archEdges: [string, string][] = [
  ["source", "compiler"],
  ["compiler", "bytecode"],
  ["bytecode", "loader"],
  ["loader", "protos"],
  ["loader", "heap"],
  ["fibers", "frames"],
  ["interp", "stack"],
  ["interp", "frames"],
  ["interp", "heap"],
  ["interp", "protos"],
  ["interp", "jit"],
  ["interp", "ffi"],
  ["ffi", "natives"],
  ["gc", "heap"],
  ["gc", "stack"],
];

export const NODE_W = 132;
export const NODE_H = 44;
