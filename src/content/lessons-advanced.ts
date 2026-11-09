import type { Lesson } from "./types";

export const advancedLessons: Lesson[] = [
  {
    slug: "concurrency",
    title: "Fibers & Concurrency",
    level: "Advanced",
    accent: "violet",
    icon: "GitBranch",
    summary: "From platform threads to virtual threads: build cheap fibers that park on I/O instead of blocking an OS thread.",
    tags: ["Fibers", "M:N Scheduling", "Carrier Threads", "Pinning"],
    intro: [
      "For decades, a Java thread meant an OS thread: about 1 MB of stack and a kernel context switch. Project Loom added virtual threads. These are lightweight continuations that mount on a small pool of carrier threads and unmount when they block, so a million concurrent tasks becomes a reasonable thing to do.",
      "Your VM is in a better position here than the JVM was. A Wisp fiber is just a value stack plus a list of frames, both of which you already have. Switching fibers means switching which stack the dispatch loop reads from.",
    ],
    sim: "fibers",
    simTitle: "Fibers mounting and unmounting on carrier threads",
    jvm: {
      title: "What Loom teaches us",
      points: [
        "Virtual threads map M:N onto carrier threads, a small ForkJoinPool usually sized to the CPU cores.",
        "When a virtual thread blocks on I/O, its stack is copied to the heap as a continuation and the carrier is freed.",
        "Pinning happens when a virtual thread can't unmount (inside `synchronized` before JDK 24, or during native calls), which blocks the carrier.",
        "Structured concurrency keeps tasks scoped, so child fibers can't outlive their parent scope silently.",
      ],
    },
    concepts: [
      {
        heading: "A fiber is a stack you can swap",
        body: [
          "Because your interpreter keeps all Wisp state in its own value stack and frame list, not on the Rust stack, suspending a fiber is just saving a pointer. This is the main reason to keep the VM non-recursive: a Wisp call should never become a Rust call. If it does, Rust frames get trapped under Wisp frames and you hit Loom's pinning problem yourself.",
        ],
        code: {
          lang: "rust",
          code: `pub struct Fiber {
    stack: Vec<Value>,
    frames: Vec<CallFrame>,
    state: FiberState,          // Ready | Running | Parked(IoToken) | Done(Value)
}
// YIELD / await: save ip into the current frame, mark Parked, return to the scheduler.`,
        },
      },
      {
        heading: "One heap, many threads?",
        body: [
          "Running fibers on several OS threads at once means shared-heap concurrency: a memory model, atomic reference updates and a GC that can stop every thread. Options in order of difficulty: run all fibers on one thread with an event loop (Node, early Lua), use a global lock (CPython's GIL), use isolated heaps that pass messages (Erlang, JS workers), or go fully shared (the JVM).",
        ],
      },
    ],
    build: {
      intro: "Start with cooperative fibers on one thread, with an I/O event loop.",
      steps: [
        {
          title: "Make the interpreter re-entrant per fiber",
          body: "`run(&mut self, fiber: &mut Fiber, budget: u32)` executes until the fiber yields, parks, finishes, or uses up its instruction budget, which gives you preemption.",
        },
        {
          title: "A scheduler loop",
          body: "Keep a ready queue of fibers. When it's empty, poll the event loop (mio or epoll) for completed I/O and move the woken fibers back to ready.",
        },
        {
          title: "Avoid pinning",
          body: "Native functions that might block must return a `Pending(token)` instead of blocking the thread. That's what lets the fiber park and frees the carrier.",
        },
      ],
    },
    questions: [
      {
        q: "Why are virtual threads so much cheaper than OS threads?",
        intuition: "An OS thread reserves a large desk in advance. A virtual thread is a folder you put on any free desk when there's work, and put back in the drawer while it waits.",
        technical:
          "OS threads reserve virtual memory for a fixed stack, and switching between them goes through the kernel scheduler. A virtual thread's frames live on the heap as a small, growable chunk, and switching is a user-space copy or pointer swap with no syscall.",
      },
      {
        q: "What is pinning, and how do I avoid it in my VM?",
        intuition: "It's when a fiber can't be lifted off its desk because something underneath is glued down.",
        technical:
          "If a Wisp call goes through a native Rust frame, for example a callback from `sort`, those Rust frames can't be saved as part of the fiber. Either reimplement such natives in bytecode, run them in a way that can resume later, or document that yielding inside them is an error, which is what Lua does.",
      },
      {
        q: "GIL or no GIL?",
        intuition: "One talking stick keeps a meeting orderly. It also means only one person speaks at a time.",
        technical:
          "A global lock makes the interpreter and GC single-threaded, with no memory model to design, at the cost of parallelism. CPython is now making its GIL optional with much more complex internals. For a new embeddable language, isolated heaps plus message passing gets you parallelism without shared-memory hazards.",
      },
    ],
  },
  {
    slug: "safepoints",
    title: "Safepoints & Memory Model",
    level: "Advanced",
    accent: "rose",
    icon: "OctagonPause",
    summary: "Why a VM must sometimes stop the world, how threads reach a safe stopping point, and what threads may see of each other's writes.",
    tags: ["Safepoint Polls", "Stop-the-World", "Time-to-Safepoint", "Happens-Before"],
    intro: [
      "Some operations need every thread paused at a known-good point: a moving GC, deoptimization, redefining code. The JVM calls these points safepoints. Threads check a poll flag at method returns and loop back-edges, and the VM waits until every thread has reached one. The slowest thread decides the pause length.",
      "Once threads share a heap, you also need to say what one thread can see of another's writes. The Java Memory Model's happens-before rules are the reference design. Your best choice may be to design your VM so that you never need to answer that question.",
    ],
    sim: "safepoints",
    simTitle: "Request a safepoint and watch threads arrive",
    jvm: {
      title: "What safepoints and the JMM teach us",
      points: [
        "At a safepoint, every object reference's location is known, through stack maps, so a GC can find and move pointers.",
        "Polls sit at method exits and loop back-edges. Counted `int` loops historically had no poll, which caused long time-to-safepoint (TTSP) stalls.",
        "The time a stop-the-world pause takes includes waiting for the last thread, not just the GC work.",
        "The JMM defines happens-before. Without `volatile`, a lock or a final field, a write in one thread may never become visible to another.",
      ],
    },
    concepts: [
      {
        heading: "Why not stop a thread anywhere?",
        body: [
          "In the middle of an instruction, a pointer may be held only in a register, or an object may be half initialized. A moving collector would miss that pointer or relocate the half-built object. Safepoints are the instruction boundaries where the VM guarantees a consistent, fully described state.",
          "In a bytecode interpreter, almost every instruction boundary can be a safepoint, because all values sit in the value stack where the GC can see them. That's one of the quiet advantages of interpreters.",
        ],
      },
      {
        heading: "Cheap polls",
        body: [
          "Checking an atomic flag on every instruction is wasteful. Check only on `LOOP` (back-edges) and `CALL`/`RETURN`. Every unbounded execution path passes through one of those, so a thread can't run forever without reaching a poll.",
        ],
        code: {
          lang: "rust",
          code: `Op::Loop => {
    let off = read_u16(code, &mut ip);
    ip -= off as usize;
    if SAFEPOINT.load(Ordering::Relaxed) {   // one well-predicted branch
        self.save_ip(ip);
        self.park_at_safepoint();             // GC runs while we're parked
    }
}`,
        },
      },
    ],
    build: {
      intro: "You only need this when more than one mutator thread shares a heap. Until then, you get it for free.",
      steps: [
        {
          title: "A global request flag and a counter",
          body: "The collector sets `SAFEPOINT = true` and waits on a condvar until `parked == running_threads`, then does its work and releases everyone.",
        },
        {
          title: "Treat natives as already safe",
          body: "A thread inside a blocking native call that doesn't touch the heap counts as parked. That's how the JVM treats threads in JNI calls.",
        },
        {
          title: "Pick a memory model you can explain in one sentence",
          body: "For example: \"Objects are owned by one fiber at a time; sending one to another fiber transfers it.\" Ownership transfer removes data races by construction.",
        },
      ],
    },
    questions: [
      {
        q: "What is time-to-safepoint and why does it cause latency spikes?",
        intuition: "A meeting can't start until the last person arrives. If one person is in a long hallway with no doors, everyone waits.",
        technical:
          "TTSP is the gap between the safepoint request and the last thread parking. A hot loop that the JIT compiled without polls (counted-loop poll elision) can delay the pause by hundreds of milliseconds. JDK 10+ uses loop strip mining to insert polls periodically. In your interpreter, polling on `LOOP` avoids the problem.",
      },
      {
        q: "If my VM has a global lock, do I still need a memory model?",
        intuition: "If only one person can write on the whiteboard at a time, and passing the marker is a ritual, everyone always sees the latest board.",
        technical:
          "Acquiring and releasing a lock are synchronization actions that create happens-before edges. With a GIL, every switch between threads goes through the lock, so all writes become visible. You still need to define what natives running outside the lock may touch.",
      },
      {
        q: "Why can a Java thread never see another thread's update without volatile?",
        intuition: "Each worker may keep a private notepad copy of a value and never re-check the original.",
        technical:
          "Both the JIT and the CPU may cache values in registers, hoist loads out of loops and reorder stores. Without a happens-before edge (`volatile`, a lock, or `Thread.start`/`join`), the JMM allows the reader to see a stale value forever. A loop like `while (!done) {}` may be compiled into an infinite loop.",
      },
    ],
  },
  {
    slug: "ffi",
    title: "Native Interface & Off-Heap",
    level: "Advanced",
    accent: "cyan",
    icon: "Plug",
    summary: "Call into Rust and C safely, keep the GC from moving or freeing objects mid-call, and manage memory the GC never sees.",
    tags: ["Native Functions", "Handles", "Foreign Memory", "Panama vs JNI"],
    intro: [
      "No VM lives alone. Files, sockets, clocks and math libraries all live in native code. The JVM's original bridge, JNI, is powerful and notoriously awkward: native code sees objects only through handles, and crossing the boundary is expensive. Project Panama's Foreign Function & Memory API is the modern redesign.",
      "Your native interface is simply how Wisp calls Rust. Design it early, because the standard library, I/O and fibers all depend on it.",
    ],
    sim: "flow",
    simTitle: "A Wisp call crossing into native code",
    flow: [
      { label: "Wisp call", sub: "io.read(path)" },
      { label: "Arg check", sub: "arity + types" },
      { label: "Native fn", sub: "fn(&mut Vm, &[Value])" },
      { label: "Rooted", sub: "temps protected" },
      { label: "Result", sub: "Value or Error" },
    ],
    jvm: {
      title: "What JNI and Panama teach us",
      points: [
        "Native code never gets raw object pointers. It gets local and global references (handles) that the GC can update.",
        "Each JNI transition has overhead from thread-state changes, handle frames and safepoint checks.",
        "`DirectByteBuffer` and `MemorySegment` give off-heap memory that the GC doesn't scan, with explicit or arena-scoped lifetimes.",
        "Panama's `Linker` describes native signatures in Java, so no C glue code is needed.",
      ],
    },
    concepts: [
      {
        heading: "The native function signature",
        body: [
          "Make natives ordinary Wisp values. The interpreter's `CALL` checks whether the callee is a closure or a native and dispatches accordingly. Passing `&mut Vm` lets natives allocate, raise errors and call back into the VM.",
        ],
        code: {
          lang: "rust",
          code: `pub type NativeFn = fn(vm: &mut Vm, args: &[Value]) -> Result<Value, WispError>;

vm.define_native("clock", 0, |_, _| {
    Ok(Value::Num(START.elapsed().as_secs_f64()))
});`,
        },
      },
      {
        heading: "Keep the GC informed",
        body: [
          "If a native allocates two objects and the second allocation triggers a GC, the first one, held only in a Rust local, can be freed. Fix this with temp roots (push onto the value stack or a root list), or by building the result so that each new object is reachable before the next allocation.",
        ],
      },
    ],
    build: {
      intro: "A small, safe surface first. Raw C FFI can come later.",
      steps: [
        {
          title: "Register natives into modules",
          body: "Build `std/io`, `std/math` and `std/time` as Rust tables of `(name, arity, NativeFn)` exposed as Wisp module objects.",
        },
        {
          title: "Byte buffers off the GC heap",
          body: "A `Buffer` object owns a `Box<[u8]>`. The GC tracks only the small header, and the bytes are freed when the header is swept, like a `DirectByteBuffer`.",
        },
        {
          title: "Optional: dynamic C calls",
          body: "Use `libloading` plus `libffi` to call symbols from shared libraries using a signature declared in Wisp. Keep it behind a flag, because it's an escape hatch from memory safety.",
        },
      ],
    },
    questions: [
      {
        q: "Why is crossing into native code slow on the JVM?",
        intuition: "It's like crossing a border. Passports get checked and luggage gets wrapped, even for a short trip.",
        technical:
          "A JNI call switches the thread to the native state (so it counts as safepoint-safe), creates a local-reference frame, wraps object arguments as handles, and on return checks for pending exceptions and safepoints. Panama's downcalls let the JIT generate specialized stubs that remove most of that work.",
      },
      {
        q: "Why would anyone want off-heap memory?",
        intuition: "Some things are too big or too long-lived to keep in a room the cleaner sweeps every hour.",
        technical:
          "Large buffers in the GC heap get copied by moving collectors and scanned for pointers they don't contain. Off-heap memory is never moved, can be passed to I/O syscalls directly, and can be memory-mapped. The cost is that you manage its lifetime yourself.",
      },
      {
        q: "Can native code hold on to my VM's objects?",
        intuition: "Only with a claim ticket the cleaner respects, never a sticky note with a shelf number.",
        technical:
          "A raw `*mut Obj` becomes dangling after a moving GC, or after the object dies. Give natives handles that are indices into a root table the GC scans and updates, similar to JNI's global references. Remember to release them, or you'll create the native equivalent of a memory leak.",
      },
    ],
  },
  {
    slug: "tooling",
    title: "Profiling, Flags & Debugging",
    level: "Advanced",
    accent: "emerald",
    icon: "Gauge",
    summary: "The JVM's real advantage is observability. Build tracing, GC stress, stack traces and a sampling profiler into your VM from day one.",
    tags: ["VM Flags", "GC Stress", "Stack Traces", "Sampling Profiler"],
    intro: [
      "The JVM isn't only fast. It's inspectable. `-Xlog:gc`, `jstack`, `jcmd`, JFR and heap dumps let you see inside a running VM. Much of Java's production reputation rests on that tooling.",
      "A VM you can't observe is a VM you can't debug. Flags for tracing, stress testing and dumping cost a few lines each and save days of debugging.",
    ],
    sim: "flow",
    simTitle: "Signals your VM should be able to emit",
    flow: [
      { label: "--trace", sub: "op + stack per step" },
      { label: "--gc-stress", sub: "GC on every alloc" },
      { label: "--gc-log", sub: "pause, freed, live" },
      { label: "Stack trace", sub: "frames + lines" },
      { label: "Profiler", sub: "sample ip @1kHz" },
    ],
    jvm: {
      title: "What JVM tooling teaches us",
      points: [
        "Sizing flags (`-Xmx`, `-Xss`) make resource limits explicit and adjustable.",
        "`-Xlog:gc*` reports every collection's cause, duration and before/after sizes, which is essential for tuning.",
        "`jstack` dumps every thread's frames, the first tool to reach for when a program hangs.",
        "JFR samples continuously at low overhead, so profiling in production is normal.",
      ],
    },
    concepts: [
      {
        heading: "GC stress mode is your best bug finder",
        body: [
          "Most GC bugs are missing roots, which only show up when a collection happens at an unlucky moment. Forcing a full collection on every allocation makes every moment unlucky. Run your whole test suite this way in CI.",
        ],
      },
      {
        heading: "Sampling beats instrumenting",
        body: [
          "Counting every call distorts what you're measuring. Instead, have a timer thread set a flag every millisecond. At the next safepoint poll, record the current function and ip. After a few thousand samples you have an accurate flame graph at almost no cost.",
        ],
        code: {
          lang: "rust",
          code: `#[derive(clap::Parser)]
pub struct VmFlags {
    #[arg(long)] trace: bool,
    #[arg(long)] gc_stress: bool,
    #[arg(long)] gc_log: bool,
    #[arg(long, default_value = "64M")] max_heap: ByteSize,   // your -Xmx
    #[arg(long, default_value_t = 1 << 16)] max_stack: usize, // your -Xss
    #[arg(long)] profile: Option<PathBuf>,                    // folded stacks
}`,
        },
      },
    ],
    build: {
      intro: "Add these early. They pay off with every later lesson.",
      steps: [
        {
          title: "Stack traces with line numbers",
          body: "On an uncaught error, walk `frames` from top to bottom and map each `ip` through the line table. Show the function name and line for each frame.",
        },
        {
          title: "Structured GC logs",
          body: "One line per collection: reason, duration, bytes before and after, objects freed. Grep-friendly logs are useful tooling in their own right.",
        },
        {
          title: "A REPL with :dis and :heap",
          body: "`:dis fn` disassembles a function, and `:heap` prints object counts by kind. Your own small `jcmd`.",
        },
      ],
    },
    questions: [
      {
        q: "Which debug flag should I build first?",
        intuition: "The one that turns rare, random crashes into immediate, repeatable ones.",
        technical:
          "`--gc-stress`. Missing-root bugs corrupt memory silently and crash much later, far from the cause. Collecting on every allocation makes the failure happen at the first instruction that relied on the dead object, which turns a three-day hunt into a stack trace.",
      },
      {
        q: "Why do sampling profilers suffer from safepoint bias?",
        intuition: "If you only check what someone's doing when they pause at a doorway, you'll think they spend all day in doorways.",
        technical:
          "Many JVM profilers sample only at safepoints, so time spent in poll-free compiled loops gets attributed to the next poll site. async-profiler and JFR avoid this with signal-based sampling. In an interpreter that polls on every back-edge and call, the bias is small.",
      },
      {
        q: "What should my VM do on out-of-memory?",
        intuition: "Fail loudly and politely, never by crashing the host program.",
        technical:
          "When `bytes_allocated` would exceed `max_heap` after a full GC, throw a catchable Wisp `OutOfMemory` error, like the JVM's `OutOfMemoryError`. Keep a small reserved pool so that raising the error can itself allocate.",
      },
    ],
  },
];
