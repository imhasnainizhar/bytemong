import type { Lesson } from "./types";

export const advancedLessons: Lesson[] = [
  /* ───────────────────────────── 11 · Natives ───────────────────────────── */
  {
    slug: "ffi",
    title: "Native Functions",
    level: "Intermediate",
    accent: "cyan",
    icon: "Plug",
    summary: "Let Wisp call Rust: a native-function object, a calling convention that mirrors Wisp calls, and a small standard library. Compared with JNI and Panama.",
    tags: ["Native objects", "Builtins", "Calling convention", "JNI · Panama"],
    intro: [
      "A language that can only do arithmetic and print isn't much use. Real programs need the clock, files and maths, which the host language already provides. In Java, methods marked `native` are implemented in C through JNI, and `System.currentTimeMillis()` is one of them.",
      "Wisp's version is simpler. A native is a Rust function pointer stored in a heap object. Calling it looks exactly like calling a Wisp function: the callee and its arguments are on the stack, and one value comes back.",
    ],
    sim: "flow",
    simTitle: "A call crossing from Wisp into Rust",
    flow: [
      { label: "Wisp", sub: "sqrt(16)" },
      { label: "Call(1)", sub: "callee is Native" },
      { label: "Rust fn", sub: "fn(&mut Vm, &[Value])" },
      { label: "Result", sub: "push 4" },
    ],
    jvm: {
      title: "What JNI and Panama teach us",
      points: [
        "A `native` method has no bytecode. When it's called, the JVM looks up a C function by a mangled name, or uses one registered with `RegisterNatives`, and calls it with a `JNIEnv*`, a handle back into the VM.",
        "Native code can't hold raw object pointers, because the GC may move objects. JNI hands out **handles** (local and global references) that the GC knows about.",
        "Calls into native code are relatively expensive and opaque to the JIT. That's why hot JDK natives are often replaced with **intrinsics**, which the JIT compiles inline.",
        "Panama's Foreign Function & Memory API (Java 22) calls C functions directly from Java, with no hand-written C glue: describe the function's signature, get a `MethodHandle`, and call it.",
      ],
    },
    concepts: [
      {
        heading: "Same stack, same convention",
        body: [
          "The VM doesn't need a separate path for native calls. `Call(argc)` sees `[.., native, arg0, arg1]`, hands the arguments to the Rust function as a slice, removes the callee and arguments, and pushes the result. From the Wisp side, natives and Wisp functions are indistinguishable.",
          "The Rust function receives `&mut Vm` too. That's Wisp's `JNIEnv*`: the native can allocate strings, read tables, or even run a Wisp callback with `vm.execute`, thanks to the re-entrant VM from the modules lesson.",
        ],
      },
    ],
    build: {
      intro: "One new object type, one new branch in `Call`, and a few builtins.",
      milestone: "`clock()`, `sqrt(x)`, `str(x)` and `len(x)` work in every script and module.",
      steps: [
        {
          title: "The Native object",
          body: "A native is a name, an arity and a plain Rust function pointer. It's small and `Copy`, which makes it easy to take out of the heap before calling it.",
          code: {
            lang: "rust",
            caption: "src/object.rs (changes)",
            code: `use crate::vm::Vm;

/// Every native has this signature: the VM (to allocate, read objects...) and the arguments.
pub type NativeFn = fn(&mut Vm, &[Value]) -> Result<Value, String>;

#[derive(Clone, Copy)]
pub struct Native {
    pub name: &'static str,
    pub arity: u8,
    pub f: NativeFn,
}

// a new Obj variant
Native(Native),

// Heap::show
Obj::Native(n) => format!("<native {}>", n.name),`,
          },
        },
        {
          title: "Call natives from Op::Call",
          body: "`Call` now looks at what kind of object the callee is. Closures go through the frame-pushing code from lessons 07–08. Natives run straight away.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (Op::Call)",
            code: `Op::Call(argc) => {
    let argc = argc as usize;
    let Value::Obj(r) = self.peek(argc) else {
        return Err(self.error(&func.chunk, ip, "can only call functions"));
    };
    match self.heap.get(r) {
        Obj::Closure(_) => { /* push a frame, exactly as in lessons 07–08 */ }
        Obj::Native(native) => {
            let native = *native; // copy it out, ending the borrow of the heap
            if native.arity as usize != argc {
                let msg = format!("{}() takes {} arguments but got {argc}", native.name, native.arity);
                return Err(self.error(&func.chunk, ip, &msg));
            }
            let first_arg = self.stack.len() - argc;
            let args = self.stack[first_arg..].to_vec();
            self.frames.last_mut().unwrap().ip = ip; // the native might call back into Wisp
            let result = (native.f)(self, &args).map_err(|e| self.error(&func.chunk, ip, &e))?;
            self.stack.truncate(first_arg - 1); // remove the args and the native itself
            self.push(result);
        }
        _ => return Err(self.error(&func.chunk, ip, "can only call functions")),
    }
}`,
          },
          explain: [
            "The arguments are **copied** into a `Vec` but also stay on the stack until the native returns. While the native runs, they're still GC roots, so if the native allocates and triggers a collection, its arguments survive.",
            "Errors from the native are plain strings like `\"sqrt() needs a number\"`. `map_err` turns them into normal runtime errors with a line number.",
            "Saving `ip` first means a native that calls `vm.execute(...)` leaves the current frame in a consistent state, the same as the `Import` instruction did.",
          ],
          jvm: "When HotSpot calls a JNI method, it also records the Java frame before leaving the interpreter, so a stack walk (for an exception, a profiler or the GC) can step over the native part. The thread switches to the \"in native\" state, which the safepoint lesson explains.",
        },
        {
          title: "Builtins: a separate table so every module sees them",
          body: "Modules start with empty globals, so storing natives as globals would hide them from modules. Keep them in a `builtins` map that `GetGlobal` checks when a name isn't found in the globals.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `// Vm gains:  builtins: HashMap<String, Value>   (and collect() treats its values as roots)

impl Vm {
    pub fn define_native(&mut self, name: &'static str, arity: u8, f: NativeFn) {
        let r = self.heap.alloc(Obj::Native(Native { name, arity, f }));
        self.builtins.insert(name.to_string(), Value::Obj(r));
    }
}

// in Op::GetGlobal: fall back to the builtins
let Some(&v) = self.globals.get(name).or_else(|| self.builtins.get(name)) else { /* undefined */ };

// in Vm::new()
vm.define_native("clock", 0, clock);
vm.define_native("sqrt", 1, sqrt);
vm.define_native("str", 1, str);
vm.define_native("len", 1, len);

// the natives themselves: ordinary Rust functions
fn clock(_vm: &mut Vm, _args: &[Value]) -> Result<Value, String> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap();
    Ok(Value::Num(now.as_secs_f64()))
}

fn sqrt(_vm: &mut Vm, args: &[Value]) -> Result<Value, String> {
    match args[0] {
        Value::Num(n) => Ok(Value::Num(n.sqrt())),
        _ => Err("sqrt() needs a number".into()),
    }
}

/// str(x): any value as a string, using the same formatting as print
fn str(vm: &mut Vm, args: &[Value]) -> Result<Value, String> {
    let text = vm.heap.show(args[0]);
    Ok(Value::Obj(vm.heap.intern(&text)))
}

fn len(vm: &mut Vm, args: &[Value]) -> Result<Value, String> {
    let Value::Obj(r) = args[0] else { return Err("len() needs a string or table".into()) };
    match vm.heap.get(r) {
        Obj::Str(s) => Ok(Value::Num(s.chars().count() as f64)),
        Obj::Table(t) => Ok(Value::Num(t.len() as f64)),
        _ => Err("len() needs a string or table".into()),
    }
}`,
          },
          explain: [
            "Natives check their own argument types. Wisp can't know in advance what `sqrt` expects, so the native is where that knowledge lives.",
            "`str` uses `&mut Vm` to allocate: it builds a Rust `String` with `show`, then interns it as a Wisp string. That's the pattern for any native that returns an object.",
            "Want to call real C libraries? The `libloading` crate opens a shared library and finds a symbol, and a native can wrap that call. That's the same job Panama does for Java.",
          ],
        },
        {
          title: "Try it",
          body: "Time a function call with the new clock.",
          code: {
            lang: "wisp",
            caption: "natives.wisp",
            code: `fn fib(n) { if n < 2 { return n }  return fib(n - 1) + fib(n - 2) }
let start = clock()
let result = fib(25)
print "fib(25) = " + str(result)
print "took " + str(clock() - start) + "s"
print sqrt(16) + len("wisp")`,
          },
          output: `fib(25) = 75025
took 0.0412s
8`,
          explain: ["Your timing will differ. Note it down: it's the baseline for the performance lesson."],
        },
      ],
    },
    questions: [
      {
        q: "Why does a native get the whole VM instead of just its arguments?",
        intuition: "Most useful natives need to do VM things: create a string, read a table, call a callback. Passing the VM lets them, the same way JNI passes a `JNIEnv*` to every native method.",
        technical:
          "`&mut Vm` gives safe, borrow-checked access to the heap and the interpreter. The catch is GC safety: an `ObjRef` the native creates and keeps only in a Rust local isn't a root. If the native allocates twice, push the first result onto the VM stack first. JNI's local references exist to solve exactly this problem.",
      },
      {
        q: "Could a native be faster than the same function written in Wisp?",
        intuition: "Usually, yes. `sqrt` in Rust is one machine instruction, while in Wisp it would be a whole loop of bytecode. That's why standard libraries are mostly native.",
        technical:
          "Each native call still costs a dispatch, an argument copy and a type check, so tiny natives called in hot loops can be dominated by that overhead. JVMs solve this with JIT **intrinsics**: `Math.sqrt` compiles straight to `sqrtsd`, with no call at all.",
      },
      {
        q: "What should happen if a native panics?",
        intuition: "The whole program crashes, which is bad for an embeddable VM. Natives should return `Err` for anything a script could cause.",
        technical:
          "A Rust panic unwinds through the interpreter and kills the process unless it's caught. You can wrap native calls in `std::panic::catch_unwind` and turn panics into runtime errors. Panics across an `extern \"C\"` boundary are a bigger problem, so wrappers around C libraries must never let one escape.",
      },
    ],
    references: [
      { title: "JEP 454: Foreign Function & Memory API", by: "OpenJDK", url: "https://openjdk.org/jeps/454", kind: "spec", note: "How modern Java calls native code without JNI." },
      { title: "Crafting Interpreters: Native Functions", by: "Robert Nystrom", url: "https://craftinginterpreters.com/calls-and-functions.html#native-functions", kind: "book" },
    ],
  },

  /* ───────────────────────────── 12 · Tooling ───────────────────────────── */
  {
    slug: "tooling",
    title: "Stack Traces, Dumps & a REPL",
    level: "Intermediate",
    accent: "blue",
    icon: "SquareTerminal",
    summary: "Make the VM pleasant to use: stack traces built from frames and line tables, a full bytecode dump, and an interactive REPL, modelled on printStackTrace, javap and jshell.",
    tags: ["Stack traces", "javap-style dump", "REPL", "Diagnostics"],
    intro: [
      "A VM is only as good as what it tells you when something goes wrong. The JVM is famous for its tooling: every exception carries a full stack trace with file names and line numbers, `javap` shows any class's bytecode, and `jshell` lets you try code one line at a time.",
      "You already have the raw material for all three. The frames know which function is running, the line tables map instructions to lines, and the compiler can compile any snippet. This lesson turns them into tools.",
    ],
    sim: "flow",
    simTitle: "From a failing instruction to a stack trace",
    flow: [
      { label: "Error", sub: "Div on nil" },
      { label: "Frames", sub: "walk top → bottom" },
      { label: "ip → line", sub: "chunk.lines[ip-1]" },
      { label: "Trace", sub: "at divide() line 1" },
    ],
    jvm: {
      title: "What JVM tooling teaches us",
      points: [
        "A `Throwable` captures its stack trace when it's created by walking the thread's frames. Each `StackTraceElement` is a method plus a line number from that method's `LineNumberTable`.",
        "`javap -c -p` disassembles every method in a class, including private and synthetic ones like lambda bodies. Your dump should show nested functions too.",
        "`jshell` (Java 9+) compiles each snippet as it's typed and keeps the state between them. A REPL is just the normal pipeline in a loop with a VM that stays alive.",
        "Flags such as `-Xlog:gc` and tools like Java Flight Recorder show what the VM is doing inside. Our `--gc-log` is the beginning of that.",
      ],
    },
    concepts: [
      {
        heading: "Where the line numbers come from",
        body: [
          "Every frame except the top one saved its `ip` when it made a call, and `ip - 1` is that `Call` instruction. The top frame's `ip` is the local variable in `run`, pointing just past the instruction that failed. Look each one up in its function's `lines` table and you have a line number for every level of the trace. No extra bookkeeping is needed at runtime.",
        ],
      },
    ],
    build: {
      intro: "Three small, independent tools. Each one makes debugging the rest of your VM easier.",
      milestone: "errors print a full stack trace, `--dump` shows all bytecode, and running `wisp` with no file opens a REPL.",
      steps: [
        {
          title: "Stack traces",
          body: "Replace `error(chunk, ip, msg)` with a version that walks every frame. Its call sites only change from `self.error(&func.chunk, ip, ...)` to `self.error(ip, ...)`.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `fn error(&self, ip: usize, msg: &str) -> String {
    let mut out = format!("runtime error: {msg}");
    let top = self.frames.len() - 1;
    // innermost call first, like a Java stack trace
    for (i, frame) in self.frames.iter().enumerate().rev() {
        // the top frame's ip is run()'s local; every other frame saved its ip when it called
        let at = if i == top { ip } else { frame.ip };
        let line = frame.func.chunk.lines[at - 1]; // at - 1: the instruction that ran
        out.push_str(&format!("\\n  at {}() line {line}", frame.func.name));
    }
    out
}`,
          },
          explain: [
            "The output below comes from a four-line script: `fn divide(a, b) { return a / b }`, then `fn average(t) { return divide(t.sum, t.count) }`, a blank line, and `print average({ sum: 10 })`. `t.count` is a missing field, so it reads as `nil`, and the division fails.",
            "Caller frames' saved `ip`s point just past their `Call` instruction, so `at - 1` lands on the call itself, which is the line you want to see in a trace.",
            "After an error, `run` returns early and leaves the frames on the stack. That's fine for a script, which exits, but the REPL below has to clean them up.",
          ],
          output: `runtime error: operands must be numbers
  at divide() line 1
  at average() line 2
  at script() line 4`,
          jvm: "Capturing a stack trace is surprisingly expensive in Java, because it walks every frame and resolves every line at the moment the exception is created. That's why high-performance code sometimes reuses exceptions or turns off `writableStackTrace`. We only build the trace when an error is actually reported.",
        },
        {
          title: "A full bytecode dump",
          body: "Nested functions live in their parent's constant pool, so dumping the script recursively dumps everything, like `javap -c -p` on every class at once.",
          code: {
            lang: "rust",
            caption: "src/main.rs (changes)",
            code: `/// Disassemble a function, then every function in its constant pool.
fn dump(heap: &Heap, f: &Function) {
    f.chunk.disassemble(&f.name);
    for &c in &f.chunk.consts {
        if let Value::Obj(r) = c {
            if let Obj::Function(inner) = heap.get(r) {
                dump(heap, inner); // nested functions, closures, lambdas
            }
        }
    }
}

// in run(): wisp --dump file.wisp
if dump_flag {
    if let Obj::Function(f) = vm.heap.get(script) {
        dump(&vm.heap, f);
    }
}`,
          },
          explain: [
            "This is the most useful debugging tool in the course. Whenever a program behaves strangely, look at the bytecode first. Most compiler bugs are obvious once you see the instructions.",
            "Extend `disassemble` as you go: print the field name for `GetField`, the capture list for `Closure`, and the target for jumps. Small touches like these make the output much easier to read.",
          ],
        },
        {
          title: "A REPL",
          body: "Read a line, run it through the full pipeline on a VM that stays alive, and repeat. Globals persist between lines, because it's the same VM.",
          code: {
            lang: "rust",
            caption: "src/main.rs (changes)",
            code: `fn repl() {
    let mut vm = Vm::new(); // one VM for the whole session: globals persist
    loop {
        print!("wisp> ");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();
        let mut line = String::new();
        if std::io::stdin().read_line(&mut line).unwrap() == 0 {
            break; // Ctrl-D: end of input
        }
        let result = lexer::lex(&line)
            .and_then(parser::parse)
            .and_then(|program| compiler::compile(&program, &mut vm.heap))
            .and_then(|script| {
                let closure = vm.new_closure(script);
                vm.execute(closure)
            });
        if let Err(e) = result {
            eprintln!("{e}");
            vm.reset(); // an error leaves frames and values behind: clear them
        }
    }
}

// in Vm
pub fn reset(&mut self) {
    self.stack.clear();
    self.frames.clear();
    self.open_upvalues.clear();
}

// in main(): no file argument starts the REPL
let Some(path) = env::args().nth(1) else { return repl() };`,
          },
          explain: [
            "Each line is compiled as its own tiny script, so `let x = 1` at the prompt defines a **global**. That's why it's still there on the next line.",
            "`and_then` chains the four stages and stops at the first error, the same as the `?` operator in `run`, written as a chain.",
            "A nice upgrade: if a line is a single expression statement, print its value instead of discarding it, so `1 + 2` shows `3` the way `jshell` does.",
          ],
          output: `wisp> let x = 20
wisp> fn double(n) { return n * 2 }
wisp> print double(x) + 2
42`,
        },
      ],
    },
    questions: [
      {
        q: "Why does my stack trace stop at the import when the error is inside a module?",
        intuition: "It shouldn't. The importer's frames are still on the frame stack while the module runs, so the trace includes both.",
        technical:
          "`execute` pushes the module's frames on top of the importer's frames, and the nested `run` shares `self.frames`. `error` walks all of them. If you see a truncated trace, check that `Import` saved `ip` in the importer's frame before re-entering, or that frame's line will be wrong.",
      },
      {
        q: "How would I add try/catch to Wisp?",
        intuition: "Remember where the `try` started. When an error happens, throw away everything above that point and jump to the `catch` code.",
        technical:
          "The compiler emits `PushHandler(catch_target)` and `PopHandler`. The VM keeps a handler stack of (frame depth, stack height, target). On an error, it pops frames down to the handler's depth, closes upvalues, truncates the stack, pushes the error value, and jumps. The JVM does the same with a per-method **exception table** of (start, end, handler, type) ranges, which costs nothing until something is thrown.",
      },
      {
        q: "How do I find out where my VM spends its time?",
        intuition: "Count. Add a counter per opcode and print the totals at exit. It's crude but very revealing.",
        technical:
          "A `[u64; N]` indexed by opcode, incremented in the loop behind a `--profile` flag, shows which instructions dominate. For real profiling of the Rust code, use `cargo flamegraph` or `perf`. The next lesson uses both kinds of numbers to decide what to optimize.",
      },
    ],
  },

  /* ───────────────────────────── 13 · Performance & JIT ───────────────────────────── */
  {
    slug: "jit",
    title: "Making It Fast",
    level: "Advanced",
    accent: "rose",
    icon: "Rocket",
    summary: "Measure first, then speed up the VM: release builds, constant folding, cheaper globals and hotness counters. Plus how HotSpot's tiered JIT takes it further.",
    tags: ["Benchmarking", "Constant folding", "Hotness counters", "Tiered JIT"],
    intro: [
      "HotSpot runs Java at native speed by watching the program and compiling the parts that run often. Before any of that, it's an interpreter like yours, and the same rules apply: measure, find the hot spot, make it cheaper, and measure again.",
      "This lesson adds the optimizations that matter most for a simple VM and that don't make the code hard to understand. Then it explains what a JIT adds on top, using HotSpot's tiers as the map.",
    ],
    sim: "jit",
    simTitle: "Interpreter → profile → compiled code",
    jvm: {
      title: "What HotSpot's tiers teach us",
      points: [
        "Code starts in the **interpreter**, which also counts method calls and loop back-edges. Counters are cheap and tell the VM where time is going.",
        "Methods that cross a threshold are compiled by **C1**, a fast compiler that also adds profiling (which types appear, which branches are taken). Very hot code is recompiled by **C2** using that profile.",
        "C2's best tricks are **speculative**: if `x` has only ever been an `Integer` here, compile for that, and **deoptimize** back to the interpreter if the guess is ever wrong.",
        "Long-running loops can switch from interpreted to compiled code in the middle of the loop. That's **on-stack replacement**, triggered by the back-edge counter.",
      ],
    },
    concepts: [
      {
        heading: "Where an interpreter's time goes",
        body: [
          "For each instruction there's the dispatch (the `match` jump), the operand checks (is it a number?), the stack traffic (push and pop through a `Vec`) and the actual work, which is often a single add. The work is usually the smallest part. Optimizations either remove instructions entirely (folding, superinstructions) or make each remaining one cheaper (faster lookups, less checking).",
        ],
      },
      {
        heading: "What a JIT would add",
        body: [
          "A **baseline JIT** translates each function's bytecode into machine code, one instruction template at a time. That removes dispatch entirely, typically a 2–5× gain. In Rust the practical route is **Cranelift**, the code generator used by Wasmtime: you build its IR for each `Op` and it emits machine code.",
          "An **optimizing JIT** uses profiles to specialize: if `a + b` has only seen numbers, emit a float add guarded by a cheap tag check, and fall back to the interpreter when the check fails. That's the C2 idea, and it's a project measured in months. The counters in this lesson are the first step either way, because a JIT needs to know what's hot.",
        ],
      },
    ],
    build: {
      intro: "Four improvements, in order of effort. Re-run your `fib(25)` timing after each one.",
      milestone: "a measurably faster VM, and a `--trace-hot` flag that reports what a JIT would compile.",
      steps: [
        {
          title: "Build for speed",
          body: "Debug builds of an interpreter are often 10–30× slower than release builds. Always benchmark with `--release`, and turn on the settings that help a big `match` loop most.",
          code: {
            lang: "text",
            caption: "Cargo.toml",
            code: `[profile.release]
opt-level = 3
lto = "fat"        # optimize across modules: inlines push/pop into the loop
codegen-units = 1  # one unit: better inlining, slower build
panic = "abort"    # no unwinding tables in the hot loop`,
          },
          explain: [
            "Run benchmarks several times and take the best or the median. The first run includes disk caching and CPU frequency changes.",
          ],
        },
        {
          title: "Constant folding",
          body: "If both sides of an operator are number literals, the compiler can do the maths itself and emit one `Const` instead of three instructions.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (Expr::Binary)",
            code: `Expr::Binary(a, op, b, line) => {
    // both sides are literals? compute the result now, at compile time
    if let (Expr::Num(x), Expr::Num(y)) = (a.as_ref(), b.as_ref()) {
        let folded = match op {
            Tok::Plus => Some(x + y),
            Tok::Minus => Some(x - y),
            Tok::Star => Some(x * y),
            Tok::Slash => Some(x / y),
            _ => None, // comparisons could fold too
        };
        if let Some(n) = folded {
            let k = self.cur().chunk.add_const(Value::Num(n));
            self.emit(Op::Const(k));
            return Ok(());
        }
    }
    // ...otherwise compile as before
}`,
          },
          explain: [
            "`60 * 60 * 24` becomes a single `Const 86400`. This version only folds when *both* children are literals. To fold whole trees, run a small pass that rewrites the AST bottom-up before compiling.",
          ],
          jvm: "`javac` folds constant expressions too, including `static final` fields. `static final int DAY = 60 * 60 * 24` is stored as the single constant 86400, and every use of `DAY` in other classes is replaced by that number at compile time.",
        },
        {
          title: "Key globals by interned name",
          body: "Every `GetGlobal` currently hashes a `String`, and `fib` looks itself up on every call. Since strings are interned, use the name's `ObjRef` as the key. Hashing a `u32` is far cheaper than hashing text.",
          code: {
            lang: "rust",
            caption: "compiler.rs and vm.rs (changes)",
            code: `// compiler: global names become ordinary string constants (chunk.names goes away)
let k = self.str_const(name);
self.emit(Op::GetGlobal(k));

// vm: globals keyed by the interned name
globals: HashMap<ObjRef, Value>,

Op::GetGlobal(k) => {
    let Value::Obj(name) = func.chunk.consts[k as usize] else { unreachable!() };
    let Some(&v) = self.globals.get(&name) else {
        let msg = format!("undefined variable '{}'", self.heap.show(Value::Obj(name)));
        return Err(self.error(ip, &msg));
    };
    self.push(v);
}

// gc: the keys are heap strings now, so they're roots too
roots.extend(self.globals.keys());`,
          },
          explain: [
            "This removes the separate `names` pool from lesson 03, which existed only because `Value` had no strings back then. Now everything is a constant, like the JVM's single constant pool.",
            "Going further: give each global a numbered slot when it's first defined, and rewrite `GetGlobal(name)` into `GetGlobalSlot(i)` on first execution. That's **quickening**, the technique HotSpot uses when it rewrites `getfield` into its fast internal form.",
          ],
        },
        {
          title: "Hotness counters",
          body: "Count calls per function and report when one crosses a threshold. This is exactly the signal HotSpot uses to decide what to JIT-compile. You can't build a JIT without it, and it's useful profiling on its own.",
          code: {
            lang: "rust",
            caption: "object.rs and vm.rs (changes)",
            code: `use std::cell::Cell;

pub struct Function {
    // ...name, arity, chunk, upvalues...
    pub calls: Cell<u32>, // Cell: we can update it through the shared Rc
}

// in Op::Call, closure branch
let n = callee.calls.get() + 1;
callee.calls.set(n);
if n == 1_000 && self.trace_hot {
    eprintln!("[hot] {}() reached {n} calls: a JIT would compile it now", callee.name);
}`,
          },
          explain: [
            "`Cell` allows changing the counter through a shared `&Function`, because the function sits behind an `Rc` that the frames and closures share. A `Cell<u32>` costs nothing beyond the 4 bytes.",
            "Count loop back-edges the same way in `Op::Loop`. A loop that runs millions of times inside a function called once is hot too, and that's what on-stack replacement is for.",
          ],
          output: `[hot] fib() reached 1000 calls: a JIT would compile it now
75025`,
          jvm: "Run any Java program with `-XX:+PrintCompilation` to see the same thing for real: each line is a method crossing a threshold and being compiled by C1 (tiers 1–3) or C2 (tier 4). By default, tier 3 compilation is triggered at about 200 invocations, and C2 at around 5,000–15,000.",
        },
      ],
    },
    questions: [
      {
        q: "Should my VM represent values with NaN-boxing?",
        intuition: "NaN-boxing hides pointers and small values inside the unused bits of a special floating-point number, so every value fits in 8 bytes instead of 16. It's a real speedup, but it needs `unsafe` code and careful bit manipulation.",
        technical:
          "A 64-bit double has around 2^52 NaN bit patterns that hardware never produces, enough to encode nil, booleans and 48-bit pointers or indices. It halves stack and table memory and makes copies cheaper. It's best done once the VM is stable, behind `Value`'s methods so the rest of the code doesn't change.",
      },
      {
        q: "Why is Java fast if it starts out interpreted?",
        intuition: "Because most programs spend almost all their time in a small part of their code. The JVM only has to compile that part, and the interpreter's slowness elsewhere hardly matters.",
        technical:
          "The interpreter is also a profiler. By the time C2 compiles a method, it knows the actual types and branch frequencies, so it can inline across virtual calls and remove checks that an ahead-of-time compiler would have to keep. Speculation plus deoptimization is why JIT-compiled Java can beat statically compiled code on some workloads.",
      },
      {
        q: "What's the next optimization after this lesson?",
        intuition: "Look at your opcode counters. The most frequent instruction pairs are candidates to merge into one instruction.",
        technical:
          "\"Superinstructions\" such as `GetLocal + GetLocal + Add` or a fused `LessThanJumpIfFalse` cut dispatch counts in hot loops. After that, inline caches for `GetField` (once you have shapes) usually give the next big win. Beyond that, it's a baseline JIT.",
      },
    ],
    references: [
      { title: "Cranelift", by: "Bytecode Alliance", url: "https://cranelift.dev/", kind: "article", note: "The Rust code generator to use if you build a JIT." },
      { title: "JVM Anatomy Quarks", by: "Aleksey Shipilëv", url: "https://shipilev.net/jvm/anatomy-quarks/", kind: "article", note: "Many entries show the JIT's tricks with real assembly." },
    ],
  },

  /* ───────────────────────────── 14 · Fibers ───────────────────────────── */
  {
    slug: "concurrency",
    title: "Fibers",
    level: "Advanced",
    accent: "violet",
    icon: "GitBranch",
    summary: "Run many lightweight tasks on one thread: give each fiber its own stack and frames, switch with `yield`, and schedule them round-robin. Java's virtual threads, in miniature.",
    tags: ["Fibers", "spawn · yield", "Scheduler", "Virtual threads"],
    intro: [
      "Java 21's **virtual threads** let a program have a million concurrent tasks without a million OS threads. Each virtual thread's stack can be unmounted from its carrier thread when it waits, and remounted later, possibly on a different carrier.",
      "Your VM is already well set up for this. A running program's whole state is the value stack, the frames and the open upvalues. Give each task its own copy of those three, and switching tasks is just swapping which copy the VM is using. That's a **fiber**.",
    ],
    sim: "fibers",
    simTitle: "Fibers taking turns on one thread",
    jvm: {
      title: "What Loom teaches us",
      points: [
        "A virtual thread is a **continuation** (a suspended stack) plus a scheduler. When it blocks, its frames are saved to the heap and its carrier thread runs something else.",
        "Virtual threads are cheap enough to create one per task, so you don't pool them. Most of the cost of a platform thread is its OS stack and kernel scheduling.",
        "A virtual thread gets **pinned** to its carrier when it blocks while a native frame is on its stack, because native frames can't be moved to the heap. Until Java 24, `synchronized` blocks pinned too.",
        "The default scheduler is a work-stealing `ForkJoinPool`. Scheduling is policy: the continuation mechanism doesn't care which task runs next.",
      ],
    },
    concepts: [
      {
        heading: "Cooperative switching",
        body: [
          "Wisp fibers switch only when the running fiber says `yield`. That's **cooperative** scheduling. It's simple and safe, because a fiber can never be interrupted halfway through updating a table. The next lesson adds preemption, so a fiber that never yields can't hog the VM.",
          "Because each fiber has its own `Vec`s, a switch is three `mem::replace` calls, a few pointer swaps. Loom has to copy stack frames because Java frames live on a native thread stack. Ours already live in heap-allocated `Vec`s.",
        ],
      },
    ],
    build: {
      intro: "Two keywords, two instructions, a `Fiber` struct and a run queue.",
      milestone: "`spawn f` starts a task, `yield` passes control, and the program ends when every fiber has finished.",
      steps: [
        {
          title: "Fiber state and switching",
          body: "A fiber is the three per-task pieces of VM state. The running fiber's state stays in the VM's own fields, so the interpreter loop doesn't change. Parked fibers wait in a queue.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `/// A parked task: everything needed to resume it later.
pub struct Fiber {
    stack: Vec<Value>,
    frames: Vec<CallFrame>,
    open_upvalues: Vec<ObjRef>,
}
// Vm gains:  ready: VecDeque<Fiber>   (and collect() adds every parked fiber's values,
//                                      frames and open upvalues to the roots)

impl Vm {
    /// Install \`next\` as the running fiber and hand back the one that was running.
    fn switch_to(&mut self, next: Fiber) -> Fiber {
        Fiber {
            stack: std::mem::replace(&mut self.stack, next.stack),
            frames: std::mem::replace(&mut self.frames, next.frames),
            open_upvalues: std::mem::replace(&mut self.open_upvalues, next.open_upvalues),
        }
    }

    /// Save our place, move to the back of the queue, and run the next fiber.
    /// Returns false if nobody else is waiting (then we just keep running).
    fn yield_fiber(&mut self, ip: usize) -> bool {
        let Some(next) = self.ready.pop_front() else { return false };
        self.frames.last_mut().unwrap().ip = ip;
        let parked = self.switch_to(next);
        self.ready.push_back(parked);
        true
    }

    /// The hot state of whatever frame is now on top.
    fn hot_state(&self) -> (ObjRef, Rc<Function>, usize, usize) {
        let f = self.frames.last().unwrap();
        (f.closure, f.func.clone(), f.ip, f.base)
    }
}`,
          },
          explain: [
            "`mem::replace` puts the new fiber's `Vec` in place and returns the old one, moving only the `Vec` headers (pointer, length, capacity), never the contents. That's why a switch costs almost nothing however deep the fiber's stack is.",
            "Parked fibers are GC roots. A fiber waiting in the queue still has live variables, so `collect` must walk the `ready` queue as well as the running stack.",
          ],
          jvm: "Loom's `Continuation.yield` does the equivalent of `switch_to`, but because Java frames live on the carrier's native stack, it has to copy them into a heap `StackChunk` object, and copy them back (lazily, a few at a time) when resuming.",
        },
        {
          title: "spawn and yield",
          body: "`spawn expr` takes a closure with no parameters and queues it as a new fiber. `yield` lets the next fiber run. When a fiber finishes, the next one takes over.",
          code: {
            lang: "rust",
            caption: "front end and src/vm.rs (changes)",
            code: `// lexer: keywords Spawn, Yield.  parser (in statement()):
Tok::Spawn => { self.advance(); Ok(Stmt::Spawn(self.expr(0)?)) }
Tok::Yield => { self.advance(); Ok(Stmt::Yield) }
// compiler:  Stmt::Spawn(e) => { self.expr(e)?; self.emit(Op::Spawn); }
//            Stmt::Yield    => { self.emit(Op::Yield); }

Op::Spawn => {
    let Value::Obj(c) = self.pop() else { return Err(self.error(ip, "spawn needs a function")) };
    let func = self.func_of(c);
    // a brand-new stack holding one frame, set up exactly as a call would be
    self.ready.push_back(Fiber {
        stack: vec![Value::Obj(c)], // slot 0: the callee
        frames: vec![CallFrame { closure: c, func, ip: 0, base: 1 }],
        open_upvalues: Vec::new(),
    });
}

Op::Yield => {
    if stop_at > 0 {
        // inside an import or a native callback: Rust frames are on the stack (pinning)
        return Err(self.error(ip, "can't yield here"));
    }
    if self.yield_fiber(ip) {
        (closure, func, ip, base) = self.hot_state();
    }
}

// in Op::Return, replacing the stop_at check:
if self.frames.len() == stop_at {
    if stop_at == 0 {
        if let Some(next) = self.ready.pop_front() {
            self.switch_to(next); // this fiber is finished: drop it, run the next one
            (closure, func, ip, base) = self.hot_state();
            continue;
        }
    }
    return Ok(()); // nothing left to run
}`,
          },
          explain: [
            "The main script is a fiber too. It just happens to be the one running at the start. Whichever fiber finishes last ends the program.",
            "Yielding inside a nested `run` (a module body or a native's callback) is refused. The importer's `run` is a Rust stack frame that can't be parked in a `Vec`. That's the same reason Loom pins a virtual thread with a native frame on its stack.",
            "Fibers can share tables and globals freely: only one runs at a time, and switches happen only at `yield`, so no update is ever half-finished when another fiber looks.",
          ],
        },
        {
          title: "Try it",
          body: "Two workers take turns with the main script. `str` is the native from lesson 11.",
          code: {
            lang: "wisp",
            caption: "fibers.wisp",
            code: `fn worker(name) {
  return fn() {
    let i = 1
    while i <= 3 {
      print name + str(i)
      i = i + 1
      yield
    }
  }
}
spawn worker("a")
spawn worker("b")
print "main"
yield`,
          },
          output: `main
a1
b1
a2
b2
a3
b3`,
          explain: [
            "The main script prints and yields, so `a` runs. `a` yields to `b`, `b` yields back to main, and main reaches the end of the script and finishes. From then on `a` and `b` alternate until both loops end.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Is this real parallelism?",
        intuition: "No. It's concurrency: many tasks making progress by taking turns on one thread. Parallelism means running at the same time on several cores.",
        technical:
          "One OS thread runs all fibers, so CPU-bound work doesn't get faster. Fibers shine for I/O-bound work: a fiber waiting on a socket parks itself, and others run in the meantime. To use several cores, run one VM per thread (isolates) and pass messages between them, which avoids sharing a heap.",
      },
      {
        q: "How would a fiber wait for a network request without blocking the others?",
        intuition: "Ask the operating system to tell you when the data is ready, park the fiber until then, and run the others in the meantime.",
        technical:
          "Add a native like `read(socket)` that starts a non-blocking operation, registers the current fiber with an event loop (using `mio` or `epoll`), and parks it in a waiting set instead of the ready queue. When the scheduler's run queue is empty, it blocks on the event loop and moves fibers whose I/O completed back to `ready`. That's how Loom makes blocking calls in virtual threads cheap.",
      },
      {
        q: "Why do Java's virtual threads need a work-stealing scheduler when one queue works here?",
        intuition: "Java runs virtual threads on several carrier threads in parallel. With many workers, a single shared queue becomes a traffic jam.",
        technical:
          "A `ForkJoinPool` gives each carrier its own deque and lets idle carriers steal from busy ones, avoiding contention on one lock. With one thread there's no contention at all, so a `VecDeque` is the right choice. Scheduling is the replaceable part: the switching mechanism stays the same.",
      },
    ],
    references: [
      { title: "JEP 444: Virtual Threads", by: "OpenJDK", url: "https://openjdk.org/jeps/444", kind: "spec", note: "The design and its trade-offs, including pinning." },
    ],
  },

  /* ───────────────────────────── 15 · Safepoints ───────────────────────────── */
  {
    slug: "safepoints",
    title: "Safepoints & Preemption",
    level: "Advanced",
    accent: "amber",
    icon: "OctagonPause",
    summary: "Stop a fiber that never yields: a timer thread raises a flag, and the interpreter checks it at loop back-edges, the same polling mechanism as HotSpot's safepoints.",
    tags: ["Safepoint polls", "Preemption", "Atomics", "Memory model"],
    intro: [
      "A fiber that loops forever without `yield` freezes every other fiber. The VM needs a way to say \"stop at the next convenient point\", but it can't interrupt a Rust function in the middle of an instruction.",
      "HotSpot has the same problem whenever it needs every thread to pause, for a GC or for deoptimization. Its answer is the **safepoint**: compiled and interpreted code checks a flag at regular places, and the threads stop themselves when it's set. You'll build the same thing, and use it for preemptive fiber scheduling.",
    ],
    sim: "safepoints",
    simTitle: "Threads reaching a safepoint",
    jvm: {
      title: "What safepoints and the JMM teach us",
      points: [
        "Threads can only be stopped at **safepoints**: places where the VM knows exactly which slots hold references. Polls sit at method returns and loop back-edges, so a running thread always reaches one soon.",
        "A thread running native code counts as already at a safepoint. It can't touch Java objects without coming back through the VM, so the GC can proceed without waiting for it.",
        "Time-to-safepoint matters: one thread in a long loop without a poll delays every other thread's pause. HotSpot removes polls from short counted loops for speed, which occasionally causes exactly that delay.",
        "The **Java Memory Model** defines when one thread's writes become visible to another: `volatile`, `synchronized` and the `java.util.concurrent` atomics create *happens-before* edges. Without them, there's no guarantee.",
      ],
    },
    concepts: [
      {
        heading: "Why poll at back-edges and calls?",
        body: [
          "Any code that runs for a long time must either loop or call (recursion). So if every `Loop` instruction and every call checks the flag, no fiber can run for long without seeing it. Straight-line code between polls is bounded by the size of the function.",
          "In the interpreter, a check at the moment an instruction starts is always safe: every value is on the stack or in the heap, none are held in Rust locals. That's the same property the GC relied on in lesson 09.",
        ],
      },
      {
        heading: "Wisp's memory model, in one sentence",
        body: [
          "\"Fibers on one VM never run at the same time, so every write is visible to the next fiber that runs.\" That's the whole model, and it's possible because Wisp doesn't share a heap between OS threads. If you ever do, you'll need the full JMM treatment: atomics, locks and a precise definition of happens-before.",
        ],
      },
    ],
    build: {
      intro: "An atomic flag, a background thread that sets it, and a poll at `Loop` that yields when it's set.",
      milestone: "two fibers that never call `yield` still take turns.",
      steps: [
        {
          title: "A preemption flag and a ticker thread",
          body: "The flag is shared between the VM thread and a timer thread, so it has to be an atomic. The timer sets it every 10 ms, and the VM clears it when it yields.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

// Vm gains:  preempt: Arc<AtomicBool>

impl Vm {
    /// Start a background thread that asks the running fiber to yield every \`slice\`.
    pub fn start_preemption(&self, slice: Duration) {
        let flag = Arc::clone(&self.preempt);
        std::thread::spawn(move || loop {
            std::thread::sleep(slice);
            flag.store(true, Ordering::Relaxed); // "whoever is running: yield soon, please"
        });
    }
}`,
          },
          explain: [
            "The timer thread never touches the VM itself, only the flag. That's the whole point: the VM decides *where* to stop, and the other thread only *asks*.",
            "`Ordering::Relaxed` is enough because the flag carries no other data. We only need the VM to notice the `true` eventually, not to see any other memory in a particular order. If the flag also handed over data, you'd use `Release` when storing and `Acquire` when loading.",
          ],
          jvm: "HotSpot used to poll a global memory page and protect it to trigger the stop. Since JDK 10, **thread-local handshakes** let the VM stop one thread at a time, using a per-thread poll word. That's the same per-flag idea as ours.",
        },
        {
          title: "Poll at the back-edge",
          body: "`Loop` is where every long-running loop passes through. Check the flag there, and yield if it's set. Use `swap` so the check and the reset are one atomic step.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (Op::Loop)",
            code: `Op::Loop(target) => {
    ip = target as usize;
    // SAFEPOINT POLL: cheap when nothing is pending (one atomic load)
    if stop_at == 0 && self.preempt.swap(false, Ordering::Relaxed) {
        if self.yield_fiber(ip) {
            (closure, func, ip, base) = self.hot_state();
        }
    }
}

// Op::Call gets the same check, for programs that recurse instead of loop.`,
          },
          explain: [
            "`ip` is set to the loop target **before** yielding, so the fiber resumes at the top of its loop, exactly as if it had executed `Loop` normally.",
            "`stop_at == 0` skips the poll inside nested runs (imports, native callbacks), where a fiber can't be parked. The flag stays set, and the fiber yields at the first poll after it returns to the top level.",
            "The cost when nothing is pending is one atomic load per back-edge, a few CPU cycles and invisible in benchmarks. HotSpot's compiled code pays the same price for its polls.",
          ],
        },
        {
          title: "Try it",
          body: "Neither worker yields, but with preemption on they still interleave. Call `vm.start_preemption(Duration::from_millis(10))` in `main`.",
          code: {
            lang: "wisp",
            caption: "preempt.wisp",
            code: `fn spin(name) {
  return fn() {
    let i = 0
    while i < 3000000 { i = i + 1 }
    print name + " done"
  }
}
spawn spin("slow")
spawn spin("also slow")
print "main done"`,
          },
          output: `main done
slow done
also slow done`,
          explain: [
            "Without preemption, \"slow\" would run to completion before \"also slow\" even started. With it, both loops advance in 10 ms slices. Add a `print` inside the loops every 500,000 iterations to watch them take turns.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why can't the VM just stop a fiber anywhere, like an OS can stop a thread?",
        intuition: "An OS saves every CPU register, so it can resume the thread from any point. Our VM keeps live values in Rust locals during an instruction, and switching then would lose them.",
        technical:
          "Mid-instruction, a value may exist only in a Rust local, invisible to both the GC and the fiber switch. At instruction boundaries everything is on the VM stack. That's what makes a point \"safe\". The JVM has the same constraint for compiled code: only at safepoints do its stack maps describe every live reference.",
      },
      {
        q: "What's a \"time-to-safepoint\" problem?",
        intuition: "One thread that takes a long time to reach its next poll keeps everyone else waiting, even if the actual pause is tiny.",
        technical:
          "HotSpot omits polls from counted loops with `int` indexes for speed, so a single long loop can delay a GC pause by seconds. Loop strip mining (JDK 10+) splits such loops into chunks with a poll between them. In Wisp, every `Loop` polls, so this can't happen, apart from long-running natives.",
      },
      {
        q: "If I wanted real multi-threaded Wisp, where would I start?",
        intuition: "The safest route is one VM per thread with no shared heap, sending messages between them. Sharing one heap across threads is what makes the JVM so complicated.",
        technical:
          "Isolates (as in JavaScript workers and Dart) need only a thread-safe channel and a way to copy or serialize values between heaps. A shared heap needs locking or lock-free tables, a GC that stops all threads at safepoints (this lesson, for every thread), and a memory model that says when writes become visible.",
      },
    ],
    references: [
      { title: "JEP 312: Thread-Local Handshakes", by: "OpenJDK", url: "https://openjdk.org/jeps/312", kind: "spec", note: "How HotSpot stops individual threads at safepoints." },
      { title: "JSR-133 (Java Memory Model) FAQ", by: "Jeremy Manson, Brian Goetz", url: "https://www.cs.umd.edu/~pugh/java/memoryModel/jsr-133-faq.html", kind: "article", note: "A readable introduction to happens-before." },
    ],
  },
];
