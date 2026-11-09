import type { Lesson } from "./types";

export const foundationLessons: Lesson[] = [
  {
    slug: "how-code-runs",
    title: "How Code Runs",
    level: "Foundational",
    accent: "blue",
    icon: "Play",
    summary: "Follow a program from source text to a running result, and see why the JVM puts bytecode in the middle.",
    tags: ["Source → Bytecode → Execution", "Front end vs back end", "Portability", "Your VM's pipeline"],
    intro: [
      "Java never runs your source code directly. `javac` turns `.java` files into `.class` files full of bytecode, and the JVM runs that bytecode. The bytecode is the agreement between the two halves. The compiler only has to produce valid bytecode, and the VM only has to run valid bytecode, so neither side needs to know how the other works.",
      "Your VM will use the same split, only smaller. A script goes through a lexer, a parser and a compiler, and the result is a compact array of instructions that a tight loop executes. This lesson builds the overall picture that every later lesson fills in.",
    ],
    sim: "pipeline",
    simTitle: "Step a tiny Wisp program through every stage",
    jvm: {
      title: "What the JVM teaches us",
      points: [
        "`javac` and the JVM are separate programs that talk only through the class-file format. Because of that contract, Kotlin, Scala and Clojure can all run on the JVM.",
        "Execution is layered. Bytecode starts out interpreted, and methods that run often (hot methods) are compiled to machine code by the JIT, so startup stays fast and long runs get faster.",
        "The JDK is the tools plus the JRE, and the JRE is the JVM plus the standard library. The VM itself is a small core with a large library around it.",
        "Portability comes from a precisely specified bytecode, not from the source language. Every JVM must agree on what each instruction means.",
      ],
    },
    concepts: [
      {
        heading: "Why not just walk the syntax tree?",
        body: [
          "The simplest interpreter walks the AST: `eval(node)` looks at the node type and recurses into its children. It's easy to write and slow to run. Every node is a separate heap allocation, every step follows a pointer, and the CPU cache keeps missing.",
          "Bytecode flattens the tree into a dense array of bytes. Execution becomes a loop that reads the next byte, jumps to its handler and repeats. That access pattern is cache-friendly and predictable, and it's usually several times faster than walking the tree.",
        ],
      },
      {
        heading: "Compile ahead of time, or at load time?",
        body: [
          "Java compiles ahead of time with `javac` and ships the bytecode. Scripting languages like Lua and Python compile inside the VM when a script loads. That takes milliseconds, so the user never notices.",
          "You can do both. Compile on load, and optionally cache the compiled bytecode to disk the way CPython writes `.pyc` files. Give the format a magic number and a version, the way class files start with `0xCAFEBABE`.",
        ],
        code: {
          lang: "text",
          caption: "A header for your serialized bytecode",
          code: `magic    : u32  = 0x57495350   // "WISP"
version  : u16  = 1
consts   : u32 count, then tagged values
functions: u32 count, then { arity, upvalues, code_len, code[], lines[] }`,
        },
      },
    ],
    build: {
      intro: "Wire up the whole pipeline first, even with stub stages. A runnable skeleton is worth more than one perfect stage.",
      steps: [
        {
          title: "Define the four stages as plain functions",
          body: "Each stage takes the previous stage's output and returns a `Result`, so errors can come from any phase.",
          code: {
            lang: "rust",
            code: `pub fn run(src: &str, vm: &mut Vm) -> Result<Value, WispError> {
    let tokens = lexer::lex(src)?;           // text   -> tokens
    let ast    = parser::parse(&tokens)?;     // tokens -> tree
    let func   = compiler::compile(&ast)?;    // tree   -> bytecode
    vm.interpret(func)                        // bytecode -> result
}`,
          },
        },
        {
          title: "Make bytecode a first-class artifact",
          body: "Add a `--dump` flag that prints the disassembled bytecode. You'll use it constantly, the same way Java developers use `javap -c`.",
        },
        {
          title: "Keep the VM independent of the compiler",
          body: "The VM should accept any `Function` object. Later you can load cached bytecode, or a second front end, without touching the interpreter.",
        },
      ],
    },
    questions: [
      {
        q: "If the AST already describes the program, why add bytecode at all?",
        intuition:
          "A recipe written as a family tree of sub-recipes is accurate but awkward to follow while cooking. Bytecode is the same recipe rewritten as a numbered checklist you read from top to bottom.",
        technical:
          "Tree-walking costs a virtual dispatch and a pointer chase per node, and the nodes are scattered across the heap. Bytecode is a contiguous `Vec<u8>`, dispatch is one indexed jump, and operands sit right next to their opcode. The array also gives you a natural place for jump offsets, line tables and inline caches.",
      },
      {
        q: "What actually makes Java portable: the language or the VM?",
        intuition:
          "Neither alone. The portable part is the bytecode, which works like a universal plug shape. Every OS gets its own native JVM, the adapter, that accepts that plug.",
        technical:
          "The JVM Specification pins down the class-file format and the semantics of every opcode, including byte order (big-endian) and integer widths. For your VM to be portable, serialize multi-byte operands in a fixed byte order and never write native pointer sizes into the format.",
      },
      {
        q: "Does Java get compiled twice?",
        intuition: "Yes. It's compiled once for portability (source to bytecode) and again for speed (bytecode to machine code) for the parts that run often.",
        technical:
          "`javac` performs AOT compilation to bytecode. At runtime HotSpot interprets first, profiles, then uses C1 and C2 to compile hot methods to native code. The profile data from the interpreter is what makes the second compilation smart.",
      },
    ],
  },
  {
    slug: "front-end",
    title: "Lexing, Parsing & ASTs",
    level: "Foundational",
    accent: "violet",
    icon: "Braces",
    summary: "Turn raw text into a tree your compiler can reason about. This is where `javac` spends its first steps.",
    tags: ["Tokens", "Pratt Parsing", "AST Design", "Error Recovery"],
    intro: [
      "Before any bytecode exists, text has to become structure. `javac` scans characters into tokens, parses the tokens into a syntax tree, checks types on that tree, desugars it, and only then generates bytecode. The JVM never sees any of this. It only sees the result.",
      "Wisp is dynamically typed and has no classes, so your front end is much smaller. You still need the same three ideas: tokens with source positions, a parser that handles operator precedence, and an AST that is easy to compile.",
    ],
    sim: "flow",
    simTitle: "The front-end pipeline",
    flow: [
      { label: "Source", sub: "let x = 1 + 2 * 3" },
      { label: "Tokens", sub: "LET IDENT EQ NUM PLUS…" },
      { label: "AST", sub: "Let(x, Add(1, Mul(2,3)))" },
      { label: "Resolver", sub: "x → local slot 0" },
      { label: "Compiler", sub: "emit bytecode" },
    ],
    jvm: {
      title: "What javac teaches us",
      points: [
        "Front end and back end are separate phases: parse, attribute, flow-check, desugar, then generate. Each phase does one job well.",
        "Desugaring is cheap leverage. Java rewrites enhanced `for`, string `+` and lambdas into simpler forms before generating code.",
        "Source positions survive into bytecode as the `LineNumberTable`. That's why Java stack traces show line numbers.",
        "Scope resolution happens at compile time. By the time code runs, a local variable is just a slot index, never a name.",
      ],
    },
    concepts: [
      {
        heading: "Tokens carry their position",
        body: [
          "A token is a kind plus a span: `{ kind: Number, start: 14, len: 1, line: 2 }`. Don't copy strings into tokens. Slice the source when you need the text. Spans are what turn error messages from \"syntax error\" into a caret under the exact character.",
        ],
      },
      {
        heading: "Pratt parsing for expressions",
        body: [
          "Recursive descent with one function per precedence level gets verbose quickly. A Pratt parser gives each operator a binding power and runs one loop: parse a prefix, then keep absorbing infix operators that bind tighter than the current level.",
          "Adding a new operator becomes a one-line table entry instead of a new grammar function.",
        ],
        code: {
          lang: "rust",
          caption: "The core Pratt loop",
          code: `fn expr(&mut self, min_bp: u8) -> Result<Expr> {
    let mut lhs = self.prefix()?;
    while let Some((l_bp, r_bp)) = infix_power(self.peek()) {
        if l_bp < min_bp { break; }
        let op = self.advance();
        let rhs = self.expr(r_bp)?;
        lhs = Expr::Binary(Box::new(lhs), op, Box::new(rhs));
    }
    Ok(lhs)
}`,
        },
      },
      {
        heading: "Recover, don't stop",
        body: [
          "When the parser hits an error, record it and skip forward to a safe point, usually the next statement keyword or `;`, then continue parsing. That way one run reports every mistake instead of only the first.",
        ],
      },
    ],
    build: {
      intro: "Use a small AST built from Rust enums. Every node should carry a span.",
      steps: [
        {
          title: "Model the tree as enums",
          body: "Wisp needs no class declarations. Functions, objects and closures are all expressions.",
          code: {
            lang: "rust",
            code: `pub enum Expr {
    Num(f64), Str(Rc<str>), Bool(bool), Nil,
    Var(Sym),
    Binary(Box<Expr>, BinOp, Box<Expr>),
    Call(Box<Expr>, Vec<Expr>),
    Fn { params: Vec<Sym>, body: Vec<Stmt> },
    Object(Vec<(Sym, Expr)>),          // { name: "wisp", age: 1 }
    Get(Box<Expr>, Sym),
}`,
          },
        },
        {
          title: "Add a resolver pass",
          body: "Walk the tree once to decide whether each variable is local, captured (an upvalue) or global. The compiler then becomes straightforward code emission.",
        },
        {
          title: "Desugar early",
          body: "Lower `for x in xs` into a `while` loop over an iterator, and compound assignment `a += 1` into `a = a + 1`. Each construct you desugar is one less construct the compiler has to handle.",
        },
      ],
    },
    questions: [
      {
        q: "Should I skip the AST and compile straight from the parser?",
        intuition:
          "You can, the way a simultaneous interpreter translates without notes. It's fast, but you can't go back and improve a sentence you've already spoken.",
        technical:
          "Single-pass compilers like clox and early Lua avoid allocating a tree, but they make resolution, constant folding and closure capture analysis harder. Variable capture is the main problem, because you only learn a local is captured after you've already emitted code for it. For a learning VM, build the AST.",
      },
      {
        q: "Why does Pratt parsing handle precedence so neatly?",
        intuition:
          "Each operator has a grip strength. `*` grips its neighbours harder than `+`, so in `1 + 2 * 3` the `2` gets pulled toward the `*`.",
        technical:
          "Binding powers come in pairs (left, right). Left-associative operators use (n, n+1) and right-associative ones use (n+1, n). The recursion `expr(r_bp)` only consumes operators whose left power is at least `min_bp`, and that is exactly the precedence-climbing rule.",
      },
      {
        q: "How do stack traces know line numbers?",
        intuition: "The compiler leaves a breadcrumb next to each instruction that says which source line it came from.",
        technical:
          "The JVM stores a `LineNumberTable` that maps bytecode offsets to lines. You can do the same with run-length encoding: store `(offset, line)` pairs only where the line changes, then binary-search them when you build an error.",
      },
    ],
  },
  {
    slug: "bytecode",
    title: "Designing Bytecode",
    level: "Foundational",
    accent: "cyan",
    icon: "Binary",
    summary: "Choose a stack machine, define your opcodes, and step through execution one instruction at a time.",
    tags: ["Operand Stack", "Opcodes", "Constant Pool", "Encoding"],
    intro: [
      "The JVM is a stack machine. `iadd` takes no operands: it pops two ints and pushes their sum. Instructions are a single byte, with operands packed after them. This makes bytecode compact and easy for a compiler to emit, because compiling an expression is just a post-order walk of the tree.",
      "Your instruction set is the most important design decision you'll make. It sets how the compiler, interpreter, debugger and any future JIT see the program. Start small, with about 30 opcodes, and use the stepper below to see exactly what each one does to the stack.",
    ],
    sim: "bytecode",
    simTitle: "Bytecode playground: step the operand stack",
    jvm: {
      title: "What JVM bytecode teaches us",
      points: [
        "One-byte opcodes give 256 possible instructions. The JVM uses about 200, which leaves room to grow.",
        "Operands are inline. `bipush 7` stores the 7 right after the opcode, while `ldc #3` indexes into the constant pool.",
        "Typed opcodes (`iadd`, `ladd`, `fadd`, `dadd`) let the verifier and JIT trust operand types without checking at runtime.",
        "Each method records `max_stack` and `max_locals`, so the frame size is known before the method runs.",
      ],
    },
    concepts: [
      {
        heading: "Stack machine or register machine?",
        body: [
          "Stack machines (JVM, CPython, WebAssembly) produce small instructions and simple compilers. Register machines (Lua 5, Dalvik) name their operands, as in `ADD r2, r0, r1`. That means fewer instructions and less pushing and popping, but each instruction is wider and register allocation is harder.",
          "For a first VM, use a stack machine. Once it works, see whether a register design or superinstructions fix your hot paths.",
        ],
      },
      {
        heading: "Untyped ops, tagged values",
        body: [
          "Wisp is dynamic, so there's a single `ADD` that checks tags at runtime: number plus number adds, string plus string concatenates. Typed opcodes come back later in a different form: a quickened `ADD_NUM` that the interpreter rewrites in place after it sees numbers a few times.",
        ],
      },
    ],
    build: {
      intro: "Define the instruction set, a chunk that stores it, and a disassembler, in that order.",
      steps: [
        {
          title: "A byte-sized opcode enum",
          body: "`#[repr(u8)]` makes each variant exactly one byte, so it can sit directly in `Vec<u8>`.",
          code: {
            lang: "rust",
            code: `#[repr(u8)]
pub enum Op {
    Const,        // u16 index into constants
    Nil, True, False, Pop,
    GetLocal, SetLocal,     // u8 slot
    GetGlobal, SetGlobal,   // u16 name constant
    Add, Sub, Mul, Div, Neg, Not, Eq, Lt,
    Jump, JumpIfFalse, Loop, // u16 offset
    Call,                   // u8 argc
    Closure, GetUpvalue, SetUpvalue, CloseUpvalue,
    GetProp, SetProp,       // u16 name + u16 cache slot
    Return,
}`,
          },
        },
        {
          title: "A chunk holds code, constants and lines",
          body: "Deduplicate constants the way the JVM constant pool does, so the same string literal is stored once.",
          code: {
            lang: "rust",
            code: `pub struct Chunk {
    pub code: Vec<u8>,
    pub constants: Vec<Value>,
    pub lines: Vec<(u32, u32)>, // (offset, line), run-length
}`,
          },
        },
        {
          title: "Write the disassembler now",
          body: "A `javap -c` for your VM. Every bug you'll chase in later lessons is easier to see in disassembly.",
        },
      ],
    },
    questions: [
      {
        q: "Why does the JVM have separate iadd, ladd and dadd instead of one add?",
        intuition: "Labelled jars are faster to use than unlabelled ones. You never have to open the lid to check what's inside.",
        technical:
          "Typed opcodes let the bytecode verifier prove type safety statically, and let the interpreter skip tag checks entirely. A dynamic language can't know types at compile time. Quickening and inline caches recover most of that speed at runtime by specializing on the types it actually observes.",
      },
      {
        q: "u8 or u16 for constant indices?",
        intuition: "A short index saves bytes, but you'll eventually run out of numbers.",
        technical:
          "The JVM has `ldc` (u8 index) and `ldc_w` (u16 index). Do the same: emit the short form when the index fits and a wide form otherwise. Or use u16 everywhere at first. You can optimize the encoding once you have a disassembler and real programs to measure.",
      },
      {
        q: "How many opcodes should I start with?",
        intuition: "Enough to write fizzbuzz and a recursive fib, and no more.",
        technical:
          "About 30 cover constants, locals, globals, arithmetic, comparison, jumps, calls, closures, properties and return. Add specialized opcodes only when a profiler shows a hot pattern, such as `ADD_CONST` for `i + 1` or `GET_LOCAL_0`.",
      },
    ],
  },
  {
    slug: "compiler",
    title: "Compiling to Bytecode",
    level: "Intermediate",
    accent: "emerald",
    icon: "Cog",
    summary: "Resolve scopes to slots, emit jumps and patch them later, and build a constant pool, the same way javac's code generator does.",
    tags: ["Local Slots", "Jump Patching", "Constant Pool", "Max Stack"],
    intro: [
      "The compiler is a translator with a good memory. It walks the AST, keeps track of which variables are in scope, and emits instructions. Expressions compile in post-order (children first, then the operator). Control flow compiles to jumps whose targets are often unknown when the jump is emitted.",
      "`javac`'s code generator solves the same problems your compiler will: mapping locals to numbered slots, back-patching forward jumps, deduplicating constants, and calculating how deep the operand stack can get.",
    ],
    sim: "flow",
    simTitle: "From tree to instructions",
    flow: [
      { label: "Resolve", sub: "names → scopes" },
      { label: "Allocate", sub: "locals → slots" },
      { label: "Emit", sub: "post-order ops" },
      { label: "Patch", sub: "fill jump offsets" },
      { label: "Seal", sub: "consts + max_stack" },
    ],
    jvm: {
      title: "What javac's code generator teaches us",
      points: [
        "Locals are numbered slots (`iload_1`, `astore_2`), and slots are reused once a block's scope ends.",
        "Forward branches are emitted with placeholder offsets and filled in once the target address is known.",
        "Each method gets `max_stack`, computed from how far each instruction moves the stack. The frame is sized exactly once.",
        "`StackMapTable` frames let the verifier check types in one linear pass. They're only needed when the bytecode can't be trusted.",
      ],
    },
    concepts: [
      {
        heading: "Locals live in the stack, not in a hash map",
        body: [
          "Inside a function, `let x` doesn't create a dictionary entry. It claims the next slot in the current frame. The compiler keeps a list of `(name, depth)` pairs. Resolving a name means scanning that list backwards, which gives shadowing for free. When a block ends, its locals are popped.",
          "At runtime, `GET_LOCAL 2` is a single indexed load from `stack[frame.base + 2]`.",
        ],
      },
      {
        heading: "Jumps and back-patching",
        body: [
          "To compile `if`, emit `JUMP_IF_FALSE ????`, compile the then-branch, then go back and write the real offset. Loops jump backwards with `LOOP offset`, and that target is already known.",
        ],
        code: {
          lang: "rust",
          code: `fn emit_jump(&mut self, op: Op) -> usize {
    self.emit(op as u8);
    self.emit(0xff); self.emit(0xff); // placeholder
    self.code().len() - 2
}
fn patch_jump(&mut self, at: usize) {
    let jump = (self.code().len() - at - 2) as u16;
    self.code_mut()[at..at + 2].copy_from_slice(&jump.to_be_bytes());
}`,
        },
      },
    ],
    build: {
      intro: "One `FunctionCompiler` per function being compiled, linked to the enclosing one so that upvalues can be resolved later.",
      steps: [
        {
          title: "Track scopes",
          body: "A `Vec<Local>` plus the current `scope_depth`. `begin_scope` increments the depth, and `end_scope` pops locals and emits `POP` (or `CLOSE_UPVALUE` for captured ones).",
          code: {
            lang: "rust",
            code: `struct Local { name: Sym, depth: u32, captured: bool }
struct FunctionCompiler<'a> {
    enclosing: Option<&'a mut FunctionCompiler<'a>>,
    function: FunctionProto,
    locals: Vec<Local>,
    scope_depth: u32,
}`,
          },
        },
        {
          title: "Compile statements",
          body: "Expression statements emit `POP` so the stack stays balanced. Track stack depth while emitting to compute `max_stack`, which lets the VM check for overflow once per call instead of on every push.",
        },
        {
          title: "Fold constants",
          body: "If both operands of `+` are numeric literals, emit the result as a single constant. It's a few lines of code and a nice first optimization.",
        },
      ],
    },
    questions: [
      {
        q: "How do break and continue compile?",
        intuition: "`break` is a jump to a spot you haven't reached yet, so you note where you left the placeholder and fill it in when the loop ends.",
        technical:
          "Keep a stack of loop contexts. Each one holds the loop start offset (for `continue`) and a list of pending `break` jump sites. At loop end, patch every site. Before jumping, also pop and close any locals declared inside the loop body.",
      },
      {
        q: "Does my VM need a bytecode verifier like the JVM's?",
        intuition: "Only if strangers can hand it bytecode. If your own compiler is the only source, it's checking its own homework.",
        technical:
          "The JVM verifies because class files can come from anywhere, including hostile sources. If you load cached or third-party bytecode, verify stack depths, jump targets within bounds, and constant indices. Trusted in-process compilation can skip it and rely on debug assertions.",
      },
      {
        q: "Why compute max_stack ahead of time?",
        intuition: "If you know the biggest pot you'll need before cooking, you never have to stop and look for a bigger one.",
        technical:
          "With `max_stack` known, `CALL` can do a single bounds check (`sp + max_stack <= stack_end`) and every push inside the function can skip its own check. One check per call replaces one per instruction.",
      },
    ],
  },
  {
    slug: "memory",
    title: "Stack, Heap & Values",
    level: "Foundational",
    accent: "cyan",
    icon: "Layers",
    summary: "See where values live: frames on a stack, objects on a heap, and how to pack a dynamic value into 8 bytes.",
    tags: ["Call Frames", "Object Headers", "Tagged Values", "NaN-Boxing"],
    intro: [
      "Every JVM thread has its own stack of frames. Each frame holds a method's locals and its operand stack. Objects live on a shared heap that the garbage collector manages. A local of type `Employee` is only a reference, an arrow pointing into the heap.",
      "Your VM follows the same layout. The design question that matters most here is how to represent a value. Wisp values can be a number, a bool, nil or a heap object, and the way you encode that affects the speed of every instruction.",
    ],
    sim: "heap-stack",
    simTitle: "Watch frames push, objects allocate, and references drop",
    jvm: {
      title: "What the JVM memory layout teaches us",
      points: [
        "Stacks are per thread. Frames push on call and pop on return, so locals never need garbage collection.",
        "Primitives sit directly in locals and fields. Only objects are behind references.",
        "Every object starts with a header: a mark word (hash, lock and GC bits) and a class pointer.",
        "Deep recursion causes a `StackOverflowError` and heap exhaustion causes an `OutOfMemoryError`. Fail with a clear error, not a segfault.",
      ],
    },
    concepts: [
      {
        heading: "Frames as windows into one big stack",
        body: [
          "The JVM gives each frame its own locals array and operand stack. Lua and clox use something simpler: one contiguous value stack, where each call frame is a window with a `base` pointer. The caller's arguments become the callee's first locals without being copied, which makes calls very cheap.",
        ],
        code: {
          lang: "rust",
          code: `struct CallFrame {
    closure: Gc<Closure>,
    ip: usize,     // next instruction in closure.proto.code
    base: usize,   // stack[base] = callee, stack[base+1..] = args/locals
}`,
        },
      },
      {
        heading: "Value representation: enum vs NaN-boxing",
        body: [
          "The obvious Rust choice is `enum Value { Nil, Bool(bool), Num(f64), Obj(Gc<Obj>) }`. It's safe and clear, and 16 bytes each. NaN-boxing fits every value into 8 bytes. IEEE-754 doubles have trillions of unused NaN bit patterns, so you hide tags and 48-bit pointers inside them. Numbers stay plain doubles, and everything else is a quiet NaN carrying a payload.",
          "Start with the enum, but hide it behind methods like `is_num()` and `as_obj()`. Switching to NaN-boxing later then changes one file.",
        ],
      },
    ],
    build: {
      intro: "Get the value type, the value stack and call frames working, with clear overflow errors.",
      steps: [
        {
          title: "Define Value and a heap object header",
          body: "Every heap object shares a header with a type tag and a GC mark bit, like the JVM mark word.",
          code: {
            lang: "rust",
            code: `#[derive(Clone, Copy)]
pub enum Value { Nil, Bool(bool), Num(f64), Obj(Gc<ObjHeader>) }

#[repr(C)]
pub struct ObjHeader { kind: ObjKind, marked: Cell<bool>, next: Cell<*mut ObjHeader> }`,
          },
        },
        {
          title: "Preallocate the value stack",
          body: "Use a fixed `Vec<Value>` with capacity of, say, 64K slots. Check `base + max_stack` on each call and raise a Wisp-level `StackOverflow` error, which is your version of `-Xss`.",
        },
        {
          title: "Implement CALL and RETURN",
          body: "`CALL argc` pushes a frame whose base is `sp - argc - 1`. `RETURN` pops the result, truncates the stack to the frame's base, pushes the result back and resumes the caller.",
        },
      ],
    },
    questions: [
      {
        q: "Java has primitives and objects. Why doesn't my language need that split?",
        intuition: "Users never see the split. The VM still makes it internally: small things go in the box, big things go in the warehouse with a ticket in the box.",
        technical:
          "Numbers, bools and nil are immediates stored directly in the `Value`. Strings, functions and objects are heap references. That's the same split the JVM makes, just invisible at the language level, much like JavaScript.",
      },
      {
        q: "What is NaN-boxing, intuitively?",
        intuition: "A 64-bit double has a huge range of \"not a number\" values that no calculation ever produces. You treat those unused codes as tagged pointers and small values.",
        technical:
          "A quiet NaN has the exponent all ones plus the quiet bit, which leaves about 51 payload bits. x86-64 and ARM64 user-space pointers fit in 48 bits. Use the sign bit to flag a pointer and a few low bits for nil, true and false. Decoding is a mask and a compare.",
      },
      {
        q: "Why must every thread have its own stack?",
        intuition: "Two cooks sharing one cutting board would keep pushing each other's vegetables off.",
        technical:
          "Frames record a function's in-progress state: ip, locals and temporaries. Interleaved threads would corrupt each other's frames. The heap is shared because objects are meant to be shared, and that sharing is exactly why you need GC coordination and a memory model.",
      },
    ],
  },
];
