import type { Lesson } from "./types";

export const runtimeLessons: Lesson[] = [
  {
    slug: "module-loading",
    title: "Module Loading & Linking",
    level: "Intermediate",
    accent: "violet",
    icon: "Package",
    summary: "Load, verify, link and initialize code lazily and exactly once. Class loading, rebuilt for modules.",
    tags: ["Load → Link → Init", "Lazy Resolution", "Module Cache", "Cycles"],
    intro: [
      "The JVM doesn't load your whole program at startup. It loads a class the first time it's needed, verifies the bytes, links its symbolic references, and runs its static initializer exactly once. That lazy, staged process is why a large Java app can start without touching thousands of unused classes.",
      "Wisp has modules instead of classes, but the stages carry over directly. An `import` finds source or cached bytecode, compiles or verifies it, resolves names, and runs the module body once, even if a hundred files import it.",
    ],
    sim: "modules",
    simTitle: "Watch an import go through each loading phase",
    jvm: {
      title: "What class loading teaches us",
      points: [
        "There are three phases. Loading finds the bytes. Linking verifies, prepares (allocates statics) and resolves (turns symbolic references into direct ones). Initialization runs `<clinit>`.",
        "Resolution is lazy. A reference to `Foo.bar` stays symbolic until the first time that instruction runs.",
        "Parent delegation means a loader asks its parent first. Core classes like `java.lang.String` therefore always come from the bootstrap loader and can't be spoofed.",
        "A class's identity is its name plus its loader. The same bytes loaded twice by different loaders give two distinct classes.",
      ],
    },
    concepts: [
      {
        heading: "Symbolic references and quickening",
        body: [
          "The constant pool holds names, not addresses. The first time a `GET_GLOBAL \"print\"` runs, the VM looks up the name, caches the resolved slot, and can rewrite the instruction in place to a faster `GET_GLOBAL_SLOT 7`. HotSpot does the same with its \"fast\" bytecodes. You pay for resolution once and get direct access after that.",
        ],
      },
      {
        heading: "A module cache with states",
        body: [
          "Track each module as `Loading`, `Loaded(exports)` or `Failed`. Registering the module as `Loading` before its body runs is what makes circular imports terminate: the second import sees the partial module instead of recursing forever. This matches how the JVM handles a class whose initialization is already in progress on the same thread.",
        ],
        code: {
          lang: "rust",
          code: `enum ModuleState { Loading(Gc<Module>), Loaded(Gc<Module>), Failed(WispError) }

fn import(&mut self, path: &Path) -> Result<Gc<Module>> {
    match self.modules.get(path) {
        Some(ModuleState::Loaded(m) | ModuleState::Loading(m)) => return Ok(*m),
        Some(ModuleState::Failed(e)) => return Err(e.clone()),
        None => {}
    }
    let module = self.alloc_module(path);
    self.modules.insert(path.into(), ModuleState::Loading(module));
    let func = self.load_and_verify(path)?;   // load + link
    self.run_module_body(module, func)?;       // initialize, once
    self.modules.insert(path.into(), ModuleState::Loaded(module));
    Ok(module)
}`,
        },
      },
    ],
    build: {
      intro: "Add modules on top of the compiler you already have. Each module is a top-level function plus an exports object.",
      steps: [
        {
          title: "Search paths, standard library first",
          body: "Resolve `import \"std/io\"` against built-in modules before user paths. This is your version of parent delegation, and it stops a local `io.wisp` from replacing the real one.",
        },
        {
          title: "Load source or cached bytecode",
          body: "If `foo.wispc` is newer than `foo.wisp`, verify its header and constants and load it. Otherwise compile the source and write the cache.",
        },
        {
          title: "Initialize exactly once",
          body: "Run the module's top-level function with a fresh module object as its global scope. Whatever it assigns to `export` becomes the import result.",
        },
      ],
    },
    questions: [
      {
        q: "Why load lazily instead of everything at startup?",
        intuition: "A library doesn't move every book onto your desk when you walk in. It fetches the one you ask for.",
        technical:
          "Most code paths never run in a given execution. Lazy loading keeps startup time and memory proportional to the code that actually runs. The cost is that a missing dependency fails late, at first use, which is why the JVM reports `NoClassDefFoundError` at runtime.",
      },
      {
        q: "What problem does parent delegation really solve?",
        intuition: "If anyone could hand the VM their own `String`, nothing could trust what a string is.",
        technical:
          "Delegating to the parent first guarantees that core types resolve to one trusted definition. Without it, a classpath entry could shadow `java.lang.Object` and break every security invariant. In your VM, resolve `std/*` from an embedded, immutable source.",
      },
      {
        q: "How do circular imports not loop forever?",
        intuition: "The second time you're asked for a module that's still being built, you hand over the half-built one instead of starting again.",
        technical:
          "Insert a `Loading` entry before running the body. A re-entrant import returns that partially initialized module, so top-level code in a cycle can see missing exports. That's why most languages warn about doing work at import time.",
      },
    ],
  },
  {
    slug: "execution-engine",
    title: "The Dispatch Loop",
    level: "Intermediate",
    accent: "amber",
    icon: "Zap",
    summary: "The heart of the VM: fetch, decode, execute, repeat. Make it fast with good dispatch, cached state and quickening.",
    tags: ["Fetch-Decode-Execute", "Switch vs Threaded", "Quickening", "Superinstructions"],
    intro: [
      "Every bytecode VM has a loop at its core. It reads the opcode at `ip`, jumps to that opcode's handler, does the work, and goes back for the next one. Every Wisp program you ever run passes through this loop billions of times, so small costs here add up.",
      "HotSpot's interpreter is a template interpreter: at startup it generates machine code for each bytecode handler. You won't need to go that far, but its lessons apply. Keep hot state in registers, make dispatch predictable, and specialize instructions while the program runs.",
    ],
    sim: "dispatch",
    simTitle: "Fetch → decode → execute, live",
    jvm: {
      title: "What HotSpot's interpreter teaches us",
      points: [
        "The template interpreter generates assembly per opcode at VM startup, so dispatch is an indirect jump through a table.",
        "The top of the operand stack is cached in a CPU register (TOS caching), which saves memory traffic on every instruction.",
        "The interpreter collects profiles (invocation counts, branch counts, receiver types) that the JIT later relies on.",
        "Bytecode rewriting (\"fast\" bytecodes) replaces a resolved `getfield` with a `fast_agetfield` that skips resolution.",
      ],
    },
    concepts: [
      {
        heading: "Switch dispatch vs threaded code",
        body: [
          "A `match` inside a `loop` compiles to one shared indirect jump. The CPU's branch predictor sees a single jump site with dozens of targets and guesses badly. Threaded code, using computed goto in C, puts a separate jump at the end of every handler. Each site then learns its own pattern: after a `CONST`, an `ADD` is likely.",
          "In Rust there's no computed goto. Good options are a well-shaped `match` (LLVM sometimes duplicates the dispatch for you), tail-call dispatch through function pointers, or simply fewer instructions thanks to superinstructions.",
        ],
      },
      {
        heading: "Keep ip and sp local",
        body: [
          "Load `ip`, the code pointer and the stack pointer into local variables at the start of `run()`, and write them back only when calling or throwing. A version that reads `self.frames.last().ip` every instruction can be twice as slow.",
        ],
        code: {
          lang: "rust",
          code: `loop {
    let op = unsafe { *code.get_unchecked(ip) };
    ip += 1;
    match Op::from(op) {
        Op::Const => { let i = read_u16(code, &mut ip); push!(consts[i]) }
        Op::Add => {
            let (b, a) = (pop!(), pop!());
            match (a, b) {
                (Value::Num(x), Value::Num(y)) => push!(Value::Num(x + y)),
                _ => push!(self.add_slow(a, b)?),   // strings, errors
            }
        }
        Op::Return => { /* pop frame, reload ip/code/base */ }
        // …
    }
}`,
        },
      },
    ],
    build: {
      intro: "Get it correct first, then fast. Measure every change with a benchmark suite: fib, loops, string building, property access.",
      steps: [
        {
          title: "A straightforward match loop",
          body: "Use safe indexing at first. Add `get_unchecked` only after a verifier or debug assertions confirm that jump targets and stack depth are valid.",
        },
        {
          title: "Quicken after first execution",
          body: "When `ADD` sees two numbers, overwrite its opcode byte with `ADD_NUM`. If `ADD_NUM` later sees a string, rewrite it back. This is cheap specialization without a JIT.",
        },
        {
          title: "Add superinstructions from profiles",
          body: "Count opcode pairs at runtime. If `GET_LOCAL; CONST; ADD` dominates, fuse it into one instruction. Fewer dispatches mean fewer mispredicted branches.",
        },
      ],
    },
    questions: [
      {
        q: "Why is the dispatch loop such a big deal for performance?",
        intuition: "If every step of a recipe starts with walking across the kitchen to read the book, the walking costs more than the cooking.",
        technical:
          "Simple handlers like `ADD` do 2–5 machine instructions of real work, but dispatch costs a load, a bounds check and an indirect branch. A mispredicted branch costs around 15–20 cycles. Dispatch overhead often outweighs the work itself.",
      },
      {
        q: "Why does threaded dispatch help the branch predictor?",
        intuition: "One receptionist directing every visitor guesses poorly. A receptionist on every floor learns where that floor's visitors usually go next.",
        technical:
          "Predictors key on the branch's address. With one shared dispatch branch, the history mixes every opcode transition. Per-handler dispatch branches give each opcode its own history, which matches real bytecode patterns much more closely.",
      },
      {
        q: "Is a register VM always faster than a stack VM?",
        intuition: "Fewer, bigger steps compared with more, smaller steps. Which wins depends on how expensive each step is to start.",
        technical:
          "The Lua 5.0 paper reports about 47% fewer instructions with registers, but each one is wider and decodes more operands. With cheap dispatch the gap narrows. The bigger wins usually come from value representation and inline caches, not from the stack-versus-register choice.",
      },
    ],
  },
  {
    slug: "closures",
    title: "Functions, Closures & Upvalues",
    level: "Intermediate",
    accent: "pink",
    icon: "FunctionSquare",
    summary: "Java copies captured variables. Your language shares them. Learn upvalues, the trick that keeps closures fast.",
    tags: ["First-Class Functions", "Upvalues", "Open vs Closed", "invokedynamic"],
    intro: [
      "Wisp has no classes. Functions are the main unit of abstraction, and closures are how state gets bundled with behavior. A closure has to keep its captured variables alive after the enclosing function returns, even though those variables were living on the stack.",
      "Java avoids the problem: lambdas can only capture effectively final variables, and the values are copied in. Lua solves it properly with upvalues, which point at a stack slot while it's live and move to the heap at the moment the slot dies.",
    ],
    sim: "upvalues",
    simTitle: "Open and closed upvalues, step by step",
    jvm: {
      title: "What Java lambdas teach us",
      points: [
        "A lambda compiles to an `invokedynamic` call site, which `LambdaMetafactory` links on first call. That's lazy linking for functions.",
        "Captured locals must be effectively final, because Java copies their values into the lambda object.",
        "That restriction exists because Java frames die on return and the JVM won't move stack slots to the heap.",
        "Stateless lambdas are allocated once and reused, so capturing nothing costs nothing.",
      ],
    },
    concepts: [
      {
        heading: "Why not heap-allocate every local?",
        body: [
          "If every local lived on the heap, closures would be trivial and everything else would be slow. Most locals are never captured. Upvalues let the common case stay on the fast stack and pay heap cost only for variables that are actually captured.",
        ],
      },
      {
        heading: "Open and closed",
        body: [
          "While the defining function is running, an upvalue is open and points at the variable's stack slot. Reads and writes through the closure see the live variable. When the slot is about to be popped (the block ends or the function returns), the VM closes the upvalue: it copies the value into the upvalue object and repoints it there. Every closure sharing that upvalue keeps sharing the same box.",
        ],
        code: {
          lang: "wisp",
          code: `let counter = fn() {
  let n = 0               // captured → becomes an upvalue
  return fn() { n = n + 1; return n }
}
let next = counter()      // counter's frame is gone…
next()  // 1              // …but n lives on in a closed upvalue
next()  // 2`,
        },
      },
    ],
    build: {
      intro: "The compiler decides which variables get captured. The VM opens and closes upvalues.",
      steps: [
        {
          title: "Resolve upvalues recursively",
          body: "When a name isn't local, look in the enclosing function. If it's local there, mark it `captured` and record `(is_local: true, index)`. If it's an upvalue there, record `(is_local: false, index)`. The chain can be any depth.",
        },
        {
          title: "Represent upvalues",
          body: "Keep a sorted list of open upvalues by stack slot, so two closures capturing the same variable share one upvalue.",
          code: {
            lang: "rust",
            code: `pub enum UpvalueState { Open(usize /* stack slot */), Closed(Value) }
pub struct Upvalue { state: RefCell<UpvalueState> }
pub struct Closure { proto: Gc<FunctionProto>, upvalues: Box<[Gc<Upvalue>]> }`,
          },
        },
        {
          title: "Close on scope exit and return",
          body: "Emit `CLOSE_UPVALUE` instead of `POP` for captured locals. On `RETURN`, close every open upvalue at or above the frame's base.",
        },
      ],
    },
    questions: [
      {
        q: "Why does Java force captured variables to be effectively final?",
        intuition: "Java hands the lambda a photocopy. If you could keep editing the original, the copy would quietly go stale, so Java forbids the edit.",
        technical:
          "Captured values are copied into synthetic fields of the lambda object. Allowing mutation would need shared heap cells (upvalues), and Java chose simplicity and thread-safety over that. Kotlin works around it by boxing captured `var`s in a `Ref` object, which is a manual upvalue.",
      },
      {
        q: "Can closures replace classes in my language?",
        intuition: "Yes. A closure is a function that carries a backpack of variables. An object is a backpack carrying functions.",
        technical:
          "\"Closures are a poor man's objects, and objects are a poor man's closures.\" Wisp combines both: objects are property bags with shapes, methods are closures stored in properties, and prototypes share behavior. You get encapsulation without a class system.",
      },
      {
        q: "What happens if two closures capture the same variable?",
        intuition: "They share one box. If one changes it, the other sees the change.",
        technical:
          "Before creating an upvalue for slot N, search the open-upvalue list. If one already exists, reuse it. That single `Gc<Upvalue>` is then referenced from both closures, and closing it moves one value that both continue to share.",
      },
    ],
  },
  {
    slug: "objects",
    title: "Objects Without Classes",
    level: "Intermediate",
    accent: "emerald",
    icon: "Shapes",
    summary: "Get JVM-like field-offset speed for dynamic objects using hidden classes (shapes) and inline caches.",
    tags: ["Shapes", "Inline Caches", "Prototypes", "Megamorphism"],
    intro: [
      "A JVM class fixes an object's layout at compile time: field `age` is always at offset 16. A field read is a single memory load. Virtual calls go through a vtable, and hot call sites get inline caches that remember the receiver type they saw.",
      "Wisp objects are dynamic. Properties come and go at runtime, and there are no classes. The naive design, a hash map per object, is flexible but slow. Hidden classes (shapes) bring back most of the JVM's speed by noticing that objects built the same way have the same layout.",
    ],
    sim: "shapes",
    simTitle: "Add properties and watch shapes form and get shared",
    jvm: {
      title: "What JVM object layout teaches us",
      points: [
        "A class means a fixed layout, so a field access is `load [obj + offset]` with no lookup.",
        "Each call site's inline cache records the receiver class it saw. Monomorphic sites, with one class, become direct calls.",
        "Sites with 2 classes are bimorphic. Sites with many are megamorphic and fall back to a vtable or itable lookup.",
        "Deoptimization lets the JIT bet on one class and back out safely when a new class shows up.",
      ],
    },
    concepts: [
      {
        heading: "Shapes: classes the user never wrote",
        body: [
          "A shape maps property names to slot indices and has transitions to child shapes. Every `{}` starts with the empty shape. Adding `x` moves it to shape `{x:0}`, then adding `y` moves it to `{x:0, y:1}`. A second object built in the same order follows the same transitions and lands on the same shape. Objects store only `shape` and a `Vec<Value>` of slots.",
        ],
      },
      {
        heading: "Inline caches in bytecode",
        body: [
          "Give each `GET_PROP` instruction a small cache entry: `(shape_id, slot)`. On execution, if the object's shape matches, read `slots[slot]` directly. On a miss, do the slow lookup and update the cache. Most property-access sites only ever see one shape, so nearly every access becomes one compare and one load.",
        ],
        code: {
          lang: "rust",
          code: `Op::GetProp => {
    let (name, cache_ix) = (read_u16(), read_u16());
    let obj = peek(0).as_object()?;
    let ic = &mut proto.ic[cache_ix];
    let v = if ic.shape == obj.shape.id {        // fast path: hit
        obj.slots[ic.slot as usize]
    } else {                                      // miss: look up + update
        let (slot, v) = obj.lookup_with_proto(name)?;
        *ic = InlineCache { shape: obj.shape.id, slot };
        v
    };
    replace_top(v);
}`,
        },
      },
    ],
    build: {
      intro: "Objects, shapes, prototype delegation, then caches.",
      steps: [
        {
          title: "Shape tree with transitions",
          body: "Store `HashMap<Sym, Gc<Shape>>` transitions on each shape. Shapes are shared and immutable, so building identical objects never creates new shapes after the first one.",
        },
        {
          title: "Prototype delegation",
          body: "Each object has an optional `proto`. A lookup that misses walks the chain, which is how methods are shared without classes. `let dog = { proto: animal, name: \"rex\" }`.",
        },
        {
          title: "Detect megamorphic sites",
          body: "If a cache misses too often, stop updating it and switch that site to a hash lookup. Thrashing a cache costs more than not having one.",
        },
      ],
    },
    questions: [
      {
        q: "Why not just use a HashMap for every object?",
        intuition: "Looking up a word in a dictionary is fine, but not when you do it a billion times for the same word on the same page.",
        technical:
          "A hash lookup means hashing (or comparing interned symbols), a probe and a key compare: tens of instructions plus cache misses. A shape-checked slot read is one compare and one indexed load. Per-object hash maps also use far more memory than a shared shape plus a packed slot vector.",
      },
      {
        q: "Prototypes versus classes: what's the real difference?",
        intuition: "Classes are blueprints you build from. Prototypes are an example object you copy from and point back at.",
        technical:
          "Class-based dispatch resolves through a static hierarchy. Prototype dispatch walks a runtime chain of objects, and that chain can change. Shapes plus inline caches make both equally fast in the common case: V8 runs JavaScript prototypes at speeds close to JVM virtual calls.",
      },
      {
        q: "When does a call site go megamorphic, and why is that bad?",
        intuition: "A greeter who always meets the same person gets fast. A greeter facing a crowd of strangers is back to asking everyone's name.",
        technical:
          "Once a site sees more distinct shapes than its cache holds (often 4), every access takes the slow path. Code that builds objects with properties in varying orders creates many shapes. Encourage consistent construction, for example with factory functions.",
      },
    ],
  },
  {
    slug: "gc",
    title: "Garbage Collection",
    level: "Intermediate",
    accent: "amber",
    icon: "Recycle",
    summary: "Find every live object from the roots, free the rest, and learn why the JVM bets that most objects die young.",
    tags: ["Roots", "Tri-color Marking", "Generations", "Write Barriers"],
    intro: [
      "An object is garbage when no chain of references leads to it from a root: a stack slot, a global or a static. The JVM's collectors (Serial, Parallel, G1, ZGC) all find live objects by tracing from the roots. They differ in when they do it, how much they do while your code runs, and how they lay out the heap.",
      "Your first collector will be a mark-sweep tracer: mark everything reachable, then sweep away everything unmarked. The hardest part is making sure you've found every root, including ones you'd never expect.",
    ],
    sim: "gc",
    simTitle: "Tri-color mark & sweep: step it yourself",
    jvm: {
      title: "What the JVM collectors teach us",
      points: [
        "Reachability, not reference counting, decides what's live, so cycles are collected naturally.",
        "The generational hypothesis says most objects die young. Eden is collected often and cheaply, and survivors are promoted to the old generation.",
        "Write barriers plus card tables track old-to-young pointers, so a young collection doesn't have to scan the whole old generation.",
        "Concurrent collectors (G1, ZGC) mark while the program runs, and need barriers to stay correct.",
      ],
    },
    concepts: [
      {
        heading: "Tri-color marking",
        body: [
          "White objects haven't been seen yet. Gray objects have been found but their children haven't been scanned. Black objects are fully scanned. Start with the roots gray, then repeatedly take a gray object, gray its white children and blacken it. When no gray objects remain, every white object is garbage. This model is also how concurrent collectors reason about safety: a black object must never point to a white one unless a barrier catches it.",
        ],
      },
      {
        heading: "Roots you'll forget",
        body: [
          "Your roots include the value stack, globals, open upvalues, the call frames' closures, and the module cache. One more catches almost everyone: objects the compiler or a native function has allocated but not yet stored anywhere. Collect at the wrong moment and they disappear. A `--gc-stress` mode that collects on every allocation finds these bugs quickly.",
        ],
        code: {
          lang: "rust",
          code: `fn collect(&mut self) {
    self.mark_roots();          // stack, frames, globals, upvalues, modules, temp roots
    while let Some(obj) = self.gray.pop() {
        self.blacken(obj);      // mark children gray
    }
    self.sweep();               // free unmarked, clear marks
    self.next_gc = self.bytes_allocated * GC_GROWTH; // e.g. 2×
}`,
        },
      },
    ],
    build: {
      intro: "Start with stop-the-world mark-sweep. Add generations later, once you can measure how long collections take.",
      steps: [
        {
          title: "Track allocations",
          body: "Link every object into an intrusive list (or an arena of handles) and count `bytes_allocated`. Trigger collection when it passes `next_gc`.",
        },
        {
          title: "Mark with an explicit gray stack",
          body: "Don't recurse. Deep object graphs would overflow the native stack. Push onto a `Vec` of gray objects and loop.",
        },
        {
          title: "Grow the threshold",
          body: "After each collection, set the next threshold relative to the live heap. This adapts automatically to small scripts and large programs, a simple version of the JVM's heap sizing heuristics.",
        },
        {
          title: "Later: a nursery",
          body: "Bump-allocate new objects in a small nursery and copy survivors out. Record old-to-young pointers with a write barrier in `SET_PROP` and `SET_UPVALUE`.",
        },
      ],
    },
    questions: [
      {
        q: "Why not reference counting? It frees memory immediately.",
        intuition: "Counting who holds each object sounds tidy, until two objects hold each other and nobody else holds either. Their counts never reach zero.",
        technical:
          "RC can't collect cycles without a backup tracer (CPython has one), and it adds increment and decrement traffic to every pointer copy, which is expensive with threads (atomics). Tracing costs nothing per pointer write, at the price of pauses.",
      },
      {
        q: "Why do most objects die young, and why does it matter?",
        intuition: "Most of the paper on a desk is scratch notes thrown away within minutes. Clean the desk often and the filing cabinet rarely.",
        technical:
          "Temporaries such as strings, iterators and boxed results are short-lived. A copying nursery collection only touches live objects, so its cost is proportional to the survivors, which are few. That's why JVM minor GCs take milliseconds.",
      },
      {
        q: "What does a write barrier actually do?",
        intuition: "It's a small note you leave whenever an old box starts pointing at a new box, so the young-object cleanup knows to check that old box.",
        technical:
          "On a pointer store, the barrier dirties a card for the region containing the old object. A minor GC scans only dirty cards as extra roots. Concurrent collectors use barriers differently, on loads in ZGC or as SATB pre-write barriers in G1, to keep the tri-color invariant while the program mutates the heap.",
      },
    ],
  },
  {
    slug: "jit",
    title: "Tiered Execution & JIT",
    level: "Advanced",
    accent: "rose",
    icon: "Rocket",
    summary: "Interpret first, profile, then compile what's hot, and know how to back out when a guess turns out wrong.",
    tags: ["Tiered Compilation", "Profiling", "Speculation", "Deoptimization"],
    intro: [
      "HotSpot doesn't compile everything. It interprets, counts, and only compiles methods that prove themselves hot, first quickly with C1, then aggressively with C2 using the profile collected along the way. The optimized code bets on things like \"this call always sees an ArrayList\". When a bet fails, it deoptimizes back to the interpreter.",
      "A JIT is the most complex part of any VM, and you may never need one. Even so, the tiered idea of profiling first and specializing what's hot already applies to your interpreter through quickening and inline caches.",
    ],
    sim: "jit",
    simTitle: "Call functions and watch them climb the tiers",
    jvm: {
      title: "What HotSpot's tiers teach us",
      points: [
        "Tier 0 is the interpreter, tiers 1–3 are C1 (fast compile, some with profiling), and tier 4 is C2 (slow compile, fast code).",
        "Hotness counts both invocations and loop back-edges. A long-running loop can be compiled while it's running (OSR).",
        "Speculative optimizations are protected by guards. A failed guard triggers an uncommon trap and deoptimization.",
        "Deoptimization rebuilds interpreter frames from compiled state, so correctness never depends on a bet being right.",
      ],
    },
    concepts: [
      {
        heading: "Profile before you optimize",
        body: [
          "Add a counter to each function and each loop back-edge. When a counter crosses a threshold, the code is hot. Most code never gets there, and compiling it would waste startup time. Hot code is also where the interpreter has gathered type information that makes good compilation possible.",
        ],
      },
      {
        heading: "Speculation and deopt",
        body: [
          "A dynamic `a + b` could mean anything. If the profile says it has always been two numbers, compiled code can emit a type guard followed by a raw `fadd`. If the guard fails, the compiled code jumps to a deopt stub that rebuilds the interpreter frame and continues there. Deopt support is what lets a JIT be aggressive and still correct.",
        ],
        code: {
          lang: "text",
          code: `; speculated a + b, both numbers
  cmp   tag(a), NUM
  jne   deopt_17          ; guard failed → back to interpreter
  cmp   tag(b), NUM
  jne   deopt_17
  addsd xmm0, xmm1        ; the actual work`,
        },
      },
    ],
    build: {
      intro: "A realistic path, from no machine code to real machine code.",
      steps: [
        {
          title: "Tier 0.5: quickening and inline caches",
          body: "Specialize bytecode in place. This gets you much of the benefit with no machine code. Do this first.",
        },
        {
          title: "Count and pick candidates",
          body: "Add a `hotness: u32` field to each `FunctionProto`, incremented on call and on `LOOP`. Log functions that cross 1,000. That shows you whether a JIT would even help your workloads.",
        },
        {
          title: "Baseline JIT with Cranelift",
          body: "Translate each bytecode into Cranelift IR that calls the same runtime helpers your interpreter uses. Most of the gain comes from removing dispatch overhead, not from clever optimization.",
          code: {
            lang: "rust",
            code: `enum Tier { Interpreted, Baseline(JitCode), Optimized(JitCode) }
if proto.hotness > BASELINE_THRESHOLD && matches!(proto.tier, Tier::Interpreted) {
    proto.tier = Tier::Baseline(jit::compile_baseline(&proto)?);
}`,
          },
        },
      ],
    },
    questions: [
      {
        q: "Why not compile everything to machine code at startup?",
        intuition: "You wouldn't translate a whole library to read one chapter. Translate the chapters people actually read.",
        technical:
          "Compile time is runtime for a JIT. Most code runs a handful of times, and compiling it costs more than interpreting it. Without profiles, the compiler also has no type information for a dynamic language, so the code it produced would be generic and only slightly faster.",
      },
      {
        q: "What is deoptimization, intuitively?",
        intuition: "You take a shortcut that assumes the bridge is open. If you find it closed, you don't crash. You walk back to the main road and continue from the same spot.",
        technical:
          "At each guard, the JIT records how to reconstruct interpreter state: which register holds which local, and the bytecode ip. On guard failure, a stub materializes a frame from that metadata and resumes in the interpreter. The compiled code may then be thrown away and recompiled with the updated profile.",
      },
      {
        q: "Is a JIT always faster?",
        intuition: "For a long race, yes. For a sprint, the warm-up costs more than it saves.",
        technical:
          "Short-lived scripts finish before tier-up happens, and the JIT costs memory and compile threads. The JVM added features like AppCDS and Leyden-style AOT caches specifically to fight warm-up. For an embedded scripting language, a fast interpreter is often the right final design.",
      },
    ],
  },
];
