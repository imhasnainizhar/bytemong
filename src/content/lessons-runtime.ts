import type { Lesson, Reference } from "./types";

const ci = (title: string, page: string, note?: string): Reference => ({
  title: `Crafting Interpreters: ${title}`,
  by: "Robert Nystrom",
  url: `https://craftinginterpreters.com/${page}.html`,
  kind: "book",
  note,
});

export const runtimeLessons: Lesson[] = [
  /* ───────────────────────────── 06 · Heap objects ───────────────────────────── */
  {
    slug: "objects",
    title: "Strings, Tables & the Heap",
    level: "Intermediate",
    accent: "amber",
    icon: "Shapes",
    summary: "Give the VM a heap: references, interned strings, and classless objects (tables), plus how the JVM's fixed object layouts inspire faster ones.",
    tags: ["Heap & references", "String interning", "Tables", "Shapes"],
    intro: [
      "So far every value fits in 16 bytes, but strings and objects don't. They have to live somewhere else, the **heap**, and values hold a small **reference** to them. That's exactly how the JVM works: an `Object` variable holds a reference, and the object itself lives in the Java heap.",
      "In this lesson you'll build a simple heap: a `Vec` of objects, with a reference that's just an index into it. On top of it come strings, a string-intern table, and Wisp's version of objects. Wisp has no classes, so an object is a **table**: a bag of named fields you can add to at any time.",
    ],
    sim: "shapes",
    simTitle: "How shapes turn dynamic fields into fixed slots",
    jvm: {
      title: "What the JVM heap teaches us",
      points: [
        "Every Java object starts with a header (a mark word plus a class pointer), followed by its fields at **fixed offsets** decided when the class loads. `getfield` is a single load from `object + offset`.",
        "String literals are **interned**: every `\"hello\"` in every class points to the same `String` object. That's why `==` happens to work on literals, and why `String.intern()` exists.",
        "Variables never contain objects, only references to them. Copying a reference is cheap, and two variables can point to the same object.",
        "With compressed oops, HotSpot stores references as 32-bit numbers and scales them into addresses. A reference is a number, not necessarily a raw pointer, which is the same idea as our index-based `ObjRef`.",
      ],
    },
    concepts: [
      {
        heading: "Why indexes instead of pointers?",
        body: [
          "In C you'd use raw pointers to heap objects. In Rust, raw pointers need `unsafe`, and `Rc<RefCell<...>>` everywhere makes code noisy and can't collect reference cycles. A `Vec<Obj>` plus a `u32` index avoids both problems. References are `Copy`, safe, and 4 bytes, and the garbage collector in lesson 09 is just a walk over that Vec.",
          "The trade-off is one extra indirection per access (`objects[i]`), plus a bounds check. It's fine for a learning VM, and it's easy to replace later because all access goes through `Heap::get`.",
        ],
      },
      {
        heading: "Shapes: how dynamic objects get fixed layouts",
        body: [
          "A `HashMap` per table is flexible but slow: every `p.x` is a hash lookup. Java avoids this because a class fixes the field layout up front. Dynamic VMs such as V8 and GraalJS recover that speed with **shapes** (also called hidden classes). Tables built with the same fields in the same order share a shape, which maps each name to a slot index, and the table itself stores only a `Vec<Value>` of slots.",
          "Combined with an **inline cache** (each `GetField` remembers \"last time, this shape had `x` at slot 0\"), a field read becomes a shape check plus an array index, close to Java's `getfield`. Build the simple `HashMap` version first. Shapes are a drop-in upgrade once it works.",
        ],
        code: {
          lang: "rust",
          caption: "the upgrade, sketched",
          code: `struct Shape {
    slots: HashMap<ObjRef, usize>,       // field name -> slot index
    transitions: HashMap<ObjRef, usize>, // "add field f" -> the next shape's id
}
struct Table {
    shape: usize,       // index into vm.shapes; tables with equal layouts share it
    values: Vec<Value>, // fields stored by slot, like a Java object's fields
}`,
        },
      },
    ],
    build: {
      intro: "Add an `object.rs` module with the heap, then teach `Value`, the compiler and the VM about references.",
      milestone: "string literals, `+` for joining strings, and table literals with `obj.field` reads and writes.",
      steps: [
        {
          title: "References and the heap",
          body: "`ObjRef` is the reference type, and `Heap` owns every object. `intern` makes sure equal strings share one object, so comparing two strings is just comparing two numbers.",
          code: {
            lang: "rust",
            caption: "src/object.rs",
            code: `use crate::value::Value;
use std::collections::HashMap;

/// A reference to a heap object: an index into Heap::objects.
/// Copy and only 4 bytes, like a compressed JVM reference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ObjRef(pub u32);

pub enum Obj {
    Str(String),
    Table(HashMap<ObjRef, Value>), // field name (an interned string) -> value
    // Function, Closure and Upvalue are added in lessons 07–08
}

#[derive(Default)]
pub struct Heap {
    objects: Vec<Option<Obj>>,        // None marks a free slot (used from lesson 09)
    strings: HashMap<String, ObjRef>, // the intern table: text -> its one shared object
}

impl Heap {
    pub fn alloc(&mut self, obj: Obj) -> ObjRef {
        self.objects.push(Some(obj));
        ObjRef(self.objects.len() as u32 - 1)
    }

    /// Return the one shared object for this text, creating it the first time.
    pub fn intern(&mut self, s: &str) -> ObjRef {
        if let Some(&r) = self.strings.get(s) {
            return r;
        }
        let r = self.alloc(Obj::Str(s.to_string()));
        self.strings.insert(s.to_string(), r);
        r
    }

    pub fn get(&self, r: ObjRef) -> &Obj {
        self.objects[r.0 as usize].as_ref().expect("use of a freed object")
    }

    pub fn get_mut(&mut self, r: ObjRef) -> &mut Obj {
        self.objects[r.0 as usize].as_mut().expect("use of a freed object")
    }

    /// How \`print\` shows a value. Objects need the heap to be displayed.
    pub fn show(&self, v: Value) -> String {
        match v {
            Value::Obj(r) => match self.get(r) {
                Obj::Str(s) => s.clone(),
                Obj::Table(t) => format!("<table with {} fields>", t.len()),
            },
            other => other.to_string(),
        }
    }
}`,
          },
          explain: [
            "Because every string is interned, two strings with the same text always have the same `ObjRef`. So `Value`'s derived `==` compares strings correctly with no extra code, and table field names can be `ObjRef`s instead of `String`s.",
            "`Option<Obj>` costs nothing yet, because every slot is `Some`. In lesson 09 the garbage collector frees objects by setting their slot to `None` and reusing it.",
          ],
          jvm: "The JVM interns string *literals* automatically, but strings built at runtime (`a + b`) are not interned unless you call `intern()`. Wisp interns every string to keep equality simple. It costs a hash lookup per new string, a reasonable price for a scripting language, and Lua does the same for short strings.",
        },
        {
          title: "A new Value variant",
          body: "Add one variant to `Value`. It's still `Copy` and still 16 bytes, because the object itself lives in the heap.",
          code: {
            lang: "rust",
            caption: "src/value.rs (changes)",
            code: `use crate::object::ObjRef;

pub enum Value {
    Nil,
    Bool(bool),
    Num(f64),
    Obj(ObjRef), // a string, table, function... anything on the heap
}

// in Display: there's no heap here, so this is only a fallback (print uses Heap::show)
Value::Obj(r) => write!(f, "<obj #{}>", r.0),`,
          },
        },
        {
          title: "Compile strings, tables and fields",
          body: "The compiler now needs the heap, to intern string constants. String literals and field names both become `Value::Obj` constants in the chunk's constant pool.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `// The compiler borrows the VM's heap while it runs.
pub struct Compiler<'h> {
    // ...chunk, locals, scope_depth, line as before...
    heap: &'h mut Heap,
}

pub fn compile(program: &[Stmt], heap: &mut Heap) -> Result<Chunk, String> { /* same as before */ }

impl Compiler<'_> {
    /// Intern a string and add it to the constant pool.
    fn str_const(&mut self, s: &str) -> u16 {
        let r = self.heap.intern(s);
        self.chunk.add_const(Value::Obj(r))
    }
}

// new arms in Compiler::expr
Expr::Str(s) => {
    let k = self.str_const(s);
    self.emit(Op::Const(k));
}
Expr::Table(fields) => {
    self.emit(Op::NewTable);           // [.., t]
    for (name, value) in fields {
        self.emit(Op::Dup);            // [.., t, t]
        self.expr(value)?;             // [.., t, t, v]
        let k = self.str_const(name);
        self.emit(Op::SetField(k));    // [.., t, v]   (SetField pops t and v, pushes v)
        self.emit(Op::Pop);            // [.., t]
    }
}
Expr::Get(obj, name, line) => {
    self.expr(obj)?;
    self.line = *line;
    let k = self.str_const(name);
    self.emit(Op::GetField(k));        // pop obj, push obj.name
}
Expr::Set(obj, name, value, line) => {
    self.expr(obj)?;
    self.expr(value)?;
    self.line = *line;
    let k = self.str_const(name);
    self.emit(Op::SetField(k));        // pop value and obj, set the field, push value
}

// and three new instructions in chunk.rs
NewTable,          // push an empty table                new
GetField(u16),     // operand = field-name constant      getfield
SetField(u16),     //                                    putfield`,
          },
          explain: [
            "The stack comments (`[.., t, t, v]`) are the best way to write stack-machine code. Write the stack state after every instruction and check that each expression ends with exactly one new value.",
            "`Dup` is reused for table literals. Each field assignment consumes a copy of the table and leaves the original for the next field.",
            "`main.rs` now creates the VM first and lends its heap to the compiler: `let chunk = compiler::compile(&program, &mut vm.heap)?;` followed by `vm.run(&chunk)`.",
          ],
          jvm: "`getfield #5` names its field through the constant pool too: entry #5 is a `Fieldref` pointing at a class and a name. The first time it runs, the JVM resolves that to a fixed byte offset and HotSpot rewrites the instruction into a faster internal version. Shapes plus inline caches are how a classless VM gets the same benefit.",
        },
        {
          title: "Teach the VM about objects",
          body: "`Add` gets its own arm so it can also join strings. The table instructions do a type check, then a `HashMap` operation. `Print` uses `heap.show`.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `pub struct Vm {
    // ...stack, globals as before...
    pub heap: Heap,
}

// Add: numbers add, strings join. Remove Op::Add from the shared numeric arm.
Op::Add => {
    let (b, a) = (self.pop(), self.pop());
    let result = match (a, b) {
        (Value::Num(x), Value::Num(y)) => Value::Num(x + y),
        (Value::Obj(x), Value::Obj(y)) => {
            let joined = match (self.heap.get(x), self.heap.get(y)) {
                (Obj::Str(s1), Obj::Str(s2)) => format!("{s1}{s2}"),
                _ => return Err(self.error(chunk, ip, "can only add numbers or strings")),
            };
            Value::Obj(self.heap.intern(&joined)) // the result is a (new or shared) heap string
        }
        _ => return Err(self.error(chunk, ip, "can only add numbers or strings")),
    };
    self.push(result);
}

Op::NewTable => {
    let t = self.heap.alloc(Obj::Table(HashMap::new()));
    self.push(Value::Obj(t));
}
Op::GetField(k) => {
    let Value::Obj(name) = chunk.consts[k as usize] else { unreachable!() };
    let Value::Obj(r) = self.pop() else {
        return Err(self.error(chunk, ip, "only tables have fields"));
    };
    let Obj::Table(fields) = self.heap.get(r) else {
        return Err(self.error(chunk, ip, "only tables have fields"));
    };
    let v = fields.get(&name).copied().unwrap_or(Value::Nil); // a missing field reads as nil
    self.push(v);
}
Op::SetField(k) => {
    let Value::Obj(name) = chunk.consts[k as usize] else { unreachable!() };
    let value = self.pop();
    let Value::Obj(r) = self.pop() else {
        return Err(self.error(chunk, ip, "only tables have fields"));
    };
    let Obj::Table(fields) = self.heap.get_mut(r) else {
        return Err(self.error(chunk, ip, "only tables have fields"));
    };
    fields.insert(name, value); // creates the field if it's new
    self.push(value);           // assignment is an expression
}

Op::Print => {
    let v = self.pop();
    println!("{}", self.heap.show(v));
}`,
          },
          explain: [
            "In `Add`, the inner `match` only *reads* the two strings to build `joined`. The borrow of the heap ends there, so the next line can call `intern`, which needs mutable access. Splitting reads and writes like this is the usual way to satisfy the borrow checker in a VM.",
            "Missing fields read as `nil` rather than raising an error. That's the Lua and JavaScript convention, and it makes optional fields easy. It's a language choice, so pick the one you prefer.",
            "Tables are reference values. `let a = {x: 1}  let b = a  b.x = 2  print a.x` prints `2`, because both variables hold the same `ObjRef`, exactly as two Java variables can point at one object.",
          ],
        },
        {
          title: "Try it",
          body: "Strings, tables and field updates now work end to end.",
          code: {
            lang: "wisp",
            caption: "objects.wisp",
            code: `let name = "wisp"
print "hello, " + name

let point = { x: 3, y: 4 }
point.x = 10
point.label = "corner"
print point.x + point.y
print point.label
print point.missing`,
          },
          output: `hello, wisp
14
corner
nil`,
        },
      ],
    },
    questions: [
      {
        q: "If Wisp has no classes, how do I share methods between objects?",
        intuition: "Give each object a link to a \"parent\" object. When a field isn't found on the object, look in its parent. JavaScript and Lua work this way.",
        technical:
          "That's **prototype delegation**. Add an optional `proto: Option<ObjRef>` to tables and make `GetField` follow the chain on a miss. Store functions in the prototype and pass the receiver as a hidden first argument (`self`). With shapes and inline caches, prototype lookups can be cached just like own-field lookups.",
      },
      {
        q: "Why intern every string? Isn't that slow?",
        intuition: "It costs a little when a string is created and saves a lot every time strings are compared or used as field names, which happens far more often.",
        technical:
          "Without interning, string `==` is a byte-by-byte comparison and table keys must be hashed on every lookup. With interning, both are integer comparisons. The cost is one hash lookup when creating a string, and the intern table must be weak so it doesn't keep dead strings alive. Lesson 09 handles that.",
      },
      {
        q: "How big is a Java object compared with a Wisp table?",
        intuition: "A small Java object is usually 16–24 bytes. A Wisp table with a `HashMap` is several times bigger, which is the price of being able to add fields at any time.",
        technical:
          "HotSpot uses a 12-byte header (with compressed class pointers) plus packed fields, padded to 8 bytes. A Rust `HashMap` is 48 bytes before allocating any buckets, and each entry costs more on top. Shapes fix this as well, because a table becomes a shape id plus a `Vec<Value>` of exactly its fields.",
      },
    ],
    references: [
      ci("Strings", "strings", "Heap objects and string values in C."),
      ci("Hash Tables", "hash-tables", "Interning and building your own hash table."),
      { title: "JVM Anatomy Quark #23: Compressed References", by: "Aleksey Shipilëv", url: "https://shipilev.net/jvm/anatomy-quarks/23-compressed-references/", kind: "article", note: "How HotSpot fits references in 32 bits." },
    ],
  },

  /* ───────────────────────────── 07 · Functions & frames ───────────────────────────── */
  {
    slug: "functions",
    title: "Functions & Call Frames",
    level: "Intermediate",
    accent: "blue",
    icon: "Layers",
    summary: "Compile each function to its own chunk and add call frames: CALL and RETURN, arguments as local slots, and stack overflow, mirroring invokestatic.",
    tags: ["Function objects", "Call frames", "Calling convention", "Stack overflow"],
    intro: [
      "A JVM thread's stack is a stack of **frames**, one per method call in progress. Each frame has its own locals, its own operand stack and its own program counter. Calling a method pushes a frame, and returning pops it. That's all a call is.",
      "In this lesson Wisp gets the same thing. Each function compiles to its own chunk and becomes a heap object, and the VM keeps a stack of `CallFrame`s. A frame doesn't need its own stack, though. It's just a **window** into the one shared value stack, starting where its arguments were pushed.",
    ],
    sim: "heap-stack",
    simTitle: "Frames on the stack, objects on the heap",
    jvm: {
      title: "What JVM calls teach us",
      points: [
        "`invokestatic` pops the arguments off the caller's operand stack, and they become the callee's local variables 0, 1, 2 and so on. In HotSpot's interpreter they aren't even copied: the callee's local area simply overlaps the caller's stack where the arguments already are.",
        "Each frame records a return address, which is where the caller should resume. Our frame stores the caller's `ip` for the same reason.",
        "Thread stacks have a fixed size (`-Xss`). Infinite recursion fills it and throws `StackOverflowError`, which you can catch.",
        "A method's arity and types are checked when it's linked, not on every call. Wisp is dynamic, so it checks the argument count at the call instead.",
      ],
    },
    concepts: [
      {
        heading: "The calling convention",
        body: [
          "A call compiles to: push the function, push each argument, then `Call(argc)`. When `Call` runs, the stack looks like `[.., fn, arg0, arg1]`. The new frame's `base` is the index of `arg0`, so inside the function, `GetLocal(0)` is the first argument, `GetLocal(1)` the second, and any `let` inside the body continues at slot 2, 3 and so on. No copying is needed.",
          "On `Return`, the VM pops the result, cuts the stack back to just below `fn` (removing the arguments, the locals and the function itself), and pushes the result. The caller sees exactly what any expression leaves behind: one value where the call was.",
        ],
        code: {
          lang: "text",
          caption: "the stack during add(2, 3)",
          code: `                 base
                  v
caller frame:  [ ..., <fn add>, 2, 3 ]        Call(2)
callee window:            slot 0 ^  ^ slot 1
after Return:  [ ..., 5 ]`,
        },
      },
    ],
    build: {
      intro: "The compiler learns to compile nested functions, and the VM learns to switch between frames.",
      milestone: "named functions, recursion and `return`. `fib(25)` runs.",
      steps: [
        {
          title: "A Function object",
          body: "A compiled function is its chunk plus a name (for error messages) and an arity (for checking calls). It lives on the heap so it can be stored in variables and passed around like any other value.",
          code: {
            lang: "rust",
            caption: "src/object.rs (changes)",
            code: `use crate::chunk::Chunk;
use std::rc::Rc;

pub struct Function {
    pub name: String,
    pub arity: u8,    // how many arguments it expects
    pub chunk: Chunk, // its own code, constants and line table
}

pub enum Obj {
    Str(String),
    Table(HashMap<ObjRef, Value>),
    Function(Rc<Function>), // why Rc: see the VM step below
}

// in Heap::show
Obj::Function(f) => format!("<fn {}>", f.name),`,
          },
          explain: [
            "Functions never change after compiling, so sharing them through `Rc` is safe and cheap. It also solves a borrow-checker problem in the VM, explained below.",
          ],
          jvm: "This is the JVM's `Method` structure: bytecode, constant-pool access, `max_locals` and a parameter count, all kept in metaspace. A Wisp function is a value you can pass around, but its compiled body plays the same role as a `Method`.",
        },
        {
          title: "Compile one function at a time, with a stack of compilers",
          body: "While compiling a function body, the compiler needs a fresh chunk and a fresh set of locals, and afterwards it must get the outer ones back. So move those fields into a `FnState` and keep a stack of them. The innermost one is always `self.cur()`.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `/// Everything that's per-function. (These were Compiler's fields in lesson 05.)
struct FnState {
    chunk: Chunk,
    locals: Vec<Local>,
    scope_depth: usize,
}

impl FnState {
    fn new(scope_depth: usize) -> Self {
        FnState { chunk: Chunk::default(), locals: Vec::new(), scope_depth }
    }
    fn resolve_local(&self, name: &str) -> Option<u16> {
        self.locals.iter().rposition(|l| l.name == name).map(|i| i as u16)
    }
}

pub struct Compiler<'h> {
    fns: Vec<FnState>, // innermost function last
    heap: &'h mut Heap,
    line: u32,
}

/// The whole script is compiled as one function, the implicit "main".
pub fn compile(program: &[Stmt], heap: &mut Heap) -> Result<ObjRef, String> {
    let mut c = Compiler { fns: vec![FnState::new(0)], heap, line: 1 };
    for s in program {
        c.stmt(s)?;
    }
    Ok(c.finish("script", 0))
}

impl Compiler<'_> {
    fn cur(&mut self) -> &mut FnState {
        self.fns.last_mut().unwrap()
    }
    fn emit(&mut self, op: Op) -> usize {
        let line = self.line;
        self.cur().chunk.emit(op, line)
    }

    /// Compile a function body into its own chunk.
    fn function(&mut self, name: &str, params: &[String], body: &[Stmt]) -> Result<ObjRef, String> {
        let mut state = FnState::new(1); // depth 1: a function body is never "top level"
        for p in params {
            // arguments are the first locals: slots 0, 1, 2...
            state.locals.push(Local { name: p.clone(), depth: 1 });
        }
        self.fns.push(state);
        for s in body {
            self.stmt(s)?;
        }
        Ok(self.finish(name, params.len() as u8))
    }

    /// End the innermost function: add an implicit \`return nil\` and move it to the heap.
    fn finish(&mut self, name: &str, arity: u8) -> ObjRef {
        self.emit(Op::Nil);
        self.emit(Op::Return);
        let state = self.fns.pop().unwrap(); // back to the enclosing function
        let f = Function { name: name.to_string(), arity, chunk: state.chunk };
        self.heap.alloc(Obj::Function(Rc::new(f)))
    }
}`,
          },
          explain: [
            "Every `self.chunk` in the lesson 05 code becomes `self.cur().chunk`, and the same goes for `locals` and `scope_depth`. It's a mechanical change: the compiler now always writes into the innermost function.",
            "The implicit `Nil, Return` at the end means a function that falls off its end returns `nil`. If the body already returned, those two instructions are simply never reached.",
            "The top-level script is also a function, named `script`. Treating it like any other function means the VM needs no special case for the outermost code.",
          ],
        },
        {
          title: "Compile declarations, calls and return",
          body: "A `fn` declaration compiles its body into a new function object, puts that object in the constant pool, and then stores it in a variable like any other value.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (new arms)",
            code: `// in stmt()
Stmt::Fn(name, params, body) => {
    let depth = self.cur().scope_depth;
    if depth > 0 {
        // a local function: claim its slot before compiling the body, so the
        // value pushed below lands in exactly that slot
        self.cur().locals.push(Local { name: name.clone(), depth });
    }
    let f = self.function(name, params, body)?;
    let k = self.cur().chunk.add_const(Value::Obj(f));
    self.emit(Op::Const(k)); // push the function value (lesson 08 changes this to Op::Closure)
    if depth == 0 {
        let n = self.cur().chunk.add_name(name);
        self.emit(Op::DefineGlobal(n));
    }
}
Stmt::Return(value) => {
    match value {
        Some(e) => self.expr(e)?,
        None => { self.emit(Op::Nil); }
    }
    self.emit(Op::Return);
}

// in expr()
Expr::Call(callee, args, line) => {
    self.expr(callee)?;            // [.., f]
    for a in args {
        self.expr(a)?;             // [.., f, a0, a1, ...]
    }
    self.line = *line;
    self.emit(Op::Call(args.len() as u8));
}

// and one new instruction in chunk.rs
Call(u8), // operand = argument count            invokestatic / invokevirtual`,
          },
          explain: [
            "Functions are constants, like numbers. The compiled body of `fib` sits in the script chunk's constant pool, and `Const(k)` pushes it at runtime.",
            "Global functions can call themselves recursively for free: by the time `fib` runs, `DefineGlobal` has stored it, so the `GetGlobal(\"fib\")` inside its body finds it.",
          ],
        },
        {
          title: "Call frames in the VM",
          body: "The VM keeps a `Vec<CallFrame>`. The current frame's `func`, `ip` and `base` are copied into local variables, because they're used on every instruction. `Call` and `Return` are the only places that switch them.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `struct CallFrame {
    func: Rc<Function>, // the function running in this frame
    ip: usize,          // where to resume (saved when this frame makes a call)
    base: usize,        // stack index of this frame's slot 0 (its first argument)
}

pub struct Vm {
    stack: Vec<Value>,
    frames: Vec<CallFrame>,
    globals: HashMap<String, Value>,
    pub heap: Heap,
}

impl Vm {
    pub fn run(&mut self, script: ObjRef) -> Result<(), String> {
        let Obj::Function(f) = self.heap.get(script) else { unreachable!() };
        // The "hot" state of the current frame, kept in locals for speed.
        // Cloning the Rc means reading func.chunk doesn't borrow self.
        let mut func = f.clone();
        let mut ip = 0;
        let mut base = 0;
        self.frames.push(CallFrame { func: func.clone(), ip, base });

        loop {
            let op = func.chunk.code[ip];
            ip += 1;
            match op {
                // locals are now relative to the frame's base
                Op::GetLocal(slot) => self.push(self.stack[base + slot as usize]),
                Op::SetLocal(slot) => self.stack[base + slot as usize] = self.peek(0),

                Op::Call(argc) => {
                    let argc = argc as usize;
                    // the stack is [.., callee, arg0 .. argN]: the callee sits below its args
                    let Value::Obj(r) = self.peek(argc) else {
                        return Err(self.error(&func.chunk, ip, "can only call functions"));
                    };
                    let Obj::Function(callee) = self.heap.get(r) else {
                        return Err(self.error(&func.chunk, ip, "can only call functions"));
                    };
                    if callee.arity as usize != argc {
                        let msg = format!("{}() takes {} arguments but got {argc}", callee.name, callee.arity);
                        return Err(self.error(&func.chunk, ip, &msg));
                    }
                    if self.frames.len() == 1024 {
                        return Err(self.error(&func.chunk, ip, "stack overflow"));
                    }
                    let callee = callee.clone();
                    // 1. remember where the caller resumes
                    self.frames.last_mut().unwrap().ip = ip;
                    // 2. switch the hot state to the callee
                    func = callee;
                    ip = 0;
                    base = self.stack.len() - argc; // the args already sit in slots 0..argc
                    self.frames.push(CallFrame { func: func.clone(), ip, base });
                }

                Op::Return => {
                    let result = self.pop();
                    self.frames.pop();
                    if self.frames.is_empty() {
                        return Ok(()); // the script itself has finished
                    }
                    // drop the callee's locals and args, *and* the callee value just below them
                    self.stack.truncate(base - 1);
                    self.push(result);
                    // switch the hot state back to the caller
                    let caller = self.frames.last().unwrap();
                    func = caller.func.clone();
                    ip = caller.ip;
                    base = caller.base;
                }

                // ...every other arm as before, with \`chunk\` replaced by \`func.chunk\`
            }
        }
    }
}`,
          },
          explain: [
            "**Why `Rc`?** If `func` were a reference into `self.heap`, the borrow checker wouldn't let any instruction mutate `self` (pushing to the stack, allocating) while that reference exists. Cloning an `Rc` gives the loop its own handle to the function. It costs one counter increment per call.",
            "`base = stack.len() - argc` is the whole calling convention. The arguments are already in place, so slot 0 is the first argument. Nothing is copied.",
            "`truncate(base - 1)` removes everything from the callee value upward. The caller is left exactly as if the call expression had pushed one value: the result.",
            "The frame limit turns infinite recursion into a Wisp error instead of the Rust process running out of memory. 1024 is arbitrary, so pick any limit.",
            "Writing `ip` back into the frame happens only on `Call`. While a function runs, its `ip` lives only in the local variable, which is the HotSpot trick from lesson 04 again.",
          ],
          jvm: "HotSpot does the same switch: on `invokestatic` it saves the bytecode pointer in the current frame, builds the new frame with its locals over the arguments, and jumps to the callee's first bytecode. On `ireturn` it pops the frame, pushes the result onto the caller's operand stack, and reloads the caller's saved bytecode pointer.",
        },
        {
          title: "Try it",
          body: "Update `main.rs` so `compile` returns the script function and `vm.run(script)` runs it. Recursion now works.",
          code: {
            lang: "wisp",
            caption: "fib.wisp",
            code: `fn fib(n) {
  if n < 2 { return n }
  return fib(n - 1) + fib(n - 2)
}
print fib(25)

fn forever(n) { return forever(n + 1) }
forever(0)`,
          },
          output: `75025
[line 7] runtime error: stack overflow`,
          explain: [
            "`fib(25)` makes about 250,000 calls. Time it with `--release` and keep the number. It's your benchmark for the performance lesson.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why one shared stack instead of a separate stack per call?",
        intuition: "Arguments are already on the caller's stack, so letting the callee use them right where they are means no copying. A frame is just a bookmark into the shared stack.",
        technical:
          "With per-frame stacks, every call would allocate and copy the arguments. The shared stack makes calls cost one push to `frames` plus a few integer updates. It does mean nothing may hold a Rust reference into `stack` across a call, because it might reallocate. Indices (`base + slot`) avoid that problem completely.",
      },
      {
        q: "Where do local variables go when a function returns?",
        intuition: "They're simply cut off the end of the stack. Nothing needs to clean them up, because they were never on the heap.",
        technical:
          "`truncate(base - 1)` drops them in a single operation. This is why stack allocation is so cheap, in the JVM too: locals never need garbage collection. The exception is a local captured by a closure, which has to outlive the frame. That's the next lesson.",
      },
      {
        q: "Why check the argument count at runtime?",
        intuition: "Wisp doesn't know which function a variable holds until the call happens, so it can't check earlier.",
        technical:
          "The JVM checks method descriptors when it links the call, because Java's types make the target known up front. In Wisp, `f(1, 2)` could call anything. You could also choose JavaScript's lenient rule: missing arguments become `nil` and extras are dropped. Either works, as long as the frame layout stays consistent.",
      },
    ],
    references: [
      ci("Calls and Functions", "calls-and-functions"),
      { title: "JVM Specification: Frames", by: "Oracle", url: "https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html#jvms-2.6", kind: "spec", note: "§2.6: local variables, operand stacks, and how invocation creates frames." },
    ],
  },

  /* ───────────────────────────── 08 · Closures ───────────────────────────── */
  {
    slug: "closures",
    title: "Closures & Upvalues",
    level: "Intermediate",
    accent: "violet",
    icon: "FunctionSquare",
    summary: "Let functions capture variables from enclosing functions using upvalues, which start on the stack and move to the heap when they outlive their frame. Compared with Java lambdas.",
    tags: ["Lexical scope", "Upvalues", "Open vs closed", "Java lambdas"],
    intro: [
      "A closure is a function plus the variables it captured from where it was written. The problem is timing. A captured local lives in its function's stack frame, but the closure might be called long after that frame is gone.",
      "Java avoids the problem by only allowing lambdas to capture **effectively final** variables and copying their values into the lambda. Wisp allows full mutable capture, using the technique from Lua: **upvalues**. An upvalue points at the variable's stack slot while the frame is alive, and when the slot is about to disappear, the value moves to the heap. Every closure sharing that upvalue sees the move.",
    ],
    sim: "upvalues",
    simTitle: "Open upvalues close when the frame returns",
    jvm: {
      title: "What Java lambdas teach us",
      points: [
        "A Java lambda that uses a local gets a **copy** of its value, stored in a field of the lambda object. That's why the local must be effectively final: a copy can't stay in sync with a changing variable.",
        "To share mutable state, Java programmers wrap it themselves, in an `AtomicInteger` or a one-element array. An upvalue is exactly that wrapper, created automatically.",
        "Lambdas compile to `invokedynamic`. On first use, the JVM generates a small class whose fields hold the captured values. A Wisp closure is the same idea: a function plus an array of captures.",
        "Anonymous inner classes captured the enclosing `this` implicitly, which caused memory leaks. A closure keeps alive everything it captures, so capture only what you use.",
      ],
    },
    concepts: [
      {
        heading: "Open and closed upvalues",
        body: [
          "When a closure is created, each captured variable gets an `Upvalue` object. At first it's **open**: it stores the variable's absolute stack index, so reads and writes go straight to the live slot. Two closures that capture the same variable share the same upvalue object.",
          "When that slot is about to be popped, because the block ends or the function returns, the VM **closes** the upvalue by copying the current value into the upvalue object itself. From then on, every closure that shares it reads and writes the heap copy. Nothing else changes, because they all go through the same upvalue.",
        ],
        code: {
          lang: "text",
          caption: "make_counter() returns: the upvalue closes",
          code: `while make_counter runs:   stack [.., count=0]  <-- Upvalue::Open(slot 7)
after it returns:          stack [..]           Upvalue::Closed(0) on the heap
next() calls later:        count = count + 1  -> Upvalue::Closed(1)`,
        },
      },
      {
        heading: "Resolving a captured name at compile time",
        body: [
          "When the compiler sees a name that isn't a local of the current function, it asks the enclosing function. If it's a local there, the variable is captured directly and that local is marked as captured. If it isn't, the compiler asks the next function out, recursively, and each level in between gets an upvalue that forwards it. At runtime every closure has a flat array of upvalues and never searches by name.",
        ],
      },
    ],
    build: {
      intro: "Three new heap types (`Closure`, `Upvalue`, and a capture list on `Function`), four instructions, and a small recursive search in the compiler.",
      milestone: "functions that capture and mutate outer variables: counters, callbacks, and anonymous `fn` expressions.",
      steps: [
        {
          title: "Closure and Upvalue objects",
          body: "At runtime a closure is its function plus one upvalue reference per captured variable. The function records, for each capture, where to get it from.",
          code: {
            lang: "rust",
            caption: "src/object.rs (changes)",
            code: `pub struct Function {
    pub name: String,
    pub arity: u8,
    pub chunk: Chunk,
    /// One entry per captured variable: (is_local, index).
    /// is_local = true:  capture the enclosing frame's local slot \`index\`
    /// is_local = false: reuse the enclosing closure's upvalue number \`index\`
    pub upvalues: Vec<(bool, u16)>,
}

/// A function value at runtime: the code plus what it captured.
pub struct Closure {
    pub func: Rc<Function>,
    pub upvalues: Vec<ObjRef>, // each points to an Obj::Upvalue
}

#[derive(Clone, Copy)]
pub enum Upvalue {
    Open(usize),   // the variable is still on the stack, at this absolute index
    Closed(Value), // the frame is gone: the value now lives here
}

pub enum Obj {
    Str(String),
    Table(HashMap<ObjRef, Value>),
    Function(Rc<Function>),
    Closure(Closure),
    Upvalue(Upvalue),
}`,
          },
          explain: [
            "`Function` is still the compiled, shareable code. `Closure` is the runtime value you call. One function can have many closures: each call to `make_counter` creates a new closure with its own `count`.",
            "Upvalues are separate heap objects, not fields inside the closure, so that several closures can share one. That sharing is what makes two closures over the same variable see each other's writes.",
          ],
        },
        {
          title: "Find captured variables in the compiler",
          body: "Each `FnState` gets a list of the upvalues it needs, and each `Local` gets a `captured` flag. Variable access now checks three places in order: a local, then an upvalue, then a global.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `struct Local { name: String, depth: usize, captured: bool }
// FnState gains:  upvalues: Vec<(bool, u16)>

impl Compiler<'_> {
    /// Is \`name\` a variable of an enclosing function? Search outward from fns[level].
    fn resolve_upvalue(&mut self, level: usize, name: &str) -> Option<u16> {
        if level == 0 {
            return None; // the script has no enclosing function, so it must be a global
        }
        let parent = level - 1;
        // Case 1: a local of the directly enclosing function. Capture its slot.
        if let Some(slot) = self.fns[parent].resolve_local(name) {
            self.fns[parent].locals[slot as usize].captured = true;
            return Some(self.add_upvalue(level, true, slot));
        }
        // Case 2: further out. Make the parent capture it first, then capture
        // the parent's upvalue. This recursion threads it through every level.
        let index = self.resolve_upvalue(parent, name)?;
        Some(self.add_upvalue(level, false, index))
    }

    fn add_upvalue(&mut self, level: usize, is_local: bool, index: u16) -> u16 {
        let ups = &mut self.fns[level].upvalues;
        if let Some(i) = ups.iter().position(|u| *u == (is_local, index)) {
            return i as u16; // already captured: reuse it
        }
        ups.push((is_local, index));
        (ups.len() - 1) as u16
    }

    /// Emit the right "get" for a name: local, then upvalue, then global.
    fn get_var(&mut self, name: &str) {
        let level = self.fns.len() - 1;
        if let Some(slot) = self.fns[level].resolve_local(name) {
            self.emit(Op::GetLocal(slot));
        } else if let Some(i) = self.resolve_upvalue(level, name) {
            self.emit(Op::GetUpvalue(i));
        } else {
            let k = self.cur().chunk.add_name(name);
            self.emit(Op::GetGlobal(k));
        }
    }
    // set_var() is identical, with SetLocal / SetUpvalue / SetGlobal.
    // Expr::Var calls get_var(name); Expr::Assign calls set_var(name).
}`,
          },
          explain: [
            "Take `fn outer() { let x = 1  fn mid() { fn inner() { print x } } }`. While compiling `inner`, `x` isn't local, so the compiler asks `mid`. It isn't local there either, so it asks `outer`, where it is: slot 0. So `mid` gets upvalue `(true, 0)`, and `inner` gets `(false, 0)`, meaning \"my parent's upvalue 0\".",
            "Marking the local as `captured` tells the compiler that when this local's scope ends, it must emit `CloseUpvalue` instead of `Pop`.",
            "Globals are never captured. They live in the globals table for the whole run, so any function can reach them by name.",
          ],
        },
        {
          title: "Emit closures and close captured locals",
          body: "Function values are now created by `Closure(k)` instead of `Const(k)`, and scope exits close captured slots.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `// in finish(): keep the upvalue list on the Function
let f = Function { name: name.to_string(), arity, chunk: state.chunk, upvalues: state.upvalues };

// in Stmt::Fn: replace Op::Const(k) with
self.emit(Op::Closure(k));

// anonymous functions: fn(x) { ... } used as an expression
Expr::Lambda(params, body) => {
    let f = self.function("anonymous", params, body)?;
    let k = self.cur().chunk.add_const(Value::Obj(f));
    self.emit(Op::Closure(k));
}

// in block(): on scope exit, captured locals are closed instead of just popped
loop {
    let state = self.cur();
    let Some(local) = state.locals.last() else { break };
    if local.depth <= state.scope_depth { break; }
    let captured = local.captured;
    state.locals.pop();
    self.emit(if captured { Op::CloseUpvalue } else { Op::Pop });
}

// four new instructions in chunk.rs
Closure(u16),      // operand = function constant: build a closure and push it
GetUpvalue(u16),   // push the value of the current closure's upvalue i
SetUpvalue(u16),   // write it (the value stays on the stack, like SetLocal)
CloseUpvalue,      // move the top slot to the heap, then pop it`,
          },
          explain: [
            "Function returns don't need a `CloseUpvalue` for each local. The VM closes everything above the frame's `base` in one go when it executes `Return`.",
          ],
        },
        {
          title: "Run closures in the VM",
          body: "Frames now run closures. The VM keeps a list of open upvalues, so capturing the same slot twice returns the same upvalue, and closing finds them quickly.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `struct CallFrame {
    closure: ObjRef,    // the Closure being run (needed to find its upvalues)
    func: Rc<Function>, // closure.func, cached
    ip: usize,
    base: usize,
}
// Vm gains:  open_upvalues: Vec<ObjRef>
// run() keeps \`closure\` as a 4th hot local next to func, ip and base.
// Call now expects Obj::Closure(c) and uses c.func; Return restores closure too.

Op::Closure(k) => {
    let Value::Obj(r) = func.chunk.consts[k as usize] else { unreachable!() };
    let Obj::Function(f) = self.heap.get(r) else { unreachable!() };
    let f = f.clone();
    let mut upvalues = Vec::with_capacity(f.upvalues.len());
    for &(is_local, index) in &f.upvalues {
        upvalues.push(if is_local {
            self.capture(base + index as usize)       // a local of the frame running right now
        } else {
            self.upvalue_of(closure, index)           // something our own closure already captured
        });
    }
    let c = self.heap.alloc(Obj::Closure(Closure { func: f, upvalues }));
    self.push(Value::Obj(c));
}

Op::GetUpvalue(i) => {
    let up = self.upvalue_of(closure, i);
    let v = match self.heap.get(up) {
        Obj::Upvalue(Upvalue::Open(slot)) => self.stack[*slot], // still on the stack
        Obj::Upvalue(Upvalue::Closed(v)) => *v,                 // moved to the heap
        _ => unreachable!(),
    };
    self.push(v);
}
Op::SetUpvalue(i) => {
    let up = self.upvalue_of(closure, i);
    let v = self.peek(0);
    match self.heap.get_mut(up) {
        Obj::Upvalue(Upvalue::Open(slot)) => { let s = *slot; self.stack[s] = v; }
        Obj::Upvalue(Upvalue::Closed(c)) => *c = v,
        _ => unreachable!(),
    }
}
Op::CloseUpvalue => {
    self.close_upvalues(self.stack.len() - 1); // just the top slot
    self.pop();
}
// and in Op::Return, before truncating the stack:
//     self.close_upvalues(base);

// ── helpers ──
fn upvalue_of(&self, closure: ObjRef, i: u16) -> ObjRef {
    let Obj::Closure(c) = self.heap.get(closure) else { unreachable!() };
    c.upvalues[i as usize]
}

/// Capture a stack slot, reusing an open upvalue for it if one exists.
fn capture(&mut self, slot: usize) -> ObjRef {
    for &r in &self.open_upvalues {
        if let Obj::Upvalue(Upvalue::Open(s)) = self.heap.get(r) {
            if *s == slot {
                return r; // shared: both closures will see each other's writes
            }
        }
    }
    let r = self.heap.alloc(Obj::Upvalue(Upvalue::Open(slot)));
    self.open_upvalues.push(r);
    r
}

/// Close every open upvalue pointing at \`from\` or above: copy the value off the stack.
fn close_upvalues(&mut self, from: usize) {
    let stack = &self.stack;
    let heap = &mut self.heap;
    self.open_upvalues.retain(|&r| {
        let Obj::Upvalue(up) = heap.get_mut(r) else { unreachable!() };
        match *up {
            Upvalue::Open(slot) if slot >= from => {
                *up = Upvalue::Closed(stack[slot]); // the value moves to the heap
                false                               // and it's no longer open
            }
            _ => true,
        }
    });
}`,
          },
          explain: [
            "`is_local` captures use `base + index`, meaning the slot in the frame that is **creating** the closure, which is the enclosing function of the closure being built. That's why the compiler recorded the *parent's* slot number.",
            "`close_upvalues` borrows `stack` and `heap` as separate fields, so it can read one and write the other inside `retain`. Borrowing `self` as a whole would be rejected.",
            "Reads and writes check `Open` or `Closed` every time. A closure doesn't need to know whether its variable's frame is still alive, because the upvalue handles both cases.",
            "The top-level script now runs as a closure too: wrap the script function in `Closure { func, upvalues: vec![] }` before pushing the first frame.",
          ],
          jvm: "The JVM never needs this, because captured values are immutable copies, so there's nothing to keep in sync. The cost of Java's simpler model is the language restriction: no `count++` inside a lambda. Kotlin lifts that restriction by quietly boxing captured `var`s in a `Ref` object, which is a closed upvalue from day one.",
        },
        {
          title: "Try it",
          body: "Each call to `make_counter` creates a new `count`, and two closures created by the same call share one.",
          code: {
            lang: "wisp",
            caption: "closures.wisp",
            code: `fn make_counter() {
  let count = 0
  return fn() {
    count = count + 1
    return count
  }
}
let a = make_counter()
let b = make_counter()
a()
a()
print a()
print b()

fn pair() {
  let n = 0
  let inc = fn() { n = n + 10 }
  let get = fn() { return n }
  inc()
  inc()
  return get
}
print pair()()`,
          },
          output: `3
1
20`,
          explain: [
            "`a` and `b` have separate counters because each `make_counter` call had its own `count` slot, so each one got its own upvalue.",
            "In `pair`, `inc` and `get` captured the same slot while `pair` was still running, so `capture` returned the same upvalue to both. When `pair` returned, it closed with the value `20`, and `get` still reads it.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why not just copy captured values, like Java does?",
        intuition: "Because then `count = count + 1` inside the closure would change the closure's copy, not the variable the rest of the function sees. Counters and callbacks that update shared state wouldn't work.",
        technical:
          "Copying is correct only for variables that never change after capture, which is exactly Java's effectively-final rule. Upvalues give you shared mutable capture for the price of one indirection per access. A nice optimization: if the compiler can see a captured variable is never assigned after capture, it could copy it instead.",
      },
      {
        q: "Why not put every local variable on the heap? It would be simpler.",
        intuition: "Most locals are never captured, and stack slots are much cheaper. You'd pay the heap cost on every variable just to support the few that need it.",
        technical:
          "Heap-allocating every local means an allocation per variable per call, plus garbage-collector work later. Upvalues pay only for captured variables, and only after their frame ends. JVM JITs go further with **escape analysis**: they prove an object never leaves its method and keep it in registers.",
      },
      {
        q: "How would I see the upvalues the compiler created?",
        intuition: "Teach the disassembler to print a function's capture list next to each `Closure` instruction.",
        technical:
          "For `Op::Closure(k)`, look up the function constant and print each `(is_local, index)` pair as `local 2` or `upvalue 0`. It's the most useful debugging aid for closure bugs, and it's what `javap -p` does for the synthetic fields of a lambda class.",
      },
    ],
    references: [
      ci("Closures", "closures", "The upvalue technique in full detail, with excellent diagrams."),
      { title: "The Implementation of Lua 5.0", by: "Ierusalimschy, de Figueiredo, Celes", url: "https://www.lua.org/doc/jucs05.pdf", kind: "article", note: "The paper that introduced this upvalue design, plus Lua's register VM." },
    ],
  },

  /* ───────────────────────────── 09 · Garbage collection ───────────────────────────── */
  {
    slug: "gc",
    title: "Garbage Collection",
    level: "Intermediate",
    accent: "emerald",
    icon: "Recycle",
    summary: "Free unreachable heap objects with a mark-and-sweep collector: roots, tracing, sweeping and a growing threshold, the same core idea behind every JVM collector.",
    tags: ["Roots", "Mark & sweep", "Tri-color", "Heap growth"],
    intro: [
      "Right now the heap only grows. Every string join and every table stays forever, even when no variable refers to it anymore. A garbage collector finds the objects the program can no longer reach and frees them.",
      "Every JVM collector, from Serial to G1 to ZGC, is built on the same core idea: start from the **roots** (the values the program can touch directly), follow every reference, and anything you never reached is garbage. You'll build the simplest correct version: stop the program, mark, sweep, continue.",
    ],
    sim: "gc",
    simTitle: "Mark from the roots, sweep the rest",
    jvm: {
      title: "What the JVM collectors teach us",
      points: [
        "GC **roots** are thread stacks (locals and operand stacks), static fields, JNI handles and a few VM internals. Anything not reachable from them is garbage, including cycles. That's why reference counting isn't enough.",
        "The **generational hypothesis** says most objects die young. The JVM splits the heap into a young generation (collected often and cheaply) and an old generation (collected rarely).",
        "Collectors need the program paused at a known point to read roots safely, a **safepoint**. Our VM collects only at allocation points, which is a simple way to get the same guarantee.",
        "Heap sizing is a trade-off between memory and time: `-Xmx`, plus how full the heap gets before collecting. We'll grow the threshold with the live data, the simplest adaptive policy.",
      ],
    },
    concepts: [
      {
        heading: "Mark and sweep in two sentences",
        body: [
          "**Mark**: put every root on a to-do list (the *gray* set). Repeatedly take an object off the list, mark it (*black*), and add everything it references that isn't marked yet. **Sweep**: walk the whole heap. Anything still unmarked (*white*) is unreachable, so free it. Then clear the marks for next time.",
          "Using an explicit to-do list instead of recursion matters: a long linked list would otherwise overflow the Rust stack while marking.",
        ],
      },
      {
        heading: "When is it safe to collect?",
        body: [
          "Only when every live reference is somewhere the collector can see: on the VM stack, in globals, in frames, or in other objects. A reference held only in a Rust local variable is invisible to the GC, so if a collection happens at that moment, the object gets freed while still in use.",
          "The simple rule that avoids this: **collect only at the start of instructions that allocate, before popping their operands.** At that moment every live value is on the stack or reachable from it.",
        ],
      },
    ],
    build: {
      intro: "The heap gains mark bits, a free list and a threshold. The VM gains `collect()`, which gathers roots and asks the heap to mark and sweep.",
      milestone: "long-running loops that allocate run in constant memory, and `--gc-log` shows each collection.",
      steps: [
        {
          title: "Mark bits, a free list and a threshold",
          body: "Freed slots go on a free list, so `alloc` can reuse them. `live` counts objects, and `next_gc` says when to collect next.",
          code: {
            lang: "rust",
            caption: "src/object.rs (Heap changes)",
            code: `#[derive(Default)]
pub struct Heap {
    objects: Vec<Option<Obj>>,
    strings: HashMap<String, ObjRef>,
    marks: Vec<bool>,   // marks[i]: was objects[i] reached in this collection?
    free: Vec<u32>,     // indexes of freed slots, ready to reuse
    pub live: usize,    // how many objects exist right now
    pub next_gc: usize, // collect when live reaches this
}

impl Heap {
    pub fn new() -> Self {
        Heap { next_gc: 1024, ..Default::default() }
    }

    pub fn should_collect(&self) -> bool {
        self.live >= self.next_gc
    }

    pub fn alloc(&mut self, obj: Obj) -> ObjRef {
        self.live += 1;
        if let Some(i) = self.free.pop() {
            self.objects[i as usize] = Some(obj); // reuse a freed slot
            return ObjRef(i);
        }
        self.objects.push(Some(obj));
        self.marks.push(false);
        ObjRef(self.objects.len() as u32 - 1)
    }
}`,
          },
          explain: [
            "Reusing slots keeps `ObjRef`s small and the `Vec` from growing without limit. A freed index is only ever reused for a new object, and nothing reachable still points at the old one, which is exactly what the collector just proved.",
            "Use `Heap::new()` instead of `Heap::default()` in `Vm::new`, so the first collection waits for 1024 objects.",
          ],
        },
        {
          title: "Mark: follow every reference",
          body: "`mark` takes the roots as its starting to-do list. For each object it marks, it adds the object's children. This is the only place that needs to know what each kind of object contains.",
          code: {
            lang: "rust",
            caption: "src/object.rs (continued)",
            code: `impl Heap {
    pub fn mark(&mut self, mut gray: Vec<ObjRef>) {
        while let Some(r) = gray.pop() {
            let i = r.0 as usize;
            if self.marks[i] {
                continue; // already done: this is what stops cycles looping forever
            }
            self.marks[i] = true;
            // add everything this object references
            match self.objects[i].as_ref().unwrap() {
                Obj::Str(_) => {} // strings reference nothing
                Obj::Table(fields) => {
                    for (key, value) in fields {
                        gray.push(*key);
                        push_value(&mut gray, *value);
                    }
                }
                Obj::Function(f) => push_consts(&mut gray, &f.chunk),
                Obj::Closure(c) => {
                    push_consts(&mut gray, &c.func.chunk); // its code's constants
                    gray.extend(&c.upvalues);              // and what it captured
                }
                Obj::Upvalue(Upvalue::Closed(v)) => push_value(&mut gray, *v),
                Obj::Upvalue(Upvalue::Open(_)) => {} // its value is on the stack, already a root
            }
        }
    }
}

fn push_value(gray: &mut Vec<ObjRef>, v: Value) {
    if let Value::Obj(r) = v {
        gray.push(r);
    }
}

fn push_consts(gray: &mut Vec<ObjRef>, chunk: &Chunk) {
    for &v in &chunk.consts {
        push_value(gray, v); // strings, field names and nested functions
    }
}`,
          },
          explain: [
            "Marked objects are \"black\", the ones on the `gray` list are \"gray\", and everything else is \"white\". When the list is empty, every reachable object is black.",
            "A function's constant pool is a source of references. Without `push_consts`, the string `\"hello\"` from a literal would be freed while the code that uses it is still running.",
            "If you add a new kind of `Obj` later, the `match` stops compiling until you say what it references. That's the GC equivalent of the interpreter's exhaustive `match`.",
          ],
        },
        {
          title: "Sweep: free what wasn't marked",
          body: "Walk every slot. Clear the marks on survivors, and free the rest. Freed strings must also leave the intern table.",
          code: {
            lang: "rust",
            caption: "src/object.rs (continued)",
            code: `impl Heap {
    pub fn sweep(&mut self) {
        for i in 0..self.objects.len() {
            if self.marks[i] {
                self.marks[i] = false; // a survivor: reset it for the next collection
                continue;
            }
            if let Some(obj) = self.objects[i].take() { // unreachable: free it
                if let Obj::Str(s) = obj {
                    self.strings.remove(&s); // don't let the intern table hand it out again
                }
                self.free.push(i as u32);
                self.live -= 1;
            }
        }
        // collect again once the heap has doubled since this collection
        self.next_gc = (self.live * 2).max(1024);
    }
}`,
          },
          explain: [
            "The intern table must not keep strings alive, or no string would ever be freed. It holds **weak** references: the sweep removes dead entries instead of the table acting as a root.",
            "Doubling the threshold means a program with lots of live data collects less often, so the total GC time stays roughly proportional to the work the program does. Without growth, a program with 1,000 live objects would collect on almost every allocation.",
          ],
          jvm: "Java has weak references too: `WeakHashMap`, and the JVM's own string table, which drops interned strings that nothing references anymore. The idea is the same: an index or cache must not keep its contents alive.",
        },
        {
          title: "Roots and triggering, in the VM",
          body: "The VM knows where the roots are, so `collect` lives on the VM. `maybe_gc` runs at the top of every instruction that allocates.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    fn collect(&mut self) {
        let before = self.heap.live;
        let mut roots = Vec::new();
        // 1. ROOTS: every value the program can reach without following a reference
        for v in self.stack.iter().chain(self.globals.values()) {
            if let Value::Obj(r) = v {
                roots.push(*r);
            }
        }
        for frame in &self.frames {
            roots.push(frame.closure); // running code, and through it its constants
        }
        roots.extend(&self.open_upvalues);
        // 2. MARK everything reachable  3. SWEEP the rest
        self.heap.mark(roots);
        self.heap.sweep();
        if self.gc_log {
            eprintln!("[gc] {before} -> {} objects, next at {}", self.heap.live, self.heap.next_gc);
        }
    }

    /// Call at the start of any instruction that allocates, *before* popping operands.
    fn maybe_gc(&mut self) {
        if self.stress_gc || self.heap.should_collect() {
            self.collect();
        }
    }
}

// in run(): the first line of Op::Add, Op::NewTable and Op::Closure
self.maybe_gc();`,
          },
          explain: [
            "Why before popping? In `Add`, the two strings being joined are still on the stack, so they're roots. If the collection ran after popping them, they'd be unreachable, get freed, and then be read. That's the classic GC bug.",
            "`stress_gc` collects on **every** allocation. Run your test scripts with it on. If a root is missing, it fails immediately on a simple test instead of rarely and mysteriously on a big one.",
            "The compiler allocates too (interned strings, function objects), but never collects: the GC only runs from `maybe_gc` in the VM. By the time the script runs, everything the compiler made is reachable through the script's constants.",
          ],
          jvm: "HotSpot finds roots in frames using **stack maps**, compiler-generated tables saying which slots hold references at each safepoint. Our stack holds tagged `Value`s, so the GC can just check each tag. That's simpler but uses more memory per slot.",
        },
        {
          title: "Watch it work",
          body: "This loop creates 100,000 tables but never keeps more than one, so memory stays flat.",
          code: {
            lang: "wisp",
            caption: "churn.wisp (run with --gc-log)",
            code: `let i = 0
while i < 100000 {
  let t = { n: i }
  i = i + 1
}
print "done"`,
          },
          output: `[gc] 1024 -> 5 objects, next at 1024
[gc] 1024 -> 5 objects, next at 1024
... about 100 collections like these ...
done`,
          explain: [
            "Each table is garbage as soon as the loop body's block ends. The few survivors are the script's function and closure and the interned strings `\"n\"` and `\"done\"`. Your exact numbers may differ slightly.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why not use Rust's `Rc` for everything and skip writing a GC?",
        intuition: "Reference counting can't free cycles. Two tables that point at each other keep each other's count above zero forever, even when nothing else can reach them.",
        technical:
          "Cycles are common in a language with closures and mutable objects: an object holding a closure that captured the object. `Rc` would leak them. A tracing collector handles cycles naturally because it asks \"is this reachable?\", not \"is anyone pointing at it?\". The JVM has never used reference counting for this reason.",
      },
      {
        q: "The program pauses while the GC runs. How do Java collectors avoid long pauses?",
        intuition: "By doing most of the work while the program keeps running, and only pausing briefly to agree on where things are.",
        technical:
          "G1 splits the heap into regions and collects a few at a time within a pause-time goal. ZGC and Shenandoah mark and move objects concurrently with the program, using read barriers (small checks on every reference load) to keep things consistent, with pauses well under a millisecond. All of that is built on the mark phase you just wrote.",
      },
      {
        q: "What is a generational collector, and would it help Wisp?",
        intuition: "Most objects die young, like the tables in that loop. Checking the young ones often and the old ones rarely means each collection looks at far fewer objects.",
        technical:
          "New objects go into a small nursery. A minor collection copies the nursery's survivors to the old space and resets the nursery in one step. It also needs a **write barrier**: when an old object starts pointing at a young one, record it, so minor collections can treat it as a root. It's a substantial project, and a great follow-up once mark-sweep is solid.",
      },
    ],
    references: [
      ci("Garbage Collection", "garbage-collection", "Mark-sweep in C, including the classic bugs and how stress mode catches them."),
      { title: "HotSpot Garbage Collection Tuning Guide", by: "Oracle", url: "https://docs.oracle.com/en/java/javase/21/gctuning/", kind: "spec", note: "How the JVM's generations and collectors are organized." },
    ],
  },

  /* ───────────────────────────── 10 · Modules ───────────────────────────── */
  {
    slug: "module-loading",
    title: "Modules & Loading",
    level: "Intermediate",
    accent: "cyan",
    icon: "Package",
    summary: "Add `import`: find a file, compile it, run it exactly once, and expose its globals as a table. A small version of the JVM's load, link and initialize.",
    tags: ["Load · link · init", "Re-entrant VM", "Module cache", "Isolation"],
    intro: [
      "The JVM doesn't load your whole program at startup. It loads each class the first time it's needed. A class loader finds the bytes, the VM links them (verifies, prepares, resolves), and then initializes the class by running its static initializer exactly once.",
      "Wisp gets the same lifecycle with one expression, `import \"name\"`. It finds `name.wisp`, compiles it, runs it once with its own globals, and returns those globals as a table. Doing that requires one important change to the VM: it must be able to run Wisp code from *inside* an instruction, which means the interpreter becomes **re-entrant**.",
    ],
    sim: "modules",
    simTitle: "Load, link and initialize, once",
    jvm: {
      title: "What class loading teaches us",
      points: [
        "**Loading** finds a class's bytes (from a JAR, the filesystem, the network...) by its name. Class loaders delegate to their parent first, so `java.lang.String` always comes from the JDK.",
        "**Linking** verifies the bytecode, prepares static fields with default values, and resolves symbolic references, either eagerly or lazily on first use.",
        "**Initialization** runs `<clinit>`, the class's static initializer, exactly once, even when several threads race to use the class. Every later use skips straight to the initialized class.",
        "A class is identified by its name **plus** its loader. Two loaders can load two different `com.app.Config` classes side by side, which is how app servers isolate applications.",
      ],
    },
    concepts: [
      {
        heading: "Why the VM needs to be re-entrant",
        body: [
          "Until now, `run` was the only loop and it owned the whole program. An import happens in the middle of an instruction, and the module body has to run to completion before that instruction can push its result. So the `Import` handler calls back into the interpreter, a nested `run` on the same VM, which must stop when the module's frame returns instead of when *all* frames return.",
          "The fix is one number. `run(stop_at)` returns when the frame count drops back to `stop_at`. The script runs with `stop_at = 0`, and a module runs with whatever depth the importer was at. The same mechanism later lets native Rust functions call Wisp callbacks.",
        ],
      },
    ],
    build: {
      intro: "A new keyword in the front end, a re-entrant `execute` in the VM, and the import instruction itself.",
      milestone: "`let geo = import \"geometry\"` loads `geometry.wisp` once, and `geo.area(3, 4)` calls into it.",
      steps: [
        {
          title: "Front end: the import expression",
          body: "`import` is an expression, so its result can be stored in any variable.",
          code: {
            lang: "rust",
            caption: "lexer.rs, ast.rs, parser.rs, compiler.rs, chunk.rs",
            code: `// lexer.rs: a new keyword
Import,                         // in enum Tok
"import" => Tok::Import,        // in keyword()

// ast.rs
Import(String, u32),            // in enum Expr: import "path"

// parser.rs: a new prefix case in expr()
Tok::Import => match self.advance() {
    Tok::Str(path) => Expr::Import(path, line),
    _ => return Err(format!("[line {line}] import needs a module name in quotes")),
},

// compiler.rs: in expr()
Expr::Import(path, line) => {
    self.line = *line;
    let k = self.str_const(path);
    self.emit(Op::Import(k));
}

// chunk.rs
Import(u16),                    // operand = module-name constant`,
          },
        },
        {
          title: "Make the interpreter re-entrant",
          body: "Split \"start running this closure\" from \"the loop\". `execute` sets up a call exactly like `Call` does, and `run(stop_at)` returns when that call returns.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    /// Run a zero-argument closure to completion and return its result.
    /// Used for the main script, for module bodies, and later for native callbacks.
    pub fn execute(&mut self, closure: ObjRef) -> Result<Value, String> {
        let func = self.func_of(closure);
        self.push(Value::Obj(closure));  // the callee slot, as Call expects
        let stop_at = self.frames.len(); // stop when we're back at this depth
        self.frames.push(CallFrame { closure, func, ip: 0, base: self.stack.len() });
        self.run(stop_at)?;
        Ok(self.pop())                   // Return left the result on the stack
    }

    fn run(&mut self, stop_at: usize) -> Result<(), String> {
        // load the hot state from whatever frame is on top
        let top = self.frames.last().unwrap();
        let (mut closure, mut func, mut ip, mut base) = (top.closure, top.func.clone(), top.ip, top.base);
        loop {
            // ...fetch and match as before...
            Op::Return => {
                let result = self.pop();
                self.close_upvalues(base);
                self.frames.pop();
                self.stack.truncate(base - 1);
                self.push(result);
                if self.frames.len() == stop_at {
                    return Ok(()); // back at the depth execute() started from
                }
                // otherwise restore the caller's hot state, as before
            }
        }
    }
}

// main.rs: the script is now just the first thing we execute
let script = compiler::compile(&program, &mut vm.heap)?;
let closure = vm.new_closure(script); // wraps a Function in a Closure with no upvalues
vm.execute(closure)?;`,
          },
          explain: [
            "The script is now pushed onto the stack like any callee, so its frame's `base` is 1 instead of 0. Every other frame already worked this way, so `Return` no longer needs a special case for the script.",
            "Each nested `run` has its own Rust local variables (`func`, `ip`...), so when the inner one returns, the outer one carries on exactly where it was. Rust's own call stack keeps track of the nesting for us.",
          ],
          jvm: "HotSpot does the same thing whenever VM code needs to run Java code: class initialization, `Method.invoke`, JNI calling back into Java. The C++ function `JavaCalls::call` sets up a frame and enters the interpreter recursively, and the Java and native frames end up interleaved on one thread stack.",
        },
        {
          title: "The import instruction",
          body: "Check the cache first. On a miss, save `ip`, then load, compile and execute the module with a fresh set of globals. Whatever the module defined becomes its export table.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `// Vm gains:
//   modules: HashMap<String, Value>,             // name -> export table (loaded once)
//   suspended: Vec<HashMap<String, Value>>,      // importers' globals while a module runs
// and collect() adds both to its roots.

Op::Import(k) => {
    let name = self.heap.show(func.chunk.consts[k as usize]);
    let exports = match self.modules.get(&name) {
        Some(&cached) => cached, // already initialized: never run a module twice
        None => {
            self.frames.last_mut().unwrap().ip = ip; // save our place before re-entering
            let exports = self.load_module(&name)?;
            self.modules.insert(name, exports);
            exports
        }
    };
    self.push(exports);
}

fn load_module(&mut self, name: &str) -> Result<Value, String> {
    // 1. LOAD: find the source. Our "classpath" is the current directory.
    let source = std::fs::read_to_string(format!("{name}.wisp"))
        .map_err(|e| format!("cannot import '{name}': {e}"))?;
    // 2. LINK: compile it with the same pipeline as the main script
    let program = parser::parse(lexer::lex(&source)?)?;
    let func = compiler::compile(&program, &mut self.heap)?;
    let closure = self.new_closure(func);
    // 3. INITIALIZE: run the body once, against a fresh, empty set of globals
    let importer = std::mem::take(&mut self.globals);
    self.suspended.push(importer); // keeps the importer's globals visible to the GC
    let result = self.execute(closure);
    let module_globals = std::mem::replace(&mut self.globals, self.suspended.pop().unwrap());
    result?;
    // 4. EXPORT: the module's globals become the fields of one table
    let mut table = HashMap::new();
    for (name, value) in module_globals {
        table.insert(self.heap.intern(&name), value);
    }
    Ok(Value::Obj(self.heap.alloc(Obj::Table(table))))
}`,
          },
          explain: [
            "`std::mem::take` swaps in an empty `HashMap` and hands back the old one. The module can't see or change the importer's globals, and when it finishes, `replace` swaps them back.",
            "The importer's globals are parked in `self.suspended` instead of a Rust local, because a collection during the module's execution must still see them as roots. That's the rule from the GC lesson: live values must be somewhere the collector looks.",
            "The export table is built from Rust values without calling `maybe_gc`, so nothing can be collected halfway through building it.",
            "Circular imports (A imports B, which imports A) would recurse forever here. Insert a placeholder into `modules` before loading and report an error if an import finds it.",
          ],
        },
        {
          title: "Try it",
          body: "Two files in the same folder.",
          code: {
            lang: "wisp",
            caption: "geometry.wisp, then main.wisp",
            code: `fn area(w, h) { return w * h }
let unit = 1
print "geometry loaded"

let geo = import "geometry"
let again = import "geometry"
print geo.area(3, 4) + again.unit`,
          },
          output: `geometry loaded
13`,
          explain: [
            "\"geometry loaded\" prints once even though the module is imported twice. The second import is a cache hit, which is the same once-only rule as Java's `<clinit>`.",
            "`geo.area(3, 4)` is a field read followed by an ordinary call. The closure was created inside the module and carries its own constants, so it works anywhere.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why run a module only once?",
        intuition: "A module sets things up: functions, constants, maybe a cache. Running it again would reset that state and repeat any side effects, like printing or opening files.",
        technical:
          "Initialize-once means a module's top level behaves like a singleton constructor, which is exactly what `<clinit>` guarantees. The JVM also makes initialization thread-safe: a second thread waits until the first has finished initializing. If you add real threads to Wisp, the module cache needs the same lock.",
      },
      {
        q: "Should Wisp cache compiled modules on disk, like `.class` files or Python's `.pyc`?",
        intuition: "It saves recompiling unchanged files at startup. For small scripts compiling is already fast, so only bother when startup time matters.",
        technical:
          "Serialize each `Function` (constants, code, lines, upvalue lists) with a magic number and a version header, and store the source file's modification time or a hash so a stale cache is ignored. Loading cached bytecode also means you should validate it, which is the role of the JVM's verifier.",
      },
      {
        q: "How would I let modules import from other directories?",
        intuition: "Keep a list of folders to search, like Java's classpath, and try each one in order.",
        technical:
          "Add `search_path: Vec<PathBuf>` with the standard library's folder first, then the script's folder, then anything from a `WISP_PATH` environment variable. Searching the standard library first mirrors parent-first delegation in Java class loaders: user code can't accidentally replace a core module.",
      },
    ],
    references: [
      { title: "JVM Specification: Loading, Linking, and Initializing", by: "Oracle", url: "https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-5.html", kind: "spec", note: "Chapter 5: the exact rules the JVM follows, including initialization locking." },
    ],
  },
];
