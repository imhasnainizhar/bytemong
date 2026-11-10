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
      "So far every value fits in 16 bytes, but strings and objects don't. They have to live somewhere else, the **heap**, and a value only holds a small **reference** to them, like a ticket number for an item in a cloakroom. That's exactly how the JVM works: a variable of type `Object` holds a reference, and the object itself lives in the Java heap.",
      "In this lesson you'll build a simple heap: a list of objects, where a reference is just a position in that list. On top of it come strings and Wisp's objects. Wisp has no classes, so an object is a **table**: a bag of named fields you can add to at any time.",
    ],
    sim: "shapes",
    simTitle: "How shapes turn dynamic fields into fixed slots",
    jvm: {
      title: "What the JVM heap teaches us",
      points: [
        "Every Java object starts with a small header, followed by its fields at **fixed offsets** decided when its class loads. So `getfield` is a single memory read at `object + offset`.",
        "String literals are **interned**: every `\"hello\"` in every class points to the same `String` object. That's why `==` happens to work on literals, and why `String.intern()` exists.",
        "Variables never contain objects, only references to them. Copying a reference is cheap, and two variables can point to the same object.",
        "With compressed oops, HotSpot stores references as 32-bit numbers and turns them into addresses when needed. A reference is a number, not necessarily a raw pointer, which is the same idea as our index-based `ObjRef`.",
      ],
    },
    concepts: [
      {
        heading: "Why positions instead of pointers?",
        body: [
          "In C you'd use raw pointers to heap objects. In Rust, raw pointers need `unsafe`, and wrapping everything in `Rc<RefCell<...>>` gets noisy and can't free objects that point at each other. A `Vec` of objects plus a `u32` position avoids both problems: references are small, safe, and freely copyable, and the garbage collector in lesson 09 is just a walk over that `Vec`.",
          "The cost is one extra lookup per access (`objects[i]`). That's fine for a learning VM, and since all access goes through a few `Heap` methods, it's easy to change later.",
        ],
      },
      {
        heading: "Shapes: how dynamic objects get fixed layouts",
        body: [
          "A `HashMap` per table is flexible but slow: every `p.x` is a hash lookup. Java avoids this because a class fixes the field layout ahead of time. Dynamic VMs such as V8 get that speed back with **shapes** (also called hidden classes). Tables built with the same fields in the same order share a shape, which maps each field name to a slot number, and the table itself stores only a `Vec<Value>`.",
          "Add an **inline cache**, where each `GetField` remembers \"last time, this shape had `x` in slot 0\", and a field read becomes a quick check plus an array index, close to Java's `getfield`. Build the simple `HashMap` version first. Shapes are a drop-in upgrade once it works.",
        ],
        code: {
          lang: "rust",
          caption: "the upgrade, sketched",
          code: `struct Shape {
    slots: HashMap<ObjRef, usize>,       // field name -> slot number
    transitions: HashMap<ObjRef, usize>, // "add field f" -> the next shape
}
struct Table {
    shape: usize,       // tables with the same layout share a shape
    values: Vec<Value>, // fields stored by slot, like a Java object's fields
}`,
        },
      },
    ],
    build: {
      intro: "A new `object.rs` file for the heap, then small changes to `Value`, the compiler and the VM so they understand references.",
      milestone: "string literals, `+` for joining strings, and table literals with `obj.field` reads and writes.",
      steps: [
        {
          section: "Part 1 · The heap",
          title: "ObjRef and Obj: a reference and the things it can point to",
          body: "**What they're for:** `ObjRef` is a reference, just a position in the heap. `Obj` lists the kinds of thing that can live in the heap. For now that's strings and tables. Functions and closures join in lessons 07–08.",
          code: {
            lang: "rust",
            caption: "src/object.rs",
            code: `use crate::value::Value;
use std::collections::HashMap;

/// A reference to a heap object: its position in Heap::objects.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ObjRef(pub u32);

/// Everything that can live on the heap.
pub enum Obj {
    Str(String),
    Table(HashMap<ObjRef, Value>), // field name (an interned string) -> value
}`,
          },
          explain: [
            "`ObjRef(u32)` is a struct that wraps one number. Giving it its own type means Rust won't let you mix it up with an ordinary number by accident.",
            "It derives `Copy`, so references can be copied around freely, and `Eq` plus `Hash`, so they can be keys in a `HashMap`.",
            "A table maps field names to values. The names are `ObjRef`s, not `String`s, for the reason explained in the `intern` step.",
          ],
        },
        {
          title: "The Heap struct and alloc()",
          body: "**What it's for:** `Heap` owns every object. `alloc` stores a new object and hands back a reference to it, like a cloakroom taking your coat and giving you a ticket.",
          code: {
            lang: "rust",
            caption: "src/object.rs (continued)",
            code: `#[derive(Default)]
pub struct Heap {
    objects: Vec<Option<Obj>>,        // every object; None will mark a freed slot (lesson 09)
    strings: HashMap<String, ObjRef>, // the intern table: text -> its one shared object
}

impl Heap {
    /// Store an object and return a reference to it.
    pub fn alloc(&mut self, obj: Obj) -> ObjRef {
        self.objects.push(Some(obj));
        ObjRef(self.objects.len() as u32 - 1)
    }
}`,
          },
          explain: [
            "The new object goes at the end of the list, so its reference is the last position, `len - 1`.",
            "Each slot is an `Option<Obj>`, which is always `Some` for now. In lesson 09 the garbage collector frees objects by setting their slot to `None` and reusing it.",
          ],
        },
        {
          title: "intern(): one shared object per piece of text",
          body: "**What it's for:** making sure equal strings share a single object. Ask for `\"hello\"` twice and you get the same `ObjRef` both times. After that, checking whether two strings are equal is just comparing two numbers.",
          code: {
            lang: "rust",
            caption: "src/object.rs (continued)",
            code: `impl Heap {
    pub fn intern(&mut self, s: &str) -> ObjRef {
        if let Some(&r) = self.strings.get(s) {
            return r; // seen this text before: reuse its object
        }
        let r = self.alloc(Obj::Str(s.to_string()));
        self.strings.insert(s.to_string(), r);
        r
    }
}`,
          },
          explain: [
            "The intern table remembers which object holds each piece of text. The first request creates the object, and every later request reuses it.",
            "This is why table field names can be `ObjRef`s: the name `x` is always the same object, so looking up `x` compares numbers instead of text.",
          ],
          jvm: "The JVM interns string *literals* automatically, but strings built while running (`a + b`) aren't interned unless you call `intern()`. Wisp interns every string to keep equality simple. It costs one lookup per new string, and Lua does the same for short strings.",
        },
        {
          title: "get(), get_mut() and show()",
          body: "**What they're for:** `get` turns a reference back into the object, for reading. `get_mut` does the same for changing it. `show` turns any value into text for `print`. It needs the heap because a reference on its own doesn't contain the string's text.",
          code: {
            lang: "rust",
            caption: "src/object.rs (continued)",
            code: `impl Heap {
    pub fn get(&self, r: ObjRef) -> &Obj {
        self.objects[r.0 as usize].as_ref().expect("use of a freed object")
    }

    pub fn get_mut(&mut self, r: ObjRef) -> &mut Obj {
        self.objects[r.0 as usize].as_mut().expect("use of a freed object")
    }

    pub fn show(&self, v: Value) -> String {
        match v {
            Value::Obj(r) => match self.get(r) {
                Obj::Str(s) => s.clone(),
                Obj::Table(t) => format!("<table with {} fields>", t.len()),
            },
            other => other.to_string(), // nil, booleans and numbers print as before
        }
    }
}`,
          },
          explain: [
            "`r.0` is the number inside the `ObjRef`. `as_ref()` and `as_mut()` look inside the `Option` without taking the object out.",
            "The `expect` message would only show up if something used a freed object, which the garbage collector is designed to prevent.",
          ],
        },
        {
          title: "Value gets one more option",
          body: "**What it's for:** letting a Wisp value hold a reference. It's still `Copy` and still 16 bytes, because only the reference lives inside the value, while the object stays on the heap.",
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

// in Display, a fallback: print uses Heap::show instead, which can see the heap
Value::Obj(r) => write!(f, "<obj #{}>", r.0),`,
          },
        },
        {
          section: "Part 2 · The compiler",
          title: "The compiler borrows the heap",
          body: "**What it's for:** string constants have to be interned, which means the compiler needs access to the VM's heap while it works. `str_const` is a helper that interns a string and adds it to the constant pool in one go.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `pub struct Compiler<'h> {
    // ...chunk, locals, scope_depth and line, as before...
    heap: &'h mut Heap, // borrowed from the VM while compiling
}

pub fn compile(program: &[Stmt], heap: &mut Heap) -> Result<Chunk, String> {
    // as before, plus \`heap\` when creating the Compiler
}

impl Compiler<'_> {
    /// Intern a string and put it in the constant pool. Returns its constant number.
    fn str_const(&mut self, s: &str) -> u16 {
        let r = self.heap.intern(s);
        self.chunk.add_const(Value::Obj(r))
    }
}`,
          },
          explain: [
            "`<'h>` is a **lifetime**: it tells Rust the compiler only borrows the heap and must not outlive it. You don't need to think about it beyond writing it in these two places.",
            "Because interned strings are unique, `add_const`'s duplicate check also works for strings: `\"hi\"` used twice takes one pool slot.",
          ],
        },
        {
          title: "Arms: string and table literals",
          body: "**What they do:** a string literal becomes a `Const` that loads the interned string. A table literal creates an empty table, then sets each field in turn, leaving the finished table on the stack.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside expr's match",
            code: `            Expr::Str(s) => {
                let k = self.str_const(s);
                self.emit(Op::Const(k));
            }
            Expr::Table(fields) => {
                self.emit(Op::NewTable);           // stack: [.., t]
                for (name, value) in fields {
                    self.emit(Op::Dup);            // [.., t, t]
                    self.expr(value)?;             // [.., t, t, v]
                    let k = self.str_const(name);
                    self.emit(Op::SetField(k));    // [.., t, v]  (sets t.name = v, keeps v)
                    self.emit(Op::Pop);            // [.., t]
                }
            }`,
          },
          explain: [
            "The comments show the stack after each instruction. Writing those down is the easiest way to get stack code right: check that the expression ends with exactly one new value.",
            "`Dup` makes a spare copy of the table for each field, because `SetField` uses one up. The original stays underneath for the next field.",
          ],
        },
        {
          title: "Arms: reading and writing fields",
          body: "**What they do:** `obj.field` pushes the object, then `GetField` replaces it with the field's value. `obj.field = value` pushes the object and the value, then `SetField` stores it. Three new instructions support this.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside expr's match",
            code: `            Expr::Get(obj, name, line) => {
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

// and three new variants in Op (chunk.rs):
//     NewTable,       // push an empty table           ≈ new
//     GetField(u16),  // operand = field-name constant ≈ getfield
//     SetField(u16),  //                               ≈ putfield`,
          },
          jvm: "`getfield #5` names its field through the constant pool too. The first time it runs, the JVM works out the field's fixed position in the object, and HotSpot rewrites the instruction into a faster internal form. Shapes plus inline caches are how a classless VM gets the same benefit.",
        },
        {
          section: "Part 3 · The VM",
          title: "The VM owns the heap",
          body: "**What it's for:** the heap belongs to the VM, which lends it to the compiler before running. `main.rs` changes to create the VM first.",
          code: {
            lang: "rust",
            caption: "src/vm.rs and src/main.rs (changes)",
            code: `pub struct Vm {
    // ...stack and globals, as before...
    pub heap: Heap,
}
// in Vm::new():  heap: Heap::default(),

// in run() in main.rs:
let mut vm = vm::Vm::new();
let chunk = compiler::compile(&program, &mut vm.heap)?; // compiler borrows the heap...
vm.run(&chunk)                                          // ...then the VM uses it`,
          },
        },
        {
          title: "Arm: Add handles numbers and strings",
          body: "**What it does:** `Add` needs its own arm now, because `\"a\" + \"b\"` should join the strings. Remove `Op::Add` from the shared arithmetic arm and add this one.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Add => {
                    let b = self.pop();
                    let a = self.pop();
                    let result = match (a, b) {
                        (Value::Num(x), Value::Num(y)) => Value::Num(x + y),
                        (Value::Obj(x), Value::Obj(y)) => {
                            // read both strings and build the joined text...
                            let joined = match (self.heap.get(x), self.heap.get(y)) {
                                (Obj::Str(s1), Obj::Str(s2)) => format!("{s1}{s2}"),
                                _ => return Err(self.error(chunk, ip, "can only add numbers or strings")),
                            };
                            // ...then store it as a (new or shared) heap string
                            Value::Obj(self.heap.intern(&joined))
                        }
                        _ => return Err(self.error(chunk, ip, "can only add numbers or strings")),
                    };
                    self.push(result);
                }`,
          },
          explain: [
            "`match (a, b)` looks at both values at once and picks the case that fits: two numbers, two heap objects, or anything else.",
            "Reading and writing are kept separate on purpose. The inner `match` only *reads* the two strings to build `joined`. Once that's done, the heap isn't being read any more, so `intern` is allowed to change it. Rust's borrow checker insists on this split.",
          ],
        },
        {
          title: "Arms: NewTable and GetField",
          body: "**What they do:** `NewTable` creates an empty table on the heap and pushes a reference to it. `GetField` pops a table, looks up the field, and pushes the value it finds, or `nil` if there's no such field.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::NewTable => {
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
                    let v = fields.get(&name).copied().unwrap_or(Value::Nil); // missing field: nil
                    self.push(v);
                }`,
          },
          explain: [
            "The field name comes from the constant pool, where the compiler put it as an interned string.",
            "Two checks give clear errors: the value must be a heap object, and that object must be a table. `5.x` and `\"text\".x` both fail with \"only tables have fields\".",
            "Reading a missing field gives `nil`, the Lua and JavaScript convention. It's a language choice, so pick the one you prefer.",
          ],
        },
        {
          title: "Arms: SetField and Print",
          body: "**What they do:** `SetField` pops the value and the table, stores the field (creating it if it's new), and pushes the value back as the result of the assignment. `Print` now uses `heap.show`, so strings print their text.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::SetField(k) => {
                    let Value::Obj(name) = chunk.consts[k as usize] else { unreachable!() };
                    let value = self.pop();
                    let Value::Obj(r) = self.pop() else {
                        return Err(self.error(chunk, ip, "only tables have fields"));
                    };
                    let Obj::Table(fields) = self.heap.get_mut(r) else {
                        return Err(self.error(chunk, ip, "only tables have fields"));
                    };
                    fields.insert(name, value); // adds the field if it's new
                    self.push(value);           // assignment is an expression
                }
                Op::Print => {
                    let v = self.pop();
                    println!("{}", self.heap.show(v));
                }`,
          },
          explain: [
            "Tables are shared by reference. After `let a = {x: 1}  let b = a  b.x = 2`, printing `a.x` gives `2`: both variables hold the same `ObjRef`, just as two Java variables can point to one object.",
          ],
        },
        {
          section: "Part 4 · Try it",
          title: "Strings and tables, end to end",
          body: "Run this script to check every new piece at once.",
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
          "That's **prototype delegation**. Add an optional `proto: Option<ObjRef>` to tables, and make `GetField` follow the chain when a field is missing. Store functions on the prototype and pass the object as a hidden first argument (`self`). With shapes and inline caches, prototype lookups can be cached just like normal field reads.",
      },
      {
        q: "Why intern every string? Isn't that slow?",
        intuition: "It costs a little when a string is created, and saves a lot every time strings are compared or used as field names, which happens far more often.",
        technical:
          "Without interning, string `==` compares every character, and table keys must be hashed on every lookup. With interning, both become integer comparisons. The cost is one hash lookup per new string, and the intern table must not keep unused strings alive. Lesson 09 handles that.",
      },
      {
        q: "How big is a Java object compared with a Wisp table?",
        intuition: "A small Java object is usually 16–24 bytes. A Wisp table with a `HashMap` is several times bigger, which is the price of being able to add fields at any time.",
        technical:
          "HotSpot uses a 12-byte header (with compressed class pointers) plus tightly packed fields, rounded up to 8 bytes. A Rust `HashMap` is 48 bytes before it stores anything, plus more per field. Shapes fix this too: a table becomes a shape number plus a `Vec<Value>` of exactly its fields.",
      },
    ],
    references: [
      ci("Strings", "strings", "Heap objects and string values in C."),
      ci("Hash Tables", "hash-tables", "Interning, and building your own hash table."),
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
      "A JVM thread keeps a stack of **frames**, one per function call that hasn't finished yet. Each frame remembers which function it's running and where it's up to. Calling a function adds a frame, and returning removes it. That's really all a call is.",
      "In this lesson Wisp gets the same thing. Each function compiles into its own chunk and becomes a heap object, and the VM keeps a list of `CallFrame`s. A frame doesn't need its own separate stack: it's just a **window** onto the shared value stack, starting where its arguments were pushed.",
    ],
    sim: "heap-stack",
    simTitle: "Frames on the stack, objects on the heap",
    jvm: {
      title: "What JVM calls teach us",
      points: [
        "`invokestatic` takes the arguments off the caller's stack, and they become the called method's local variables 0, 1, 2 and so on. In HotSpot's interpreter they aren't even copied: the new frame's locals simply start where the arguments already are.",
        "Each frame records where the caller should continue when this call returns. Our frame stores the caller's `ip` for the same reason.",
        "Each thread's stack has a fixed size (`-Xss`). Infinite recursion fills it and throws `StackOverflowError`.",
        "Java checks a method's argument types once, when the call is first linked. Wisp is dynamic, so it checks the argument count on every call instead.",
      ],
    },
    concepts: [
      {
        heading: "How a call lays out the stack",
        body: [
          "A call compiles to: push the function, push each argument, then `Call(argc)`. When `Call` runs, the stack looks like `[.., fn, arg0, arg1]`. The new frame's `base` is the position of `arg0`. Inside the function, `GetLocal(0)` is the first argument, `GetLocal(1)` the second, and any `let` inside the body continues at slot 2, 3 and so on. Nothing gets copied.",
          "On `Return`, the VM pops the result, cuts the stack back to just below `fn` (removing the arguments, the locals and the function itself), and pushes the result. The caller sees what any expression leaves behind: one value where the call was.",
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
      intro: "The compiler learns to compile one function inside another, and the VM learns to switch between frames.",
      milestone: "named functions, recursion and `return`. `fib(25)` runs.",
      steps: [
        {
          section: "Part 1 · Function objects",
          title: "The Function struct",
          body: "**What it's for:** a compiled function: its name (for error messages), how many arguments it expects, and its own chunk of code. It lives on the heap so it can be stored in variables and passed around like any other value.",
          code: {
            lang: "rust",
            caption: "src/object.rs (changes)",
            code: `use crate::chunk::Chunk;
use std::rc::Rc;

pub struct Function {
    pub name: String,
    pub arity: u8,    // how many arguments it expects
    pub chunk: Chunk, // its own instructions, constants and line numbers
}

// a new variant in enum Obj:
Function(Rc<Function>),

// and a new case in Heap::show:
Obj::Function(f) => format!("<fn {}>", f.name),`,
          },
          explain: [
            "`Rc` (reference counted) lets several owners share one value. A function never changes after it's compiled, so sharing it is safe. The VM step below explains why sharing is useful.",
          ],
          jvm: "This plays the role of the JVM's internal `Method` structure: bytecode, a link to the constant pool, and an argument count.",
        },
        {
          section: "Part 2 · The compiler",
          title: "FnState: everything that belongs to one function",
          body: "**What it's for:** while compiling a function body, the compiler needs a fresh chunk and a fresh list of locals. Afterwards it must go back to the outer ones. So those fields move into a `FnState` struct, and the compiler keeps a stack of them.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `/// These were the Compiler's own fields in lesson 05.
struct FnState {
    chunk: Chunk,
    locals: Vec<Local>,
    scope_depth: usize,
}

impl FnState {
    fn new(scope_depth: usize) -> Self {
        FnState { chunk: Chunk::default(), locals: Vec::new(), scope_depth }
    }

    /// resolve_local moves here: it searches this function's locals only.
    fn resolve_local(&self, name: &str) -> Option<u16> {
        self.locals.iter().rposition(|l| l.name == name).map(|i| i as u16)
    }
}`,
          },
        },
        {
          title: "The Compiler holds a stack of FnStates",
          body: "**What it's for:** the innermost function being compiled is always the last entry, and `cur()` returns it. `compile` now starts with one `FnState` for the top-level script and returns the script as a function object.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `pub struct Compiler<'h> {
    fns: Vec<FnState>, // innermost function last
    heap: &'h mut Heap,
    line: u32,
}

pub fn compile(program: &[Stmt], heap: &mut Heap) -> Result<ObjRef, String> {
    let mut c = Compiler { fns: vec![FnState::new(0)], heap, line: 1 };
    for s in program {
        c.stmt(s)?;
    }
    Ok(c.finish("script", 0)) // the whole script is a function too
}

impl Compiler<'_> {
    /// The function we're compiling right now.
    fn cur(&mut self) -> &mut FnState {
        self.fns.last_mut().unwrap()
    }

    fn emit(&mut self, op: Op) -> usize {
        let line = self.line;
        self.cur().chunk.emit(op, line)
    }
}`,
          },
          explain: [
            "Every `self.chunk` in the lesson 05 code becomes `self.cur().chunk`, and the same goes for `locals` and `scope_depth`. It's a mechanical find-and-replace: the compiler always writes into the innermost function.",
            "Treating the top-level script as a function named `script` means the VM needs no special case for the outermost code.",
          ],
        },
        {
          title: "function(): compile a function body",
          body: "**What it's for:** compiling `fn name(params) { body }` into its own chunk. It pushes a fresh `FnState`, registers the parameters as the first locals, compiles the body, and then calls `finish`.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler<'_> {
    fn function(&mut self, name: &str, params: &[String], body: &[Stmt]) -> Result<ObjRef, String> {
        let mut state = FnState::new(1); // depth 1: a function body is never the top level
        for p in params {
            // parameters are the first locals: slots 0, 1, 2...
            state.locals.push(Local { name: p.clone(), depth: 1 });
        }
        self.fns.push(state);
        for s in body {
            self.stmt(s)?;
        }
        Ok(self.finish(name, params.len() as u8))
    }
}`,
          },
          explain: [
            "Parameters get slots 0, 1, 2 before any code runs. That matches where the VM will find the arguments: the call left them on the stack in exactly that order.",
            "Starting at depth 1 means `let` inside a function always makes a local, never a global.",
          ],
        },
        {
          title: "finish(): seal the function and put it on the heap",
          body: "**What it's for:** ending a function. It adds an automatic `return nil` at the end, removes the function's `FnState` (returning to the enclosing function), and stores the result on the heap as a `Function` object.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler<'_> {
    fn finish(&mut self, name: &str, arity: u8) -> ObjRef {
        // a function that runs off its end returns nil
        self.emit(Op::Nil);
        self.emit(Op::Return);
        let state = self.fns.pop().unwrap(); // back to the enclosing function
        let f = Function { name: name.to_string(), arity, chunk: state.chunk };
        self.heap.alloc(Obj::Function(Rc::new(f)))
    }
}`,
          },
          explain: [
            "If the body already returned, those last two instructions are simply never reached. Adding them anyway is simpler than working out whether every path returns.",
          ],
        },
        {
          title: "Arm: fn declarations",
          body: "**What it does:** compiles the body into a function object, puts that object in the current chunk's constant pool, and pushes it with `Const`. Then it's stored in a variable like any other value: a global at the top level, a local inside a block.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside stmt's match",
            code: `            Stmt::Fn(name, params, body) => {
                let depth = self.cur().scope_depth;
                if depth > 0 {
                    // a local function: claim its slot BEFORE compiling the body,
                    // so the value pushed below lands in exactly that slot
                    self.cur().locals.push(Local { name: name.clone(), depth });
                }
                let f = self.function(name, params, body)?;
                let k = self.cur().chunk.add_const(Value::Obj(f));
                self.emit(Op::Const(k)); // (lesson 08 changes this to Op::Closure)
                if depth == 0 {
                    let n = self.cur().chunk.add_name(name);
                    self.emit(Op::DefineGlobal(n));
                }
            }`,
          },
          explain: [
            "Functions are constants, just like numbers. The compiled body of `fib` sits in the script's constant pool, and `Const(k)` pushes it when that line runs.",
            "Recursion needs no special handling for global functions. By the time `fib` runs, `DefineGlobal` has stored it, so the `GetGlobal(\"fib\")` inside its own body finds it.",
          ],
        },
        {
          title: "Arms: return and calls",
          body: "**What they do:** `return` computes its value (or `nil`) and emits `Return`. A call pushes the function, then each argument, then emits `Call` with the number of arguments.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside stmt's and expr's matches",
            code: `            // in stmt():
            Stmt::Return(value) => {
                match value {
                    Some(e) => self.expr(e)?,
                    None => {
                        self.emit(Op::Nil);
                    }
                }
                self.emit(Op::Return);
            }

            // in expr():
            Expr::Call(callee, args, line) => {
                self.expr(callee)?;        // [.., f]
                for a in args {
                    self.expr(a)?;         // [.., f, a0, a1, ...]
                }
                self.line = *line;
                self.emit(Op::Call(args.len() as u8));
            }

// a new variant in Op:  Call(u8),  // operand = argument count  ≈ invokestatic`,
          },
        },
        {
          section: "Part 3 · The VM",
          title: "CallFrame: one entry per call in progress",
          body: "**What it's for:** a frame remembers three things about a call: which function is running, where to continue in it (`ip`), and where its window on the stack starts (`base`). The VM keeps a list of frames: the last one is the call running now.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `struct CallFrame {
    func: Rc<Function>, // the function running in this frame
    ip: usize,          // where to continue (saved when this frame calls another)
    base: usize,        // stack position of this frame's slot 0, its first argument
}

pub struct Vm {
    stack: Vec<Value>,
    frames: Vec<CallFrame>, // the call stack: last = currently running
    globals: HashMap<String, Value>,
    pub heap: Heap,
}`,
          },
          jvm: "A JVM frame holds the same three things: the method, the saved bytecode position, and the start of the frame's locals.",
        },
        {
          title: "run(): start with the script's frame",
          body: "**What it's for:** `run` now receives the script function. It copies the current frame's details into three local variables, `func`, `ip` and `base`, because every instruction uses them. Locals are now counted from `base`.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    pub fn run(&mut self, script: ObjRef) -> Result<(), String> {
        let Obj::Function(f) = self.heap.get(script) else { unreachable!() };
        // the running frame's details, kept in locals because they're used constantly
        let mut func = f.clone(); // clone the Rc: a second handle on the same function
        let mut ip = 0;
        let mut base = 0;
        self.frames.push(CallFrame { func: func.clone(), ip, base });

        loop {
            let op = func.chunk.code[ip];
            ip += 1;
            match op {
                // every existing arm stays, with \`chunk\` replaced by \`func.chunk\`
                // locals are now counted from the frame's base:
                Op::GetLocal(slot) => self.push(self.stack[base + slot as usize]),
                Op::SetLocal(slot) => self.stack[base + slot as usize] = self.peek(0),
                // ...plus the Call and Return arms from the next two steps
            }
        }
    }
}`,
          },
          explain: [
            "**Why clone the `Rc`?** If `func` pointed into `self.heap`, Rust wouldn't let any instruction change `self` (push to the stack, allocate) while that pointer existed. Cloning an `Rc` gives the loop its own handle to the function. It costs one counter increment.",
            "`base + slot` turns \"this function's local 2\" into an actual stack position.",
          ],
        },
        {
          title: "Arm: Call",
          body: "**What it does:** checks that the value being called really is a function and got the right number of arguments. Then it saves where the caller should continue, and switches the three locals over to the new function. The next pass of the loop runs the function's first instruction.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Call(argc) => {
                    let argc = argc as usize;
                    // 1. CHECK: the callee sits just below its arguments
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
                    // 2. SAVE where the caller continues
                    self.frames.last_mut().unwrap().ip = ip;
                    // 3. SWITCH to the callee
                    func = callee;
                    ip = 0;
                    base = self.stack.len() - argc; // the arguments are already in slots 0..argc
                    self.frames.push(CallFrame { func: func.clone(), ip, base });
                }`,
          },
          explain: [
            "`self.peek(argc)` looks past the arguments to the value under them: the thing being called.",
            "The frame limit turns infinite recursion into a Wisp error instead of the program using up all its memory. 1024 is an arbitrary number, so pick any limit you like.",
            "`base = stack.len() - argc` is the whole calling convention: the arguments are already sitting exactly where the new function expects its first locals.",
            "The caller's `ip` is only saved here, at the moment of the call. While a function runs, its `ip` lives only in the local variable, which is the speed trick from lesson 04 again.",
          ],
        },
        {
          title: "Arm: Return",
          body: "**What it does:** pops the result, removes the finished frame, clears that call's part of the stack, and pushes the result for the caller. Then it switches the three locals back to the caller's frame, so the loop carries on right after the caller's `Call`.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Return => {
                    let result = self.pop();
                    self.frames.pop();
                    if self.frames.is_empty() {
                        return Ok(()); // the script itself has finished
                    }
                    // remove the callee's locals and arguments, AND the function value below them
                    self.stack.truncate(base - 1);
                    self.push(result);
                    // switch back to the caller
                    let caller = self.frames.last().unwrap();
                    func = caller.func.clone();
                    ip = caller.ip;
                    base = caller.base;
                }`,
          },
          explain: [
            "`truncate(base - 1)` cuts the stack back to just before the function value. After pushing `result`, the caller sees exactly one new value where the call expression was.",
            "`base` still holds the *finished* call's base when `truncate` runs, which is why the switch back to the caller happens last.",
          ],
          jvm: "HotSpot does the same on `ireturn`: pop the frame, push the result onto the caller's operand stack, and continue at the caller's saved position.",
        },
        {
          section: "Part 4 · Try it",
          title: "Recursion and stack overflow",
          body: "Update `main.rs` so `compile` returns the script function and `vm.run(script)` runs it.",
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
          explain: ["`fib(25)` makes about 250,000 calls. Time it with `cargo run --release` and keep the number: it's your benchmark for lesson 13."],
        },
      ],
    },
    questions: [
      {
        q: "Why one shared stack instead of a separate stack per call?",
        intuition: "The arguments are already on the caller's stack, so letting the called function use them right where they are means no copying. A frame is just a bookmark into the shared stack.",
        technical:
          "With a stack per frame, every call would allocate and copy its arguments. The shared stack makes a call cost one push onto `frames` plus a few number updates. It does mean nothing may keep a Rust reference into `stack` across a call, because the `Vec` might grow and move. Positions (`base + slot`) avoid that problem completely.",
      },
      {
        q: "Where do local variables go when a function returns?",
        intuition: "They're simply cut off the end of the stack. Nothing needs to clean them up, because they were never on the heap.",
        technical:
          "`truncate(base - 1)` drops them all in one operation. This is why stack variables are so cheap, in the JVM too: they never need garbage collection. The exception is a local captured by a closure, which has to outlive its frame. That's the next lesson.",
      },
      {
        q: "Why check the argument count at runtime?",
        intuition: "Wisp doesn't know which function a variable holds until the moment of the call, so it can't check any earlier.",
        technical:
          "The JVM checks method descriptors when it links a call, because Java's types make the target known in advance. In Wisp, `f(1, 2)` could call anything. You could instead use JavaScript's relaxed rule: missing arguments become `nil` and extra ones are dropped. Either works, as long as the frame layout stays consistent.",
      },
    ],
    references: [
      ci("Calls and Functions", "calls-and-functions"),
      { title: "JVM Specification: Frames", by: "Oracle", url: "https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html#jvms-2.6", kind: "spec", note: "§2.6: local variables, operand stacks, and how a call creates a frame." },
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
      "A closure is a function that remembers variables from the place it was written. The tricky part is timing. A captured local lives in its function's frame, but the closure might be called long after that function has returned and its frame is gone.",
      "Java sidesteps this by only letting lambdas capture variables that never change (**effectively final**) and copying their values. Wisp allows full capture, including changes, using the technique from Lua: **upvalues**. An upvalue is a small box that points at the variable while its frame is alive. Just before the frame goes away, the value is moved into the box itself. Every closure sharing that box keeps working.",
    ],
    sim: "upvalues",
    simTitle: "Open upvalues close when the frame returns",
    jvm: {
      title: "What Java lambdas teach us",
      points: [
        "A Java lambda that uses a local gets a **copy** of its value, stored in a field of the lambda object. That's why the local must be effectively final: a copy can't stay in sync with a changing variable.",
        "To share changing state, Java programmers make a box themselves, such as an `AtomicInteger` or a one-element array. An upvalue is exactly that box, made automatically.",
        "Lambdas compile to `invokedynamic`. On first use, the JVM generates a small class whose fields hold the captured values. A Wisp closure is the same idea: a function plus a list of captured things.",
        "A closure keeps alive everything it captures. Anonymous inner classes captured the surrounding object without being asked, which caused memory leaks.",
      ],
    },
    concepts: [
      {
        heading: "Open and closed upvalues",
        body: [
          "When a closure is created, each captured variable gets an `Upvalue` box. At first the box is **open**: it holds the variable's position on the stack, so reads and writes go straight to the live variable. Two closures that capture the same variable share the same box.",
          "When that stack slot is about to disappear, because the block ends or the function returns, the VM **closes** the box by copying the current value into it. From then on, every closure that shares the box reads and writes the copy inside it. They don't notice the difference, because they always go through the box.",
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
        heading: "Finding captured names at compile time",
        body: [
          "When the compiler meets a name that isn't a local of the current function, it asks the function around it. If the name is a local there, it's captured directly, and that local is marked as captured. If not, the compiler asks the next function out, and so on, and every function in between passes the capture along. At runtime, each closure has a simple numbered list of upvalues and never looks anything up by name.",
        ],
      },
    ],
    build: {
      intro: "Three new heap types, four new instructions, and a small recursive search in the compiler.",
      milestone: "functions that capture and change outer variables: counters, callbacks, and anonymous `fn` expressions.",
      steps: [
        {
          section: "Part 1 · New heap objects",
          title: "Closure and Upvalue",
          body: "**What they're for:** a `Closure` is what you actually call at runtime: a function plus the boxes it captured. An `Upvalue` is one box: either still pointing at a stack slot (`Open`) or holding the value itself (`Closed`). `Function` gains a capture list, telling the VM what to capture when a closure is created.",
          code: {
            lang: "rust",
            caption: "src/object.rs (changes)",
            code: `pub struct Function {
    pub name: String,
    pub arity: u8,
    pub chunk: Chunk,
    /// What to capture, one entry per captured variable: (is_local, index).
    ///   is_local = true:  the enclosing function's local slot \`index\`
    ///   is_local = false: the enclosing closure's upvalue number \`index\`
    pub upvalues: Vec<(bool, u16)>,
}

/// A function value at runtime: the code plus its captured boxes.
pub struct Closure {
    pub func: Rc<Function>,
    pub upvalues: Vec<ObjRef>, // each one points to an Obj::Upvalue
}

#[derive(Clone, Copy)]
pub enum Upvalue {
    Open(usize),   // the variable is still on the stack, at this position
    Closed(Value), // its frame is gone: the value now lives in here
}

// two new variants in enum Obj:
Closure(Closure),
Upvalue(Upvalue),`,
          },
          explain: [
            "One `Function` can have many `Closure`s. Each call to `make_counter` creates a new closure from the same compiled function, each with its own `count` box.",
            "Boxes are separate heap objects rather than fields inside the closure. That's what lets two closures share one box, and so see each other's changes.",
          ],
        },
        {
          section: "Part 2 · The compiler",
          title: "New bookkeeping: captured locals and capture lists",
          body: "**What it's for:** two small additions. Each `Local` remembers whether some closure captured it, so it can be moved to the heap when its scope ends. Each `FnState` keeps the capture list that will become `Function::upvalues`.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `struct Local {
    name: String,
    depth: usize,
    captured: bool, // did a closure capture this variable?
}

struct FnState {
    chunk: Chunk,
    locals: Vec<Local>,
    scope_depth: usize,
    upvalues: Vec<(bool, u16)>, // what this function captures
}
// set captured: false and upvalues: Vec::new() wherever these are created`,
          },
        },
        {
          title: "resolve_upvalue(): find a variable in an enclosing function",
          body: "**What it's for:** answering \"is this name a variable of a function around me?\". It checks the directly enclosing function's locals first. If the name isn't there, it asks that function to capture the name from further out, and then captures it from that function.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler<'_> {
    /// \`level\` is an index into self.fns: the function that wants the variable.
    fn resolve_upvalue(&mut self, level: usize, name: &str) -> Option<u16> {
        if level == 0 {
            return None; // the script has nothing around it, so the name is a global
        }
        let parent = level - 1;
        // Case 1: a local of the function directly around us. Capture its slot.
        if let Some(slot) = self.fns[parent].resolve_local(name) {
            self.fns[parent].locals[slot as usize].captured = true;
            return Some(self.add_upvalue(level, true, slot));
        }
        // Case 2: further out. Get our parent to capture it, then capture from the parent.
        let index = self.resolve_upvalue(parent, name)?;
        Some(self.add_upvalue(level, false, index))
    }
}`,
          },
          explain: [
            "Take `fn outer() { let x = 1  fn mid() { fn inner() { print x } } }`. Compiling `inner`: `x` isn't local, so ask `mid`. It isn't local in `mid` either, so `mid` asks `outer`, where it's local slot 0.",
            "So `mid` records `(true, 0)`, meaning \"capture outer's slot 0\", and `inner` records `(false, 0)`, meaning \"capture mid's upvalue 0\". The recursion threads the variable through every level in between.",
            "The `?` in case 2 means: if no enclosing function has the name, give up and return `None`, so it's treated as a global.",
          ],
        },
        {
          title: "add_upvalue(): add to a capture list (without duplicates)",
          body: "**What it's for:** adding an entry to a function's capture list and returning its number. If the same variable is already captured, the existing number is reused, so a function that mentions `count` five times still has one box for it.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler<'_> {
    fn add_upvalue(&mut self, level: usize, is_local: bool, index: u16) -> u16 {
        let ups = &mut self.fns[level].upvalues;
        if let Some(i) = ups.iter().position(|u| *u == (is_local, index)) {
            return i as u16; // already captured: reuse it
        }
        ups.push((is_local, index));
        (ups.len() - 1) as u16
    }
}`,
          },
        },
        {
          title: "get_var(): local, then upvalue, then global",
          body: "**What it's for:** emitting the right instruction to read a name. It checks the three places a variable can live, in order. `Expr::Var` now just calls `get_var`. A matching `set_var` does the same for assignment.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler<'_> {
    fn get_var(&mut self, name: &str) {
        let level = self.fns.len() - 1; // the innermost function
        if let Some(slot) = self.fns[level].resolve_local(name) {
            self.emit(Op::GetLocal(slot));          // 1. our own local
        } else if let Some(i) = self.resolve_upvalue(level, name) {
            self.emit(Op::GetUpvalue(i));           // 2. captured from outside
        } else {
            let k = self.cur().chunk.add_name(name);
            self.emit(Op::GetGlobal(k));            // 3. a global
        }
    }
    // set_var() is identical, with SetLocal / SetUpvalue / SetGlobal.
    // Expr::Var calls self.get_var(name). Expr::Assign compiles the value, then calls self.set_var(name).
}`,
          },
          explain: ["Globals are never captured: they live in the globals table for the whole program, so any function can reach them by name."],
        },
        {
          title: "Create closures, and close captured locals",
          body: "**What it's for:** three small changes. Function values are now created with `Closure(k)` instead of `Const(k)`, anonymous `fn` expressions are compiled, and when a block ends, captured locals get `CloseUpvalue` instead of `Pop`. Four new instructions support this.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (changes)",
            code: `// finish(): keep the capture list on the Function
let f = Function { name: name.to_string(), arity, chunk: state.chunk, upvalues: state.upvalues };

// Stmt::Fn: replace Op::Const(k) with
self.emit(Op::Closure(k));

// a new arm in expr(): anonymous functions, fn(x) { ... }
Expr::Lambda(params, body) => {
    let f = self.function("anonymous", params, body)?;
    let k = self.cur().chunk.add_const(Value::Obj(f));
    self.emit(Op::Closure(k));
}

// block(): the loop that pops locals at the end of a scope becomes
loop {
    let state = self.cur();
    let Some(local) = state.locals.last() else { break };
    if local.depth <= state.scope_depth {
        break; // belongs to an outer scope: keep it
    }
    let captured = local.captured;
    state.locals.pop();
    self.emit(if captured { Op::CloseUpvalue } else { Op::Pop });
}

// four new variants in Op:
//   Closure(u16)     operand = function constant: build a closure and push it
//   GetUpvalue(u16)  push the value in the current closure's box i
//   SetUpvalue(u16)  change it (the value stays on the stack, like SetLocal)
//   CloseUpvalue     move the top stack slot into its box, then pop it`,
          },
          explain: [
            "The block loop is written out longhand so that `state` (a borrow of `self`) is finished before `self.emit` is called. Rust doesn't allow both at once.",
            "A function's return doesn't need a `CloseUpvalue` for each local. The VM closes everything in the frame in one go when `Return` runs.",
          ],
        },
        {
          section: "Part 3 · The VM",
          title: "Frames run closures",
          body: "**What it's for:** a frame now remembers its `Closure`, not just the function, because instructions need it to find their upvalues. Three helpers convert between functions and closures. The script itself is wrapped in a closure that captures nothing.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `struct CallFrame {
    closure: ObjRef,    // the running Closure, needed to reach its upvalues
    func: Rc<Function>, // the closure's function, kept handy
    ip: usize,
    base: usize,
}
// Vm gains:  open_upvalues: Vec<ObjRef>,  // boxes still pointing at the stack

impl Vm {
    /// The Rc<Function> inside a Function object.
    fn function(&self, r: ObjRef) -> Rc<Function> {
        let Obj::Function(f) = self.heap.get(r) else { unreachable!() };
        f.clone()
    }

    /// Wrap a compiled function in a closure that captures nothing (used for the script).
    pub fn new_closure(&mut self, func: ObjRef) -> ObjRef {
        let func = self.function(func);
        self.heap.alloc(Obj::Closure(Closure { func, upvalues: Vec::new() }))
    }

    /// The function inside a closure.
    fn func_of(&self, closure: ObjRef) -> Rc<Function> {
        let Obj::Closure(c) = self.heap.get(closure) else { unreachable!() };
        c.func.clone()
    }
}

// in run(): start from a closure, and keep \`closure\` as a 4th local next to func, ip, base
//     let mut closure = self.new_closure(script);
//     let mut func = self.func_of(closure);
// in Call: accept Obj::Closure(c) and use c.func; store \`closure = r\` in the new frame
// in Return: also restore \`closure = caller.closure\``,
          },
        },
        {
          title: "upvalue_of() and capture(): find or create a box",
          body: "**What they're for:** `upvalue_of` returns box number `i` of a closure. `capture` gets the box for a stack slot. If an open box for that slot already exists, it's reused, which is how two closures end up sharing one variable.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `impl Vm {
    fn upvalue_of(&self, closure: ObjRef, i: u16) -> ObjRef {
        let Obj::Closure(c) = self.heap.get(closure) else { unreachable!() };
        c.upvalues[i as usize]
    }

    fn capture(&mut self, slot: usize) -> ObjRef {
        // is there already an open box for this slot? share it
        for &r in &self.open_upvalues {
            if let Obj::Upvalue(Upvalue::Open(s)) = self.heap.get(r) {
                if *s == slot {
                    return r;
                }
            }
        }
        // no: make a new box pointing at the slot, and remember it's open
        let r = self.heap.alloc(Obj::Upvalue(Upvalue::Open(slot)));
        self.open_upvalues.push(r);
        r
    }
}`,
          },
        },
        {
          title: "close_upvalues(): move values off the stack",
          body: "**What it's for:** just before stack slots disappear, every open box pointing at one of them copies the current value inside itself and becomes `Closed`. Closed boxes are then removed from the open list.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `impl Vm {
    /// Close every open box that points at stack position \`from\` or above.
    fn close_upvalues(&mut self, from: usize) {
        let stack = &self.stack;
        let heap = &mut self.heap;
        self.open_upvalues.retain(|&r| {
            let Obj::Upvalue(up) = heap.get_mut(r) else { unreachable!() };
            match *up {
                Upvalue::Open(slot) if slot >= from => {
                    *up = Upvalue::Closed(stack[slot]); // the value moves into the box
                    false                               // and it's no longer open
                }
                _ => true, // still open: keep it in the list
            }
        });
    }
}`,
          },
          explain: [
            "`retain` walks the list and keeps only the entries for which the closure returns `true`.",
            "`stack` and `heap` are borrowed as separate fields up front, so the closure can read one while changing the other. Borrowing all of `self` there would be rejected by Rust.",
          ],
        },
        {
          title: "Arm: Closure (create a closure)",
          body: "**What it does:** takes the compiled function from the constant pool, walks its capture list, and collects a box for each entry. A captured local of the current frame gets a box via `capture`, and anything already captured by the current closure is passed along. Then it pushes the new closure.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Closure(k) => {
                    let Value::Obj(r) = func.chunk.consts[k as usize] else { unreachable!() };
                    let f = self.function(r);
                    let mut upvalues = Vec::with_capacity(f.upvalues.len());
                    for &(is_local, index) in &f.upvalues {
                        upvalues.push(if is_local {
                            self.capture(base + index as usize) // a local of the frame running now
                        } else {
                            self.upvalue_of(closure, index)     // something our closure already captured
                        });
                    }
                    let c = self.heap.alloc(Obj::Closure(Closure { func: f, upvalues }));
                    self.push(Value::Obj(c));
                }`,
          },
          explain: [
            "`base + index` is a slot in the frame that is **creating** the closure, which is the function around it. That's why the compiler recorded the *parent's* slot numbers.",
          ],
        },
        {
          title: "Arms: read, write and close upvalues",
          body: "**What they do:** `GetUpvalue` and `SetUpvalue` go through the box: if it's open they use the stack slot, if it's closed they use the value inside. `CloseUpvalue` closes the top slot's box and pops it. `Return` also closes everything in the finishing frame.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::GetUpvalue(i) => {
                    let up = self.upvalue_of(closure, i);
                    let v = match self.heap.get(up) {
                        Obj::Upvalue(Upvalue::Open(slot)) => self.stack[*slot], // still on the stack
                        Obj::Upvalue(Upvalue::Closed(v)) => *v,                 // moved into the box
                        _ => unreachable!(),
                    };
                    self.push(v);
                }
                Op::SetUpvalue(i) => {
                    let up = self.upvalue_of(closure, i);
                    let v = self.peek(0);
                    match self.heap.get_mut(up) {
                        Obj::Upvalue(Upvalue::Open(slot)) => {
                            let s = *slot;
                            self.stack[s] = v;
                        }
                        Obj::Upvalue(Upvalue::Closed(c)) => *c = v,
                        _ => unreachable!(),
                    }
                }
                Op::CloseUpvalue => {
                    self.close_upvalues(self.stack.len() - 1); // just the top slot
                    self.pop();
                }
                // and in Op::Return, before truncating the stack:
                //     self.close_upvalues(base);`,
          },
          explain: ["A closure never needs to know whether the frame its variable came from is still alive. The box handles both cases, every time."],
          jvm: "The JVM never needs this, because captured values are unchangeable copies. The price is the language rule: no `count++` inside a lambda. Kotlin lifts that rule by quietly putting captured `var`s in a `Ref` box, which is a closed upvalue from the start.",
        },
        {
          section: "Part 4 · Try it",
          title: "Counters and shared boxes",
          body: "Each call to `make_counter` creates a new `count`. Two closures created by the same call share one.",
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
            "`a` and `b` have separate counters: each `make_counter` call had its own `count` slot, so each closure got its own box.",
            "In `pair`, `inc` and `get` captured the same slot while `pair` was still running, so `capture` returned the same box to both. When `pair` returned, the box closed holding `20`, and `get` still reads it.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why not just copy captured values, like Java does?",
        intuition: "Because then `count = count + 1` inside the closure would change the closure's copy, not the variable the rest of the program sees. Counters and callbacks that update shared state wouldn't work.",
        technical:
          "Copying is only correct for variables that never change after capture, which is exactly Java's effectively-final rule. Upvalues give you shared, changeable capture for one extra step per access. As an optimization, if the compiler can see a captured variable is never assigned again, it could copy it instead.",
      },
      {
        q: "Why not put every local variable on the heap? It would be simpler.",
        intuition: "Most locals are never captured, and stack slots are much cheaper. You'd pay the heap cost on every variable just to support the few that need it.",
        technical:
          "Putting every local on the heap means an allocation per variable per call, plus garbage-collection work later. Upvalues only cost anything for captured variables, and only after their frame ends. JVM JITs go further with **escape analysis**: they prove an object never leaves its method and keep it in registers.",
      },
      {
        q: "How would I see the upvalues the compiler created?",
        intuition: "Teach the disassembler to print a function's capture list next to each `Closure` instruction.",
        technical:
          "For `Op::Closure(k)`, look up the function constant and print each `(is_local, index)` pair as `local 2` or `upvalue 0`. It's the most useful debugging aid for closure bugs, and much like `javap -p` showing a lambda class's hidden fields.",
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
      "Right now the heap only grows. Every joined string and every table stays forever, even when no variable refers to it any more. A garbage collector finds the objects the program can no longer reach and frees them.",
      "Every JVM collector, from Serial to G1 to ZGC, is built on the same core idea: start from the **roots** (the values the program can touch directly), follow every reference you find, and anything you never reached is garbage. You'll build the simplest correct version: pause the program, mark what's reachable, sweep away the rest, and carry on.",
    ],
    sim: "gc",
    simTitle: "Mark from the roots, sweep the rest",
    jvm: {
      title: "What the JVM collectors teach us",
      points: [
        "GC **roots** are thread stacks (locals and operand stacks), static fields, JNI handles and a few VM internals. Anything not reachable from them is garbage, including groups of objects that point at each other. That's why counting references isn't enough.",
        "The **generational hypothesis** says most objects die young. The JVM splits the heap into a young generation (collected often and cheaply) and an old generation (collected rarely).",
        "The collector needs the program paused at a known point to read the roots safely: a **safepoint**. Our VM only collects at the start of instructions that allocate, which gives the same guarantee very simply.",
        "Heap sizing trades memory for time: `-Xmx`, and how full the heap gets before collecting. We'll grow the threshold with the amount of live data, the simplest adaptive policy.",
      ],
    },
    concepts: [
      {
        heading: "Mark and sweep in two sentences",
        body: [
          "**Mark**: put every root on a to-do list (the *gray* set). Repeatedly take one object off the list, mark it (*black*), and add everything it points to that isn't marked yet. **Sweep**: walk the whole heap. Anything still unmarked (*white*) can't be reached, so free it. Then clear the marks for next time.",
          "Using a to-do list rather than recursion matters: following a long chain of objects recursively would overflow Rust's own call stack.",
        ],
      },
      {
        heading: "When is it safe to collect?",
        body: [
          "Only when every live reference is somewhere the collector can see: on the VM stack, in globals, in frames, or inside other objects. A reference held only in a Rust local variable is invisible to the collector. If a collection happens at that moment, the object gets freed while it's still being used.",
          "The simple rule that avoids this: **collect only at the start of an instruction that allocates, before it pops its inputs.** At that moment every live value is on the stack or reachable from it.",
        ],
      },
    ],
    build: {
      intro: "The heap gains marks, a free list and a threshold. The VM gains `collect`, which gathers the roots and asks the heap to mark and sweep.",
      milestone: "long-running loops that create objects run in constant memory, and `--gc-log` shows each collection.",
      steps: [
        {
          section: "Part 1 · Heap bookkeeping",
          title: "Marks, a free list and a threshold",
          body: "**What it's for:** the heap needs three new things. `marks` records which objects were reached. `free` lists slots that were freed and can be reused. `live` and `next_gc` decide when it's time to collect.",
          code: {
            lang: "rust",
            caption: "src/object.rs (Heap changes)",
            code: `#[derive(Default)]
pub struct Heap {
    objects: Vec<Option<Obj>>,
    strings: HashMap<String, ObjRef>,
    marks: Vec<bool>,   // marks[i]: was objects[i] reached in this collection?
    free: Vec<u32>,     // positions of freed slots, ready to reuse
    pub live: usize,    // how many objects exist right now
    pub next_gc: usize, // collect when \`live\` reaches this
}

impl Heap {
    pub fn new() -> Self {
        Heap { next_gc: 1024, ..Default::default() }
    }

    pub fn should_collect(&self) -> bool {
        self.live >= self.next_gc
    }
}`,
          },
          explain: [
            "`..Default::default()` means \"every other field gets its default\" (empty lists, zero).",
            "Use `Heap::new()` in `Vm::new` so the first collection waits until there are 1024 objects.",
          ],
        },
        {
          title: "alloc() reuses freed slots",
          body: "**What it's for:** when a slot has been freed, the next new object goes there instead of growing the list. This keeps references small and the list from growing forever.",
          code: {
            lang: "rust",
            caption: "src/object.rs (Heap changes)",
            code: `impl Heap {
    pub fn alloc(&mut self, obj: Obj) -> ObjRef {
        self.live += 1;
        if let Some(i) = self.free.pop() {
            self.objects[i as usize] = Some(obj); // reuse a freed slot
            return ObjRef(i);
        }
        self.objects.push(Some(obj));
        self.marks.push(false); // keep marks the same length as objects
        ObjRef(self.objects.len() as u32 - 1)
    }
}`,
          },
          explain: ["Reusing a slot is safe because the collector only frees an object when it has proven that nothing reachable still points at it."],
        },
        {
          section: "Part 2 · Mark",
          title: "mark(): follow every reference",
          body: "**What it's for:** starting from the roots, find every object the program can still reach and mark it. For each object, it adds whatever that object points to onto the to-do list. This is the only place that needs to know what each kind of object contains.",
          code: {
            lang: "rust",
            caption: "src/object.rs (continued)",
            code: `impl Heap {
    pub fn mark(&mut self, mut gray: Vec<ObjRef>) {
        while let Some(r) = gray.pop() {
            let i = r.0 as usize;
            if self.marks[i] {
                continue; // already done (this is what stops cycles looping forever)
            }
            self.marks[i] = true;
            // add everything this object points to
            match self.objects[i].as_ref().unwrap() {
                Obj::Str(_) => {} // strings point at nothing
                Obj::Table(fields) => {
                    for (key, value) in fields {
                        gray.push(*key);
                        push_value(&mut gray, *value);
                    }
                }
                Obj::Function(f) => push_consts(&mut gray, &f.chunk),
                Obj::Closure(c) => {
                    push_consts(&mut gray, &c.func.chunk); // its code's constants
                    gray.extend(&c.upvalues);              // and its captured boxes
                }
                Obj::Upvalue(Upvalue::Closed(v)) => push_value(&mut gray, *v),
                Obj::Upvalue(Upvalue::Open(_)) => {} // its value is on the stack, already a root
            }
        }
    }
}`,
          },
          explain: [
            "`gray` is the to-do list. It starts with the roots and shrinks and grows as objects are processed. When it's empty, everything reachable is marked.",
            "Checking `marks[i]` first means each object is processed once, even if it's reachable many ways, and two objects pointing at each other can't loop forever.",
            "If you add a new kind of `Obj` later, this `match` stops compiling until you say what it points to. That's a helpful reminder.",
          ],
        },
        {
          title: "push_value() and push_consts()",
          body: "**What they're for:** two tiny helpers. `push_value` adds a value to the to-do list if it's a reference. `push_consts` does that for every constant in a chunk, because string literals, field names and nested functions all live in constant pools.",
          code: {
            lang: "rust",
            caption: "src/object.rs (continued)",
            code: `fn push_value(gray: &mut Vec<ObjRef>, v: Value) {
    if let Value::Obj(r) = v {
        gray.push(r); // numbers, booleans and nil point at nothing
    }
}

fn push_consts(gray: &mut Vec<ObjRef>, chunk: &Chunk) {
    for &v in &chunk.consts {
        push_value(gray, v);
    }
}`,
          },
          explain: ["Forgetting constants is a classic bug: the string `\"hello\"` from a literal would be freed while the code that prints it is still running."],
        },
        {
          section: "Part 3 · Sweep",
          title: "sweep(): free whatever wasn't marked",
          body: "**What it's for:** walking every slot. Marked objects survive, and their marks are cleared for next time. Unmarked objects are freed and their slots added to the free list. Freed strings are also removed from the intern table.",
          code: {
            lang: "rust",
            caption: "src/object.rs (continued)",
            code: `impl Heap {
    pub fn sweep(&mut self) {
        for i in 0..self.objects.len() {
            if self.marks[i] {
                self.marks[i] = false; // a survivor: reset its mark for the next collection
                continue;
            }
            if let Some(obj) = self.objects[i].take() {
                // unreachable: free it
                if let Obj::Str(s) = obj {
                    self.strings.remove(&s); // don't let the intern table hand it out again
                }
                self.free.push(i as u32);
                self.live -= 1;
            }
        }
        // collect again once the heap has doubled since now
        self.next_gc = (self.live * 2).max(1024);
    }
}`,
          },
          explain: [
            "`take()` removes the object from its slot (leaving `None`), which also drops it and frees its memory.",
            "The intern table must not keep strings alive, or no string would ever be freed. So it isn't a root. Instead, sweeping removes its dead entries. This kind of table is called **weak**.",
            "Doubling the threshold means a program with lots of live data collects less often, so time spent collecting stays in proportion to the program's own work.",
          ],
          jvm: "Java has weak tables too: `WeakHashMap`, and the JVM's own string table, which drops interned strings nothing uses any more.",
        },
        {
          section: "Part 4 · Hook it into the VM",
          title: "collect(): gather the roots, mark, sweep",
          body: "**What it's for:** the VM knows where the roots are, so it builds the starting to-do list: everything on the stack, every global, every running closure, and every open upvalue box. Then the heap marks and sweeps.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    fn collect(&mut self) {
        let before = self.heap.live;
        // 1. ROOTS: what the program can reach without following a reference
        let mut roots = Vec::new();
        for v in self.stack.iter().chain(self.globals.values()) {
            if let Value::Obj(r) = v {
                roots.push(*r);
            }
        }
        for frame in &self.frames {
            roots.push(frame.closure); // running code, and through it its constants
        }
        roots.extend(&self.open_upvalues);
        // 2. MARK everything reachable, 3. SWEEP the rest
        self.heap.mark(roots);
        self.heap.sweep();
        if self.gc_log {
            eprintln!("[gc] {before} -> {} objects, next at {}", self.heap.live, self.heap.next_gc);
        }
    }
}`,
          },
          explain: [
            "`.chain(...)` joins two lists for one loop: the stack values, then the global values.",
            "`gc_log` is a `bool` field on the VM, set from a `--gc-log` flag, so you can watch collections happen.",
          ],
          jvm: "HotSpot finds references in frames using **stack maps**: tables made by the compiler saying which slots hold references at each safepoint. Our stack holds tagged `Value`s, so the collector can just check each one's tag. Simpler, at the cost of some memory.",
        },
        {
          title: "maybe_gc(): collect at safe moments",
          body: "**What it's for:** deciding when to collect. Call it as the **first line** of every instruction that allocates (`Add`, `NewTable`, `Closure`), before the instruction pops anything. At that moment every live value is on the stack.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    fn maybe_gc(&mut self) {
        if self.stress_gc || self.heap.should_collect() {
            self.collect();
        }
    }
}

// the first line of Op::Add, Op::NewTable and Op::Closure:
self.maybe_gc();`,
          },
          explain: [
            "Why before popping? In `Add`, the two strings being joined are still on the stack, so they're roots. If the collection ran after popping them, they'd be unreachable, get freed, and then be read: the classic GC bug.",
            "`stress_gc` (another `bool` field) collects on **every** allocation. Turn it on when running your test scripts: a missing root then fails immediately on a small test, instead of rarely and mysteriously on a big one.",
            "The compiler allocates too, but never triggers a collection, because only `maybe_gc` does. By the time the script runs, everything the compiler made is reachable through the script's constants.",
          ],
        },
        {
          section: "Part 5 · Watch it work",
          title: "Lots of garbage, flat memory",
          body: "This loop creates 100,000 tables but never keeps more than one.",
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
          explain: ["Each table becomes garbage as soon as its loop pass ends. The few survivors are the script's function and closure and the strings `\"n\"` and `\"done\"`. Your exact numbers may differ slightly."],
        },
      ],
    },
    questions: [
      {
        q: "Why not use Rust's `Rc` for everything and skip writing a GC?",
        intuition: "Reference counting can't free cycles. Two tables that point at each other keep each other's count above zero forever, even when nothing else can reach them.",
        technical:
          "Cycles are common in a language with closures and changeable objects, such as an object holding a closure that captured the object. `Rc` would leak them. A tracing collector handles cycles naturally because it asks \"can the program reach this?\", not \"does anything point at it?\". The JVM has never used reference counting for this reason.",
      },
      {
        q: "The program pauses while the GC runs. How do Java collectors avoid long pauses?",
        intuition: "By doing most of the work while the program keeps running, and only pausing briefly to agree on where things are.",
        technical:
          "G1 splits the heap into regions and collects a few at a time, aiming at a pause-time goal. ZGC and Shenandoah mark and move objects while the program runs, using small checks on every reference read to stay consistent, with pauses well under a millisecond. All of it is built on the mark phase you just wrote.",
      },
      {
        q: "What is a generational collector, and would it help Wisp?",
        intuition: "Most objects die young, like the tables in that loop. Checking young objects often and old ones rarely means each collection looks at far fewer objects.",
        technical:
          "New objects go into a small nursery. A minor collection copies the nursery's survivors to the old space and empties the nursery in one step. It also needs a **write barrier**: whenever an old object starts pointing at a young one, record it, so minor collections can treat it as a root. A substantial project, and a great follow-up once mark-sweep is solid.",
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
      "The JVM doesn't load your whole program at startup. It loads each class the first time it's needed: a class loader finds the bytes, the VM links them (checks and prepares them), and then initializes the class by running its static setup code exactly once.",
      "Wisp gets the same lifecycle with one expression, `import \"name\"`. It finds `name.wisp`, compiles it, runs it once with its own set of globals, and returns those globals as a table. That needs one important change: the VM must be able to run Wisp code from *inside* an instruction, which makes the interpreter **re-entrant**.",
    ],
    sim: "modules",
    simTitle: "Load, link and initialize, once",
    jvm: {
      title: "What class loading teaches us",
      points: [
        "**Loading** finds a class's bytes by its name, from a JAR, a folder or the network. Class loaders ask their parent first, so `java.lang.String` always comes from the JDK.",
        "**Linking** checks the bytecode, sets up static fields with default values, and connects names to the things they refer to, either eagerly or on first use.",
        "**Initialization** runs the class's static setup code exactly once, even if several threads race to use the class. Every later use skips straight to the ready class.",
        "A class is identified by its name **plus** its loader, so two loaders can each load their own `com.app.Config`. That's how app servers keep applications apart.",
      ],
    },
    concepts: [
      {
        heading: "Why the VM needs to be re-entrant",
        body: [
          "Until now, `run` was the only loop and it owned the whole program. An import happens in the middle of an instruction, and the module's code has to run to completion before that instruction can push its result. So the `Import` instruction calls back into the interpreter: a second `run` on the same VM, which must stop when the *module* finishes, not when every frame is gone.",
          "The fix is one number. `run(stop_at)` returns when the number of frames drops back to `stop_at`. The script runs with `stop_at = 0`, and a module runs with whatever depth the importer was at. Natives use the same mechanism to call Wisp callbacks.",
        ],
      },
    ],
    build: {
      intro: "A new keyword in the front end, a re-entrant `execute` in the VM, and the import instruction itself.",
      milestone: "`let geo = import \"geometry\"` loads `geometry.wisp` once, and `geo.area(3, 4)` calls into it.",
      steps: [
        {
          section: "Part 1 · The front end",
          title: "Lex and parse the import expression",
          body: "**What it's for:** `import` is an expression, so its result can be stored in any variable. It needs a new keyword, a new AST node, and one new case in the parser's `prefix`.",
          code: {
            lang: "rust",
            caption: "src/lexer.rs, src/ast.rs, src/parser.rs (changes)",
            code: `// lexer.rs: a new keyword
Import,                         // in enum Tok
"import" => Tok::Import,        // in keyword()

// ast.rs: a new expression
Import(String, u32),            // in enum Expr:  import "path"

// parser.rs: a new case in prefix()
Tok::Import => match self.advance() {
    Tok::Str(path) => Expr::Import(path, line),
    _ => return Err(format!("[line {line}] import needs a module name in quotes")),
},`,
          },
        },
        {
          title: "Compile it to one instruction",
          body: "**What it's for:** the compiler puts the module name in the constant pool and emits `Import`, which pushes the module's export table.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs and src/chunk.rs (changes)",
            code: `// compiler.rs, in expr():
Expr::Import(path, line) => {
    self.line = *line;
    let k = self.str_const(path);
    self.emit(Op::Import(k));
}

// chunk.rs, a new variant in Op:
Import(u16), // operand = module-name constant`,
          },
        },
        {
          section: "Part 2 · A re-entrant VM",
          title: "execute(): run a closure to completion",
          body: "**What it's for:** a single way to run Wisp code from Rust, used for the main script and for every module body. It sets up the call exactly like `Call` does, remembers how deep the frame stack was, runs until the call returns, and hands back the result.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    pub fn execute(&mut self, closure: ObjRef) -> Result<Value, String> {
        let func = self.func_of(closure);
        self.push(Value::Obj(closure));  // the callee slot, just like a normal call
        let stop_at = self.frames.len(); // stop when the frame stack is back to this depth
        self.frames.push(CallFrame { closure, func, ip: 0, base: self.stack.len() });
        self.run(stop_at)?;
        Ok(self.pop())                   // Return left the result on the stack
    }
}`,
          },
          explain: [
            "Pushing the closure first gives the frame the same layout as any call: function below, locals from `base`. So `Return` can treat the script like every other function.",
            "`stop_at` is the number of frames that existed *before* this call. When it's reached again, this call has finished.",
          ],
          jvm: "HotSpot does the same whenever VM code needs to run Java code, such as class initialization or `Method.invoke`. Its `JavaCalls::call` sets up a frame and enters the interpreter recursively, so Java and VM frames end up interleaved on one thread's stack.",
        },
        {
          title: "run(stop_at): stop at the right depth",
          body: "**What it's for:** `run` now takes the depth to stop at, and loads its four locals from whatever frame is on top. `Return` checks whether the frame count has dropped back to `stop_at`, which means \"the call that `execute` started is done\".",
          code: {
            lang: "rust",
            caption: "src/vm.rs (changes)",
            code: `impl Vm {
    fn run(&mut self, stop_at: usize) -> Result<(), String> {
        // pick up wherever the top frame is
        let top = self.frames.last().unwrap();
        let (mut closure, mut func, mut ip, mut base) = (top.closure, top.func.clone(), top.ip, top.base);
        loop {
            // ...fetch and match exactly as before, except Return:
            Op::Return => {
                let result = self.pop();
                self.close_upvalues(base);
                self.frames.pop();
                self.stack.truncate(base - 1);
                self.push(result);
                if self.frames.len() == stop_at {
                    return Ok(()); // the call execute() started has finished
                }
                // otherwise switch back to the caller, as before
            }
        }
    }
}

// main.rs: the script is just the first thing we execute
let script = compiler::compile(&program, &mut vm.heap)?;
let closure = vm.new_closure(script);
vm.execute(closure)?;`,
          },
          explain: [
            "Each nested `run` has its own Rust local variables (`func`, `ip`...). When the inner one returns, the outer one carries on exactly where it was. Rust's own call stack keeps track of the nesting for us.",
          ],
        },
        {
          section: "Part 3 · The import instruction",
          title: "Arm: Import, with a cache",
          body: "**What it does:** checks whether the module was already loaded and, if so, reuses its export table. Otherwise it saves `ip` (because other code is about to run), loads the module, and remembers the result for next time.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `// new Vm fields:
//   modules: HashMap<String, Value>,        // module name -> export table (each loaded once)
//   suspended: Vec<HashMap<String, Value>>, // importers' globals while a module runs
// collect() adds the values of both to its roots.

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
                }`,
          },
        },
        {
          title: "load_module(): load, link, initialize, export",
          body: "**What it's for:** the four stages of bringing a module in. Read its file, compile it with the normal pipeline, run its code once against an empty set of globals, then turn whatever globals it defined into a table.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `impl Vm {
    fn load_module(&mut self, name: &str) -> Result<Value, String> {
        // 1. LOAD: find the source. Our "classpath" is just the current folder.
        let source = std::fs::read_to_string(format!("{name}.wisp"))
            .map_err(|e| format!("cannot import '{name}': {e}"))?;
        // 2. LINK: compile it with the same pipeline as the main script
        let program = parser::parse(lexer::lex(&source)?)?;
        let func = compiler::compile(&program, &mut self.heap)?;
        let closure = self.new_closure(func);
        // 3. INITIALIZE: run it once, with fresh empty globals
        let importer = std::mem::take(&mut self.globals);
        self.suspended.push(importer); // the GC can still see the importer's globals
        let result = self.execute(closure);
        let module_globals = std::mem::replace(&mut self.globals, self.suspended.pop().unwrap());
        result?;
        // 4. EXPORT: the module's globals become one table
        let mut table = HashMap::new();
        for (name, value) in module_globals {
            table.insert(self.heap.intern(&name), value);
        }
        Ok(Value::Obj(self.heap.alloc(Obj::Table(table))))
    }
}`,
          },
          explain: [
            "`mem::take` swaps in an empty map and hands back the old one, so the module can't see or change the importer's globals. `mem::replace` swaps them back afterwards.",
            "The importer's globals are parked in `self.suspended` instead of a plain Rust variable, so a collection while the module runs still sees them as roots. That's the GC rule from lesson 09: live values must be somewhere the collector looks.",
            "`result?` comes *after* the globals are restored, so even a failing module leaves the importer's state intact.",
            "Circular imports (A imports B, which imports A) would loop forever here. Put a placeholder in `modules` before loading, and report an error if an import finds it.",
          ],
        },
        {
          section: "Part 4 · Try it",
          title: "Two files",
          body: "Put both files in the same folder and run `main.wisp`.",
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
            "\"geometry loaded\" prints once even though the module is imported twice. The second import hits the cache, which is the same once-only rule as Java's class initialization.",
            "`geo.area(3, 4)` is a field read followed by an ordinary call. The closure was made inside the module and carries its own constants, so it works anywhere.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why run a module only once?",
        intuition: "A module sets things up: functions, constants, maybe a cache. Running it again would reset that state and repeat any side effects, like printing or opening files.",
        technical:
          "Run-once makes a module's top level behave like a setup function that runs a single time, which is exactly what the JVM guarantees for static initialization. The JVM also makes it thread-safe: a second thread waits until the first has finished. If you add real threads to Wisp, the module cache needs the same lock.",
      },
      {
        q: "Should Wisp cache compiled modules on disk, like `.class` files or Python's `.pyc`?",
        intuition: "It saves recompiling unchanged files at startup. For small scripts compiling is already fast, so only bother when startup time matters.",
        technical:
          "Save each `Function` (constants, code, lines, capture lists) with a magic number and a version, plus the source file's modification time so a stale cache is ignored. Loading saved bytecode also means you should check it before trusting it, which is the job of the JVM's verifier.",
      },
      {
        q: "How would I let modules import from other folders?",
        intuition: "Keep a list of folders to search, like Java's classpath, and try each one in order.",
        technical:
          "Add `search_path: Vec<PathBuf>` with the standard library's folder first, then the script's folder, then anything from a `WISP_PATH` environment variable. Searching the standard library first mirrors Java's parent-first class loading: user code can't accidentally replace a core module.",
      },
    ],
    references: [
      { title: "JVM Specification: Loading, Linking, and Initializing", by: "Oracle", url: "https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-5.html", kind: "spec", note: "Chapter 5: the exact rules the JVM follows, including initialization locking." },
    ],
  },
];
