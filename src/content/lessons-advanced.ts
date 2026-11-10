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
      "A language that can only do arithmetic and print isn't much use. Real programs need the clock, files and maths, and the host language (Rust, for us) already provides all of those. In Java, methods marked `native` are written in C and connected through JNI. `System.currentTimeMillis()` is one of them.",
      "Wisp's version is simpler. A native is a Rust function stored in a heap object. Calling it looks exactly like calling a Wisp function: the function and its arguments are on the stack, and one value comes back.",
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
        "A `native` method has no bytecode. When it's called, the JVM finds a C function by a special name (or one registered with `RegisterNatives`) and calls it, passing a `JNIEnv*`, a handle back into the VM.",
        "Native code can't hold raw pointers to Java objects, because the garbage collector may move them. JNI hands out **handles** that the collector knows about instead.",
        "Native calls are relatively slow and the JIT can't see inside them, so hot JDK natives are often replaced with **intrinsics**: code the JIT generates inline.",
        "Panama's Foreign Function & Memory API (Java 22) calls C functions directly from Java with no hand-written C glue.",
      ],
    },
    concepts: [
      {
        heading: "Same stack, same calling convention",
        body: [
          "Native calls don't need a separate path. `Call(argc)` sees `[.., native, arg0, arg1]`, hands the arguments to the Rust function as a slice, removes the function and arguments, and pushes the result. From the Wisp side, natives and Wisp functions look identical.",
          "The Rust function also receives `&mut Vm`. That's Wisp's version of `JNIEnv*`: the native can create strings, read tables, or even run a Wisp callback with `vm.execute`, thanks to the re-entrant VM from lesson 10.",
        ],
      },
    ],
    build: {
      intro: "One new kind of object, one new case in `Call`, and a few built-in functions.",
      milestone: "`clock()`, `sqrt(x)`, `str(x)` and `len(x)` work in every script and module.",
      steps: [
        {
          section: "Part 1 · The native object",
          title: "Native: a Rust function Wisp can call",
          body: "**What it's for:** wrapping a Rust function so it can live on the heap and be called like any Wisp value. Every native has the same shape: it gets the VM and the arguments, and returns a value or an error message.",
          code: {
            lang: "rust",
            caption: "src/object.rs (changes)",
            code: `use crate::vm::Vm;

/// The shape every native has: the VM, and the arguments it was called with.
pub type NativeFn = fn(&mut Vm, &[Value]) -> Result<Value, String>;

#[derive(Clone, Copy)]
pub struct Native {
    pub name: &'static str, // for error messages
    pub arity: u8,          // how many arguments it expects
    pub f: NativeFn,        // the Rust function itself
}

// a new variant in enum Obj:
Native(Native),

// and a new case in Heap::show:
Obj::Native(n) => format!("<native {}>", n.name),`,
          },
          explain: [
            "`type NativeFn = fn(...)` gives a name to a function type. Any Rust function with exactly that shape can be stored in a `Native`.",
            "`&'static str` is a piece of text built into the program, like `\"sqrt\"`. It lives as long as the program does.",
            "`Native` is `Copy` because it's just a name, a number and a function pointer. That makes it easy to copy out of the heap before calling it.",
          ],
        },
        {
          section: "Part 2 · Calling natives",
          title: "The Call arm learns about natives",
          body: "**What it does:** `Call` now checks what kind of object is being called. Closures go through the frame code from lessons 07–08 as before. Natives run straight away: copy the arguments, call the Rust function, tidy the stack, and push the result.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Call(argc) => {
                    let argc = argc as usize;
                    let Value::Obj(r) = self.peek(argc) else {
                        return Err(self.error(&func.chunk, ip, "can only call functions"));
                    };
                    match self.heap.get(r) {
                        Obj::Closure(_) => { /* push a frame, exactly as in lessons 07–08 */ }
                        Obj::Native(native) => {
                            let native = *native; // copy it out, so we're no longer reading the heap
                            if native.arity as usize != argc {
                                let msg = format!("{}() takes {} arguments but got {argc}", native.name, native.arity);
                                return Err(self.error(&func.chunk, ip, &msg));
                            }
                            let first_arg = self.stack.len() - argc;
                            let args = self.stack[first_arg..].to_vec();
                            self.frames.last_mut().unwrap().ip = ip; // the native might run Wisp code
                            let result = (native.f)(self, &args).map_err(|e| self.error(&func.chunk, ip, &e))?;
                            self.stack.truncate(first_arg - 1); // remove the args and the native itself
                            self.push(result);
                        }
                        _ => return Err(self.error(&func.chunk, ip, "can only call functions")),
                    }
                }`,
          },
          explain: [
            "`self.stack[first_arg..].to_vec()` copies the arguments into their own list. They also **stay** on the stack until the native returns, so if the native creates objects and triggers a collection, its arguments are still roots and survive.",
            "`(native.f)(self, &args)` calls the stored Rust function. The brackets around `native.f` tell Rust \"call the function in this field\".",
            "If the native returns an error string, `map_err` turns it into a normal runtime error with a line number.",
          ],
          jvm: "When HotSpot calls a JNI method, it also records the Java frame before leaving the interpreter, so a stack walk can step over the native part. The thread is then marked as \"in native\", which lesson 15 explains.",
        },
        {
          section: "Part 3 · A small standard library",
          title: "Builtins: a table every module can see",
          body: "**What it's for:** natives need a home. Modules start with empty globals (lesson 10), so storing natives as globals would hide them from modules. Instead they go in a separate `builtins` table, and `GetGlobal` checks there when a name isn't a global.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `// a new Vm field (and collect() treats its values as roots):
//   builtins: HashMap<String, Value>,

impl Vm {
    pub fn define_native(&mut self, name: &'static str, arity: u8, f: NativeFn) {
        let r = self.heap.alloc(Obj::Native(Native { name, arity, f }));
        self.builtins.insert(name.to_string(), Value::Obj(r));
    }
}

// in Op::GetGlobal: if it's not a global, try the builtins
let Some(&v) = self.globals.get(name).or_else(|| self.builtins.get(name)) else { /* undefined */ };

// in Vm::new(), register the natives from the next two steps:
vm.define_native("clock", 0, clock);
vm.define_native("sqrt", 1, sqrt);
vm.define_native("str", 1, str);
vm.define_native("len", 1, len);`,
          },
          explain: ["`.or_else(...)` means \"if the first lookup found nothing, try this one\"."],
        },
        {
          title: "clock() and sqrt(): two simple natives",
          body: "**What they do:** `clock` returns the current time in seconds, which is handy for timing code. `sqrt` returns a square root. Each one is an ordinary Rust function with the `NativeFn` shape.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `fn clock(_vm: &mut Vm, _args: &[Value]) -> Result<Value, String> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap();
    Ok(Value::Num(now.as_secs_f64()))
}

fn sqrt(_vm: &mut Vm, args: &[Value]) -> Result<Value, String> {
    match args[0] {
        Value::Num(n) => Ok(Value::Num(n.sqrt())),
        _ => Err("sqrt() needs a number".into()),
    }
}`,
          },
          explain: [
            "A leading `_` on a parameter name tells Rust \"I know this isn't used\". `clock` needs neither the VM nor any arguments.",
            "Natives check their own argument types. Wisp can't know in advance what `sqrt` expects, so the native is where that knowledge lives.",
          ],
        },
        {
          title: "str() and len(): natives that use the heap",
          body: "**What they do:** `str` turns any value into a string (`str(42)` is `\"42\"`). `len` counts the characters in a string or the fields in a table. Both use `vm` to reach the heap.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `fn str(vm: &mut Vm, args: &[Value]) -> Result<Value, String> {
    let text = vm.heap.show(args[0]);          // the same text \`print\` would show
    Ok(Value::Obj(vm.heap.intern(&text)))      // stored as a Wisp string
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
            "`str` shows the general pattern for natives that return an object: build the result in Rust, then store it on the heap and return the reference.",
            "Want to call real C libraries? The `libloading` crate opens a shared library and finds a function in it, and a native can wrap that call. That's the same job Panama does for Java.",
          ],
        },
        {
          section: "Part 4 · Try it",
          title: "Time a function",
          body: "Use the new clock to measure `fib(25)`.",
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
          explain: ["Your timing will differ. Write it down: it's the starting point for lesson 13."],
        },
      ],
    },
    questions: [
      {
        q: "Why does a native get the whole VM instead of just its arguments?",
        intuition: "Most useful natives need to do VM things: create a string, read a table, run a callback. Passing the VM lets them, the same way JNI passes a `JNIEnv*` to every native method.",
        technical:
          "`&mut Vm` gives safe, checked access to the heap and the interpreter. The catch is GC safety: an `ObjRef` the native creates and keeps only in a Rust variable isn't a root. If the native allocates twice, push the first result onto the VM stack first. JNI's local references exist to solve exactly this.",
      },
      {
        q: "Could a native be faster than the same function written in Wisp?",
        intuition: "Usually, yes. `sqrt` in Rust is one machine instruction, while in Wisp it would be a whole loop of bytecode. That's why standard libraries are mostly native.",
        technical:
          "Each native call still costs a trip around the loop, an argument copy and a type check, so tiny natives called in hot loops can be dominated by that overhead. JVMs solve this with JIT **intrinsics**: `Math.sqrt` compiles straight to the CPU's square-root instruction, with no call at all.",
      },
      {
        q: "What should happen if a native panics?",
        intuition: "The whole program crashes, which is bad for a VM other programs might embed. Natives should return `Err` for anything a script could cause.",
        technical:
          "A Rust panic unwinds through the interpreter and ends the process unless something catches it. You can wrap native calls in `std::panic::catch_unwind` and turn panics into runtime errors. Panics crossing into C code are worse, so wrappers around C libraries must never let one escape.",
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
      "A VM is only as good as what it tells you when something goes wrong. The JVM is famous for its tools: every exception carries a full stack trace with line numbers, `javap` shows any class's bytecode, and `jshell` lets you try code one line at a time.",
      "You already have everything needed to build all three. The frames know which functions are running, the line tables map instructions to source lines, and the compiler can compile any snippet of code. This lesson turns them into tools.",
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
        "A `Throwable` records its stack trace when it's created by walking the thread's frames. Each entry is a method plus a line number from that method's `LineNumberTable`.",
        "`javap -c -p` shows the bytecode of every method in a class, including hidden ones like lambda bodies. Your dump should show nested functions too.",
        "`jshell` (Java 9+) compiles each snippet as you type it and keeps the results between snippets. A REPL is just the normal pipeline in a loop, on a VM that stays alive.",
        "Flags like `-Xlog:gc` and tools like Java Flight Recorder show what the VM is doing inside. Our `--gc-log` is the beginning of that.",
      ],
    },
    concepts: [
      {
        heading: "Where the line numbers come from",
        body: [
          "Every frame except the top one saved its `ip` when it made a call, and `ip - 1` is that `Call` instruction. The top frame's `ip` is `run`'s local variable, pointing just past the instruction that failed. Look each one up in its function's `lines` table and you have a line number for every level of the trace, with no extra bookkeeping while the program runs.",
        ],
      },
    ],
    build: {
      intro: "Three small, independent tools. Each one makes debugging the rest of your VM easier.",
      milestone: "errors print a full stack trace, `--dump` shows all the bytecode, and running `wisp` with no file opens a REPL.",
      steps: [
        {
          section: "Part 1 · Stack traces",
          title: "error(): walk every frame",
          body: "**What it's for:** turning a runtime error into a message that says *where* it happened at every level of the call stack. It replaces `error(chunk, ip, msg)`. Its callers change from `self.error(&func.chunk, ip, ...)` to just `self.error(ip, ...)`.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    fn error(&self, ip: usize, msg: &str) -> String {
        let mut out = format!("runtime error: {msg}");
        let top = self.frames.len() - 1;
        // innermost call first, like a Java stack trace
        for (i, frame) in self.frames.iter().enumerate().rev() {
            // the top frame's ip is run()'s local; every other frame saved its own
            let at = if i == top { ip } else { frame.ip };
            let line = frame.func.chunk.lines[at - 1]; // at - 1: the instruction that ran
            out.push_str(&format!("\\n  at {}() line {line}", frame.func.name));
        }
        out
    }
}`,
          },
          explain: [
            "`.iter().enumerate().rev()` goes through the frames from the newest (the function that failed) back to the oldest (the script).",
            "Caller frames saved an `ip` pointing just past their `Call` instruction, so `at - 1` lands on the call itself, which is the line you want to see.",
            "The output below comes from this four-line script: `fn divide(a, b) { return a / b }`, `fn average(t) { return divide(t.sum, t.count) }`, a blank line, then `print average({ sum: 10 })`. `t.count` doesn't exist, so it reads as `nil` and the division fails.",
          ],
          output: `runtime error: operands must be numbers
  at divide() line 1
  at average() line 2
  at script() line 4`,
          jvm: "Capturing a stack trace is surprisingly expensive in Java, because it walks every frame and works out every line when the exception is *created*. That's why high-performance code sometimes reuses exceptions. We only build the trace when an error is actually reported.",
        },
        {
          section: "Part 2 · A bytecode dump",
          title: "dump(): disassemble everything",
          body: "**What it's for:** printing the bytecode of the whole program, like running `javap -c -p` on every class at once. Nested functions live in their parent's constant pool, so the function disassembles itself, then calls itself on every function constant it finds.",
          code: {
            lang: "rust",
            caption: "src/main.rs (changes)",
            code: `fn dump(heap: &Heap, f: &Function) {
    f.chunk.disassemble(&f.name);
    for &c in &f.chunk.consts {
        if let Value::Obj(r) = c {
            if let Obj::Function(inner) = heap.get(r) {
                dump(heap, inner); // nested functions, closures, lambdas
            }
        }
    }
}

// in run(), when the --dump flag is given:
if let Obj::Function(f) = vm.heap.get(script) {
    dump(&vm.heap, f);
}`,
          },
          explain: [
            "This is the most useful debugging tool in the course. Whenever a program behaves strangely, look at its bytecode first: most compiler bugs are obvious once you see the instructions.",
            "Improve `disassemble` as you go: show the field name for `GetField`, the capture list for `Closure`, and the target of each jump.",
          ],
        },
        {
          section: "Part 3 · A REPL",
          title: "repl(): read, run, repeat",
          body: "**What it's for:** an interactive prompt. Read a line, run it through the normal pipeline on a VM that stays alive, and repeat. Globals persist between lines because it's the same VM every time.",
          code: {
            lang: "rust",
            caption: "src/main.rs (changes)",
            code: `fn repl() {
    let mut vm = Vm::new(); // one VM for the whole session
    loop {
        print!("wisp> ");
        std::io::Write::flush(&mut std::io::stdout()).unwrap(); // show the prompt now
        let mut line = String::new();
        if std::io::stdin().read_line(&mut line).unwrap() == 0 {
            break; // Ctrl-D: no more input
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
            vm.reset(); // clean up what the error left behind (next step)
        }
    }
}

// in main(): no file name means "start the REPL"
let Some(path) = env::args().nth(1) else { return repl() };`,
          },
          explain: [
            "`print!` doesn't end the line, so the text might sit in a buffer. `flush` forces the prompt onto the screen before we wait for input.",
            "`and_then` chains the four stages and stops at the first error. It's the same as the `?` operator in `run`, written as a chain.",
            "Each line is compiled as its own tiny script, so `let x = 1` at the prompt creates a **global**. That's why `x` is still there on the next line.",
          ],
        },
        {
          title: "reset(): recover after an error",
          body: "**What it's for:** when an error happens, `run` returns straight away and leaves its frames and values behind. In a script that doesn't matter, because the program exits. The REPL keeps going, so it clears them first.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    pub fn reset(&mut self) {
        self.stack.clear();
        self.frames.clear();
        self.open_upvalues.clear();
    }
}`,
          },
          output: `wisp> let x = 20
wisp> fn double(n) { return n * 2 }
wisp> print double(x) + 2
42`,
          explain: ["A nice upgrade: if a line is a single expression, print its value instead of discarding it, so typing `1 + 2` shows `3` the way `jshell` does."],
        },
      ],
    },
    questions: [
      {
        q: "Why does my stack trace stop at the import when the error is inside a module?",
        intuition: "It shouldn't. The importer's frames are still on the frame stack while the module runs, so the trace includes both.",
        technical:
          "`execute` pushes the module's frames on top of the importer's, and the nested `run` shares `self.frames`, so `error` walks all of them. If a line looks wrong, check that `Import` saved `ip` in the importer's frame before running the module.",
      },
      {
        q: "How would I add try/catch to Wisp?",
        intuition: "Remember where the `try` started. When an error happens, throw away everything above that point and jump to the `catch` code.",
        technical:
          "Emit `PushHandler(catch_target)` and `PopHandler`. The VM keeps a list of handlers, each recording the frame depth, the stack height and the target. On an error it pops frames back to the handler's depth, closes upvalues, cuts the stack, pushes the error value and jumps. The JVM uses a per-method **exception table** of (start, end, handler, type) ranges, which costs nothing until something is thrown.",
      },
      {
        q: "How do I find out where my VM spends its time?",
        intuition: "Count. Keep a counter for each instruction type and print the totals at the end. It's crude but very revealing.",
        technical:
          "An array of counters indexed by opcode, increased in the loop behind a `--profile` flag, shows which instructions dominate. For profiling the Rust code itself, use `cargo flamegraph` or `perf`. The next lesson uses both kinds of numbers to decide what to speed up.",
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
      "HotSpot runs Java at native speed by watching the program and compiling the parts that run most to machine code. Before any of that, it's an interpreter like yours, and the same rules apply: measure, find the slow spot, make it cheaper, and measure again.",
      "This lesson adds the optimizations that matter most for a simple VM without making the code hard to read. Then it explains what a JIT adds on top, using HotSpot's tiers as the map.",
    ],
    sim: "jit",
    simTitle: "Interpreter → profile → compiled code",
    jvm: {
      title: "What HotSpot's tiers teach us",
      points: [
        "Code starts in the **interpreter**, which also counts method calls and loop repeats. Counters are cheap, and they tell the VM where the time is going.",
        "Methods that cross a threshold are compiled by **C1**, a fast compiler that also records which types and branches actually occur. Very busy code is compiled again by **C2**, using those records.",
        "C2's best tricks are **guesses**: if `x` has only ever been an `Integer` here, compile for that, and fall back to the interpreter (**deoptimize**) if the guess is ever wrong.",
        "A long-running loop can switch from interpreted to compiled code in the middle of the loop. That's **on-stack replacement**, triggered by the loop counter.",
      ],
    },
    concepts: [
      {
        heading: "Where an interpreter's time goes",
        body: [
          "Each instruction costs a trip around the loop (the `match` jump), checks on its inputs (are they numbers?), stack traffic (push and pop), and the actual work, which is often a single addition. The actual work is usually the smallest part. So optimizations either remove instructions entirely (folding, combined instructions) or make each remaining one cheaper (faster lookups, fewer checks).",
        ],
      },
      {
        heading: "What a JIT would add",
        body: [
          "A **baseline JIT** translates each function's bytecode into machine code, one instruction at a time. That removes the loop's overhead entirely, typically a 2–5× gain. In Rust the practical route is **Cranelift**, the code generator used by Wasmtime: you describe each instruction to it and it produces machine code.",
          "An **optimizing JIT** uses the counters and type records to specialize. If `a + b` has only ever seen numbers, it emits a plain float addition behind a quick type check, and falls back to the interpreter if the check fails. That's the C2 idea, and it's a project measured in months. The counters in this lesson are the first step either way.",
        ],
      },
    ],
    build: {
      intro: "Four improvements, easiest first. Re-run your `fib(25)` timing after each one.",
      milestone: "a measurably faster VM, and a `--trace-hot` flag that reports what a JIT would compile.",
      steps: [
        {
          section: "Part 1 · Measure properly",
          title: "Build for speed",
          body: "**What it's for:** making sure you measure the real thing. Debug builds of an interpreter are often 10–30× slower than release builds. Always benchmark with `cargo run --release`, and add these settings, which help a big `match` loop most.",
          code: {
            lang: "text",
            caption: "Cargo.toml",
            code: `[profile.release]
opt-level = 3
lto = "fat"        # optimize across files: lets push/pop be merged into the loop
codegen-units = 1  # compile as one unit: better optimization, slower build
panic = "abort"    # no unwinding machinery in the hot loop`,
          },
          explain: ["Run each benchmark a few times and take the best or middle result. The first run is often slower while the disk and CPU warm up."],
        },
        {
          section: "Part 2 · Do less work",
          title: "Constant folding",
          body: "**What it's for:** if both sides of an operator are plain numbers written in the source, the compiler can do the maths itself and emit one `Const` instead of three instructions. Add this check at the top of the `Binary` arm.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside expr's match (Expr::Binary)",
            code: `            Expr::Binary(a, op, b, line) => {
                // are both sides literal numbers? then compute the answer right now
                if let (Expr::Num(x), Expr::Num(y)) = (a.as_ref(), b.as_ref()) {
                    let folded = match op {
                        Tok::Plus => Some(x + y),
                        Tok::Minus => Some(x - y),
                        Tok::Star => Some(x * y),
                        Tok::Slash => Some(x / y),
                        _ => None, // comparisons could be folded too
                    };
                    if let Some(n) = folded {
                        let k = self.cur().chunk.add_const(Value::Num(n));
                        self.emit(Op::Const(k));
                        return Ok(());
                    }
                }
                // ...otherwise compile it as before
            }`,
          },
          explain: [
            "`a.as_ref()` looks inside the `Box` without taking ownership.",
            "`60 * 60 * 24` won't fully fold with this version, because the outer `*` sees a `Binary` node, not a number, on its left. To fold whole expressions, run a small pass that rewrites the tree from the bottom up before compiling.",
          ],
          jvm: "`javac` folds constant expressions too, including `static final` fields. `static final int DAY = 60 * 60 * 24` is stored as the single number 86400, and every use of `DAY` is replaced by it at compile time.",
        },
        {
          title: "Cheaper global lookups",
          body: "**What it's for:** every `GetGlobal` currently hashes a `String`, and `fib` looks itself up on every call. Since all strings are interned, use the name's `ObjRef` as the key instead. Hashing a single number is much cheaper than hashing text.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs and src/vm.rs (changes)",
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
            "This removes the separate `names` pool from lesson 03, which only existed because `Value` couldn't hold strings back then. Now there's one constant pool, like the JVM's.",
            "Going further: give each global a numbered slot the first time it's defined, and rewrite `GetGlobal(name)` into `GetGlobalSlot(i)` the first time it runs. That's called **quickening**, and it's the technique HotSpot uses when it rewrites `getfield` into a faster internal form.",
          ],
        },
        {
          section: "Part 3 · Find what's hot",
          title: "Hotness counters",
          body: "**What it's for:** counting how often each function is called, and reporting when one crosses a threshold. That's exactly the signal HotSpot uses to decide what to compile. A JIT can't work without it, and it's useful profiling on its own.",
          code: {
            lang: "rust",
            caption: "src/object.rs and src/vm.rs (changes)",
            code: `use std::cell::Cell;

pub struct Function {
    // ...name, arity, chunk, upvalues...
    pub calls: Cell<u32>, // how many times it has been called
}

// in Op::Call, in the closure branch:
let n = callee.calls.get() + 1;
callee.calls.set(n);
if n == 1_000 && self.trace_hot {
    eprintln!("[hot] {}() reached {n} calls: a JIT would compile it now", callee.name);
}`,
          },
          explain: [
            "`Cell` allows changing a value through a shared reference. Functions are shared through `Rc`, which normally only allows reading, but a `Cell<u32>` is a safe exception for simple numbers.",
            "Count loop repeats the same way in `Op::Loop`. A loop that runs millions of times inside a function called only once is hot too, and that's what on-stack replacement is for.",
          ],
          output: `[hot] fib() reached 1000 calls: a JIT would compile it now
75025`,
          jvm: "Run any Java program with `-XX:+PrintCompilation` to see the real thing: each line is a method crossing a threshold and being compiled by C1 or C2. By default, the first compilation tier kicks in after about 200 calls.",
        },
      ],
    },
    questions: [
      {
        q: "Should my VM represent values with NaN-boxing?",
        intuition: "NaN-boxing hides references and small values inside unused bit patterns of a floating-point number, so every value fits in 8 bytes instead of 16. It's a real speedup, but it needs `unsafe` code and careful bit work.",
        technical:
          "A 64-bit float has roughly 2^52 \"not a number\" bit patterns that real arithmetic never produces, enough to encode nil, booleans and 48-bit references. It halves the memory used by stacks and tables and makes copies cheaper. Do it once the VM is stable, behind `Value`'s methods, so the rest of the code doesn't change.",
      },
      {
        q: "Why is Java fast if it starts out interpreted?",
        intuition: "Because most programs spend almost all their time in a small part of their code. The JVM only has to compile that part, and the interpreter's slowness elsewhere barely matters.",
        technical:
          "The interpreter also acts as a profiler. By the time C2 compiles a method, it knows the actual types and which branches are taken, so it can inline calls and remove checks that an ahead-of-time compiler would have to keep. Guessing plus deoptimization is why JIT-compiled Java can beat statically compiled code on some workloads.",
      },
      {
        q: "What's the next optimization after this lesson?",
        intuition: "Look at your instruction counters. The most common pairs of instructions are candidates to merge into one.",
        technical:
          "\"Superinstructions\" such as `GetLocal + GetLocal + Add`, or a combined `LessThanJumpIfFalse`, cut the number of trips around the loop in hot code. After that, inline caches for `GetField` (once you have shapes) usually give the next big win. Beyond that, it's a baseline JIT.",
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
    summary: "Run many lightweight tasks on one thread: give each fiber its own stack and frames, switch with `yield`, and take turns round-robin. Java's virtual threads, in miniature.",
    tags: ["Fibers", "spawn · yield", "Scheduler", "Virtual threads"],
    intro: [
      "Java 21's **virtual threads** let a program have a million tasks in progress without a million operating-system threads. When a virtual thread has to wait, its stack is set aside, and its carrier thread runs something else until the virtual thread can continue.",
      "Your VM is already well set up for this. A running Wisp program's whole state is its value stack, its frames and its open upvalues. Give each task its own copy of those three, and switching tasks just means swapping which copy the VM is using. That's a **fiber**.",
    ],
    sim: "fibers",
    simTitle: "Fibers taking turns on one thread",
    jvm: {
      title: "What Loom teaches us",
      points: [
        "A virtual thread is a **continuation** (a paused stack) plus a scheduler. When it blocks, its frames are saved to the heap and its carrier thread runs something else.",
        "Virtual threads are cheap enough to create one per task, so you don't pool them. Most of an ordinary thread's cost is its operating-system stack and kernel scheduling.",
        "A virtual thread gets **pinned** to its carrier if it blocks while a native frame is on its stack, because native frames can't be moved to the heap. Until Java 24, `synchronized` blocks pinned too.",
        "The default scheduler is a work-stealing `ForkJoinPool`. Scheduling is a policy: the pause-and-resume mechanism doesn't care which task runs next.",
      ],
    },
    concepts: [
      {
        heading: "Taking turns politely",
        body: [
          "Wisp fibers only switch when the running fiber says `yield`. That's **cooperative** scheduling. It's simple and safe: a fiber can never be interrupted halfway through updating a table. The next lesson adds a way to interrupt a fiber that never yields.",
          "Because each fiber has its own `Vec`s, a switch is three swaps of `Vec` handles, with no copying. Loom has to copy stack frames because Java frames live on a real thread stack. Ours already live in `Vec`s on the heap.",
        ],
      },
    ],
    build: {
      intro: "A `Fiber` struct, a queue of fibers waiting their turn, two keywords and two instructions.",
      milestone: "`spawn f` starts a task, `yield` passes control to the next task, and the program ends when every fiber has finished.",
      steps: [
        {
          section: "Part 1 · Fiber state",
          title: "Fiber and switch_to()",
          body: "**What it's for:** a `Fiber` holds one paused task's state: its stack, frames and open upvalues. The *running* fiber's state stays in the VM's own fields, so the interpreter loop doesn't change at all. `switch_to` swaps a waiting fiber's state into the VM and hands back the state that was there.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `/// A paused task: everything needed to resume it later.
pub struct Fiber {
    stack: Vec<Value>,
    frames: Vec<CallFrame>,
    open_upvalues: Vec<ObjRef>,
}
// a new Vm field:  ready: VecDeque<Fiber>,  // fibers waiting for their turn
// collect() must also add every waiting fiber's values, frames and boxes to the roots.

impl Vm {
    fn switch_to(&mut self, next: Fiber) -> Fiber {
        Fiber {
            stack: std::mem::replace(&mut self.stack, next.stack),
            frames: std::mem::replace(&mut self.frames, next.frames),
            open_upvalues: std::mem::replace(&mut self.open_upvalues, next.open_upvalues),
        }
    }
}`,
          },
          explain: [
            "`mem::replace(&mut a, b)` puts `b` into `a` and returns what `a` held before. Only the `Vec` handles move (a pointer, a length and a capacity), never their contents, so a switch costs almost nothing however deep the fiber's stack is.",
            "A `VecDeque` is a queue: add at the back, take from the front. Fibers take turns in the order they joined.",
            "Waiting fibers still have live variables, so the collector must treat them as roots too.",
          ],
          jvm: "Loom's `Continuation.yield` does the equivalent of `switch_to`. Because Java frames live on the carrier thread's real stack, it has to copy them into a heap object, and copy them back when the thread resumes.",
        },
        {
          title: "yield_fiber() and hot_state()",
          body: "**What they're for:** `yield_fiber` lets the next fiber run. It saves where we were, swaps the next fiber in, and moves ours to the back of the queue. `hot_state` reads the four values `run` keeps in local variables from the new top frame, so the loop can continue in the new fiber.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `impl Vm {
    /// Returns false if nobody else is waiting (then we just keep running).
    fn yield_fiber(&mut self, ip: usize) -> bool {
        let Some(next) = self.ready.pop_front() else { return false };
        self.frames.last_mut().unwrap().ip = ip; // remember where this fiber stopped
        let parked = self.switch_to(next);
        self.ready.push_back(parked);            // our fiber waits at the back of the queue
        true
    }

    fn hot_state(&self) -> (ObjRef, Rc<Function>, usize, usize) {
        let f = self.frames.last().unwrap();
        (f.closure, f.func.clone(), f.ip, f.base)
    }
}`,
          },
        },
        {
          section: "Part 2 · spawn and yield",
          title: "The front end: two new statements",
          body: "**What it's for:** `spawn expr` starts a new fiber running a function that takes no arguments. `yield` gives the other fibers a turn. Each needs a keyword, a statement and one instruction.",
          code: {
            lang: "rust",
            caption: "lexer, parser, compiler and chunk (changes)",
            code: `// lexer: two keywords, Spawn and Yield ("spawn", "yield")

// parser, in statement():
Tok::Spawn => {
    self.advance();
    Ok(Stmt::Spawn(self.expr(0)?))
}
Tok::Yield => {
    self.advance();
    Ok(Stmt::Yield)
}

// compiler, in stmt():
Stmt::Spawn(e) => {
    self.expr(e)?;
    self.emit(Op::Spawn);
}
Stmt::Yield => {
    self.emit(Op::Yield);
}

// two new variants in Op:  Spawn, Yield`,
          },
        },
        {
          title: "Arm: Spawn",
          body: "**What it does:** pops the function to run, and builds a brand-new fiber for it: a stack holding just that function, and one frame set up exactly as a call would be. The new fiber joins the back of the queue and starts the next time someone yields.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Spawn => {
                    let Value::Obj(c) = self.pop() else {
                        return Err(self.error(ip, "spawn needs a function"));
                    };
                    let func = self.func_of(c);
                    self.ready.push_back(Fiber {
                        stack: vec![Value::Obj(c)], // slot 0: the function, like any callee
                        frames: vec![CallFrame { closure: c, func, ip: 0, base: 1 }],
                        open_upvalues: Vec::new(),
                    });
                }`,
          },
        },
        {
          title: "Arm: Yield, and what happens when a fiber finishes",
          body: "**What it does:** `Yield` switches to the next waiting fiber, if there is one, and reloads `run`'s locals from it. When a fiber's last frame returns, the next waiting fiber takes over. The program only ends when no fibers are left.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Yield => {
                    if stop_at > 0 {
                        // inside an import or a native's callback: Rust code is mid-way
                        // through on the stack, and it can't be parked in a Vec
                        return Err(self.error(ip, "can't yield here"));
                    }
                    if self.yield_fiber(ip) {
                        (closure, func, ip, base) = self.hot_state();
                    }
                }

                // in Op::Return, the stop_at check becomes:
                if self.frames.len() == stop_at {
                    if stop_at == 0 {
                        if let Some(next) = self.ready.pop_front() {
                            self.switch_to(next); // this fiber is done: drop it, run the next
                            (closure, func, ip, base) = self.hot_state();
                            continue;
                        }
                    }
                    return Ok(()); // nothing left to run
                }`,
          },
          explain: [
            "The main script is a fiber too. It just happens to be the one running at the start, and whichever fiber finishes last ends the program.",
            "Refusing to yield inside a nested `run` is the same limit Loom calls **pinning**: a Rust (or C) frame in the middle of the stack can't be set aside.",
            "Fibers can share tables and globals freely. Only one runs at a time, and switches only happen at `yield`, so no update is ever half-finished when another fiber looks.",
          ],
        },
        {
          section: "Part 3 · Try it",
          title: "Two workers taking turns",
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
          explain: ["The main script prints and yields, so `a` runs. `a` yields to `b`, and `b` yields back to the main script, which reaches its end and finishes. From then on `a` and `b` alternate until both loops are done."],
        },
      ],
    },
    questions: [
      {
        q: "Is this real parallelism?",
        intuition: "No. It's concurrency: many tasks making progress by taking turns on one thread. Parallelism means running at the same moment on several CPU cores.",
        technical:
          "One operating-system thread runs all the fibers, so heavy computation doesn't get faster. Fibers shine when tasks spend time waiting, such as on a network: a waiting fiber parks itself and others run. To use several cores, run one VM per thread and pass messages between them, which avoids sharing a heap.",
      },
      {
        q: "How would a fiber wait for a network request without blocking the others?",
        intuition: "Ask the operating system to tell you when the data is ready, park the fiber until then, and run the others meanwhile.",
        technical:
          "Add a native like `read(socket)` that starts a non-blocking read, registers the current fiber with an event loop (using `mio` or `epoll`), and parks it in a waiting set instead of the ready queue. When no fiber is ready, the scheduler waits on the event loop and moves fibers whose data arrived back into `ready`. That's how Loom makes blocking calls cheap in virtual threads.",
      },
      {
        q: "Why do Java's virtual threads need a work-stealing scheduler when one queue works here?",
        intuition: "Java runs virtual threads on several carrier threads at once. With many workers, one shared queue becomes a traffic jam.",
        technical:
          "A `ForkJoinPool` gives each carrier its own queue and lets idle carriers take work from busy ones, so they rarely fight over one lock. With one thread there's no fighting at all, so a `VecDeque` is the right choice. The scheduler is the replaceable part: the switching mechanism stays the same.",
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
      "A fiber that loops forever without `yield` freezes every other fiber. The VM needs a way to say \"stop at the next convenient moment\", but it can't interrupt Rust code halfway through an instruction.",
      "HotSpot has the same problem whenever it needs every thread to pause, for example for a GC. Its answer is the **safepoint**: running code regularly checks a flag at known places, and threads stop themselves when it's set. You'll build the same thing and use it to make fibers take turns automatically.",
    ],
    sim: "safepoints",
    simTitle: "Threads reaching a safepoint",
    jvm: {
      title: "What safepoints and the JMM teach us",
      points: [
        "Threads can only be stopped at **safepoints**: places where the VM knows exactly where every reference is. Checks sit at method returns and loop back-edges, so a running thread always reaches one soon.",
        "A thread running native code counts as already at a safepoint. It can't touch Java objects without coming back through the VM, so the GC can go ahead without waiting for it.",
        "Time-to-safepoint matters: one thread in a long loop without a check delays every other thread's pause. HotSpot removes checks from some short loops for speed, which occasionally causes exactly that delay.",
        "The **Java Memory Model** defines when one thread's writes become visible to another. `volatile`, `synchronized` and the atomic classes create the necessary *happens-before* links. Without them, there's no guarantee.",
      ],
    },
    concepts: [
      {
        heading: "Why check at back-edges and calls?",
        body: [
          "Any code that runs for a long time must either loop or call itself. So if every `Loop` instruction and every call checks the flag, no fiber can run for long without seeing it. The straight-line code between checks is at most one function long.",
          "In the interpreter, the start of an instruction is always a safe moment: every value is on the stack or in the heap, and none are held only in Rust variables. That's the same property the garbage collector relied on in lesson 09.",
        ],
      },
      {
        heading: "Wisp's memory model, in one sentence",
        body: [
          "\"Fibers on one VM never run at the same moment, so every write is visible to the next fiber that runs.\" That's the whole model, and it holds because Wisp doesn't share a heap between operating-system threads. If you ever do, you'll need the full treatment: atomics, locks and a precise definition of happens-before.",
        ],
      },
    ],
    build: {
      intro: "An atomic flag, a background thread that sets it, and a check at `Loop` that yields when it's set.",
      milestone: "two fibers that never call `yield` still take turns.",
      steps: [
        {
          section: "Part 1 · The flag",
          title: "A preemption flag and a ticker thread",
          body: "**What it's for:** the flag is shared between the VM's thread and a timer thread, so it has to be an **atomic**: a value that's safe to read and write from two threads at once. The timer sets it every few milliseconds. The VM notices, yields, and clears it.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

// a new Vm field:  preempt: Arc<AtomicBool>,

impl Vm {
    /// Start a background thread that asks the running fiber to yield every \`slice\`.
    pub fn start_preemption(&self, slice: Duration) {
        let flag = Arc::clone(&self.preempt); // a second handle on the same flag
        std::thread::spawn(move || loop {
            std::thread::sleep(slice);
            flag.store(true, Ordering::Relaxed); // "whoever is running: yield soon, please"
        });
    }
}`,
          },
          explain: [
            "`Arc` is like `Rc` but safe to share between threads. Both threads hold a handle to the same `AtomicBool`.",
            "The timer thread never touches the VM itself, only the flag. That's the key idea: the VM decides *where* to stop, and the other thread only *asks*.",
            "`Ordering::Relaxed` is enough because the flag carries no other data. We only need the VM to see the `true` eventually. If the flag also handed over data, you'd use `Release` when storing and `Acquire` when loading.",
          ],
          jvm: "HotSpot used to make all threads check one global memory page. Since JDK 10, **thread-local handshakes** let the VM stop threads one at a time, each checking its own flag, which is the same per-flag idea as ours.",
        },
        {
          section: "Part 2 · The check",
          title: "Check the flag at every loop repeat",
          body: "**What it does:** `Loop` is where every long-running loop passes through, so check the flag there. If it's set, clear it and yield, exactly as if the program had said `yield`. `swap` reads the old value and writes the new one in a single step, so the check and the reset can't get separated.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Loop(target) => {
                    ip = target as usize;
                    // SAFEPOINT CHECK: one cheap atomic read when nothing is pending
                    if stop_at == 0 && self.preempt.swap(false, Ordering::Relaxed) {
                        if self.yield_fiber(ip) {
                            (closure, func, ip, base) = self.hot_state();
                        }
                    }
                }
                // Op::Call gets the same check, for programs that recurse instead of loop`,
          },
          explain: [
            "`ip` is set to the loop target **before** yielding, so the fiber later resumes at the top of its loop, exactly as if `Loop` had run normally.",
            "`stop_at == 0` skips the check inside nested runs (imports, native callbacks), where a fiber can't be parked. It comes first on purpose: `&&` stops as soon as one side is false, so `swap` doesn't run, the flag stays set, and the fiber yields at the first check after it's back at the top level.",
            "When nothing is pending, the cost is one atomic read per loop repeat: a few CPU cycles, invisible in benchmarks. HotSpot's compiled code pays the same price for its checks.",
          ],
        },
        {
          section: "Part 3 · Try it",
          title: "Two busy loops that never yield",
          body: "Neither worker yields, but with preemption on they still take turns. Call `vm.start_preemption(Duration::from_millis(10))` in `main` before running the script.",
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
            "Without preemption, \"slow\" would run to the end before \"also slow\" even started. With it, both loops advance in 10 ms turns. Add a `print` inside the loops every 500,000 repeats to watch them alternate.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why can't the VM just stop a fiber anywhere, like an operating system can stop a thread?",
        intuition: "An operating system saves every CPU register, so it can resume a thread from any point. Our VM keeps some values in Rust variables during an instruction, and switching then would lose them.",
        technical:
          "Halfway through an instruction, a value may exist only in a Rust local, invisible to both the GC and the fiber switch. Between instructions, everything is on the VM stack, which is what makes that moment \"safe\". The JVM has the same constraint for compiled code: only at safepoints do its stack maps describe every live reference.",
      },
      {
        q: "What's a \"time-to-safepoint\" problem?",
        intuition: "One thread that takes a long time to reach its next check keeps everyone else waiting, even if the pause itself is tiny.",
        technical:
          "HotSpot leaves checks out of some loops with `int` counters for speed, so a single long loop can delay a GC pause by seconds. \"Loop strip mining\" (JDK 10+) splits such loops into chunks with a check between them. In Wisp every `Loop` checks, so it can't happen, apart from long-running natives.",
      },
      {
        q: "If I wanted real multi-threaded Wisp, where would I start?",
        intuition: "The safest route is one VM per thread with no shared heap, sending messages between them. Sharing one heap between threads is what makes the JVM so complicated.",
        technical:
          "Isolates (as in JavaScript workers and Dart) need only a thread-safe channel and a way to copy values between heaps. A shared heap needs locks or lock-free tables, a GC that stops all threads at safepoints, and a memory model that says when writes become visible.",
      },
    ],
    references: [
      { title: "JEP 312: Thread-Local Handshakes", by: "OpenJDK", url: "https://openjdk.org/jeps/312", kind: "spec", note: "How HotSpot stops individual threads at safepoints." },
      { title: "JSR-133 (Java Memory Model) FAQ", by: "Jeremy Manson, Brian Goetz", url: "https://www.cs.umd.edu/~pugh/java/memoryModel/jsr-133-faq.html", kind: "article", note: "A readable introduction to happens-before." },
    ],
  },
];
