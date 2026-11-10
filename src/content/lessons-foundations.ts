import type { Lesson, Reference } from "./types";

const ci = (title: string, page: string, note?: string): Reference => ({
  title: `Crafting Interpreters: ${title}`,
  by: "Robert Nystrom",
  url: `https://craftinginterpreters.com/${page}.html`,
  kind: "book",
  note,
});

const jvms = (title: string, page: string, note?: string): Reference => ({
  title: `JVM Specification: ${title}`,
  by: "Oracle",
  url: `https://docs.oracle.com/javase/specs/jvms/se21/html/${page}`,
  kind: "spec",
  note,
});

export const foundationLessons: Lesson[] = [
  /* ───────────────────────────── 00 · How code runs ───────────────────────────── */
  {
    slug: "how-code-runs",
    title: "How Code Runs",
    level: "Foundational",
    accent: "blue",
    icon: "Play",
    summary: "See the path from source text to a running program, the way the JVM does it, and set up the Rust project you'll grow lesson by lesson.",
    tags: ["Source → Bytecode → VM", "javac vs JVM", "Project setup", "Key words"],
    intro: [
      "Java never runs your source code directly. `javac` turns `.java` files into `.class` files full of **bytecode**, a list of small, simple instructions, and the JVM runs that bytecode. Bytecode is the agreement between the two halves. The compiler only has to produce it, and the VM only has to run it.",
      "In this course you'll build the same split, in Rust, for a tiny scripting language called **Wisp**. Wisp has numbers, strings, tables, functions and closures, but no classes. Every lesson adds one working piece to one growing project. The code comes in small pieces, and each piece says what it's for in plain English before showing any Rust.",
    ],
    sim: "pipeline",
    simTitle: "Step a tiny Wisp program through every stage",
    jvm: {
      title: "What the JVM teaches us",
      points: [
        "`javac` and the JVM are separate programs that only talk through the class-file format. That's why Kotlin, Scala and Clojure can run on the JVM too: they produce the same format.",
        "The JVM starts by **interpreting** bytecode: reading one instruction at a time and doing what it says. Later it compiles busy code to machine code (the JIT). We'll build the interpreter, which every VM needs first.",
        "A `.class` file holds a **constant pool** (numbers, strings and names the code uses), the bytecode of each method, and a table of line numbers. Your compiled Wisp functions will hold the same three things.",
        "The JVM is a **stack machine**. Instructions take their inputs from a stack of values and put their results back on it. Wisp's VM works the same way.",
      ],
    },
    concepts: [
      {
        heading: "A few words you'll see a lot",
        body: [
          "**Token**: one \"word\" of source code, such as `let`, `x`, `=` or `42`. **AST** (abstract syntax tree): the program as a tree, so `1 + 2 * 3` becomes \"add 1 to (multiply 2 by 3)\". **Bytecode**: the program as a flat list of simple instructions. **Opcode**: the name of one instruction, such as `Add`. **Operand**: extra data an instruction carries, such as *which* constant to load.",
          "**Stack**: a pile of values where you add and remove at the top only. **Frame**: the bookkeeping for one function call that's in progress. **Heap**: memory for things that outlive a single instruction, like strings and objects. Don't memorise these now. Each one gets its own lesson.",
        ],
      },
      {
        heading: "Look at real JVM bytecode first",
        body: [
          "Compile a tiny Java method and print its bytecode with `javap -c`. There are four instructions: two put the arguments on the stack, one adds the top two values, and one returns the result. By lesson 07, your VM runs almost exactly this sequence.",
        ],
        code: {
          lang: "text",
          caption: "javap -c Add.class",
          code: `static int add(int, int);
  Code:
     0: iload_0      // push local 0 (a)
     1: iload_1      // push local 1 (b)
     2: iadd         // pop two ints, push their sum
     3: ireturn      // return the top of the stack`,
        },
      },
      {
        heading: "Why compile to bytecode instead of walking the tree?",
        body: [
          "The simplest interpreter walks the syntax tree: look at a node, work out its children, combine them. It's easy to write but slow, because the nodes are scattered around memory and every step follows a pointer to the next one.",
          "Bytecode flattens the tree into one list. Running it is a loop: read the next instruction, do it, repeat. That loop is short and predictable, so it usually runs several times faster than a tree walker. It's the same reason the JVM doesn't run Java syntax trees.",
        ],
      },
      {
        heading: "The Wisp language in one screen",
        body: ["Wisp is small on purpose. There are no classes. Objects are plain **tables** of fields, and behaviour comes from functions and closures. This program uses most of what the course builds."],
        code: {
          lang: "wisp",
          caption: "everything.wisp",
          code: `let greeting = "hello, " + "wisp"
print greeting

fn fib(n) {
  if n < 2 { return n }
  return fib(n - 1) + fib(n - 2)
}
print fib(20)

fn make_counter() {
  let count = 0
  return fn() { count = count + 1  return count }
}
let next = make_counter()
next()
print next()

let point = { x: 3, y: 4 }
point.x = 10
print point.x + point.y`,
        },
      },
    ],
    build: {
      intro: "Set up the project and the pipeline. Some stages stay empty for a few lessons, and that's fine. A skeleton that compiles early makes every later lesson a small, testable step.",
      milestone: "a Rust project called `wisp` that reads a `.wisp` file and passes it through four stages: lex, parse, compile, run.",
      steps: [
        {
          title: "Create the project and one file per stage",
          body: "**What this is for:** keeping each stage in its own file, so every lesson's changes land in one obvious place. Run these commands to create the empty files now.",
          code: {
            lang: "text",
            caption: "terminal",
            code: `cargo new wisp
cd wisp
touch src/lexer.rs src/ast.rs src/parser.rs     // lesson 02: text -> tree
touch src/value.rs src/chunk.rs                 // lesson 03: the bytecode format
touch src/vm.rs                                 // lesson 04: runs bytecode
touch src/compiler.rs                           // lesson 05: tree -> bytecode
touch src/object.rs                             // lesson 06: heap objects`,
          },
          explain: [
            "`cargo new` creates a Rust project with a `src/main.rs`. The other files start empty and fill up lesson by lesson.",
            "The course uses only Rust's standard library, so there's no hidden code: you write every line that runs.",
          ],
        },
        {
          title: "main(): read the file you're asked to run",
          body: "**What it's for:** the entry point. When you type `wisp hello.wisp`, `main` finds the file name, reads the file into a string, and hands it to `run`. If anything goes wrong, it prints the error and exits.",
          code: {
            lang: "rust",
            caption: "src/main.rs",
            code: `mod ast;
mod chunk;
mod compiler;
mod lexer;
mod object;
mod parser;
mod value;
mod vm;

use std::{env, fs, process};

fn main() {
    // Usage: wisp path/to/script.wisp
    let Some(path) = env::args().nth(1) else {
        eprintln!("usage: wisp <file.wisp>");
        process::exit(64);
    };
    let source = fs::read_to_string(&path).expect("could not read the file");

    if let Err(message) = run(&source) {
        eprintln!("{message}");
        process::exit(70);
    }
}`,
          },
          explain: [
            "The `mod` lines tell Rust that each file in `src/` is part of the program.",
            "`env::args().nth(1)` is the first word typed after the program name. If it's missing, the `else` block prints how to use the program and stops.",
            "`fs::read_to_string` loads the whole file into one `String`.",
            "`run` returns either success or an error message. `if let Err(message)` handles only the error case: print it to the error stream and exit with a non-zero code, so other programs can tell that something failed.",
          ],
        },
        {
          title: "run(): the whole pipeline in four lines",
          body: "**What it's for:** connecting the four stages in order. Each stage takes the previous stage's output and produces the next one's input. The `?` after each call means \"if this stage failed, stop here and return its error\".",
          code: {
            lang: "rust",
            caption: "src/main.rs (continued)",
            code: `/// Every stage returns Result<_, String>, so \`?\` stops at the first error.
fn run(source: &str) -> Result<(), String> {
    let tokens = lexer::lex(source)?;          // "let x = 1"  ->  [Let, Ident(x), Eq, Num(1)]
    let program = parser::parse(tokens)?;      // tokens       ->  a tree of statements
    let chunk = compiler::compile(&program)?;  // tree         ->  bytecode
    vm::Vm::new().run(&chunk)                  // bytecode     ->  the program runs
}`,
          },
          explain: [
            "**Lexer**: turns raw text into a list of tokens (lesson 02).",
            "**Parser**: arranges the tokens into a tree that shows what belongs to what (lesson 02).",
            "**Compiler**: walks the tree and writes bytecode instructions (lesson 05).",
            "**VM**: runs the instructions one by one (lesson 04).",
            "Errors are plain strings that already contain a line number, like `[line 3] unexpected ')'`. That keeps every function signature short.",
          ],
          jvm: "`java Main` does the last stage only. The class loader reads `Main.class`, the verifier checks it, and the interpreter starts running `main`. The first three stages already happened earlier, when you ran `javac`.",
        },
        {
          title: "Add the test script you'll grow into",
          body: "Save the Wisp program above as `everything.wisp`. It won't run yet. Each lesson makes more of it work, and by lesson 08 the whole file runs.",
          explain: [
            "Write a one-line `.wisp` script for each feature as you add it, too. A folder of tiny scripts plus their expected output is the simplest test suite a VM can have, and real VMs are tested much the same way.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "If the syntax tree already describes the program, why add bytecode at all?",
        intuition: "A recipe written as a family tree of sub-recipes is complete but awkward to follow while you cook. Bytecode is the same recipe rewritten as a numbered checklist you read from top to bottom.",
        technical:
          "Walking a tree costs a branch and a pointer chase per node, and the nodes are scattered across memory. Bytecode is one contiguous array, so each step is an index and a jump. The array also gives you natural places to store jump targets, line numbers and caches.",
      },
      {
        q: "What makes Java portable: the language or the VM?",
        intuition: "The bytecode. Think of it as a standard plug shape. Every operating system gets its own native JVM, an adapter that accepts that plug.",
        technical:
          "The JVM Specification fixes the class-file format and the meaning of every instruction, down to byte order and integer sizes. Any program that writes valid class files, in any language, runs on any conforming JVM.",
      },
      {
        q: "Is Java compiled or interpreted?",
        intuition: "Both. It's compiled once for portability (source to bytecode), interpreted at first, and then compiled again for speed (bytecode to machine code) for the parts that run often.",
        technical:
          "`javac` compiles to bytecode ahead of time. At runtime HotSpot interprets first and profiles as it goes, then the C1 and C2 JIT compilers turn hot methods into native code. Our VM stops at the interpreter, and lesson 13 explains what comes after it.",
      },
    ],
    references: [
      ci("A Bytecode Virtual Machine", "a-bytecode-virtual-machine", "The best free book on this exact topic. Its C VM, clox, inspired much of Wisp's design."),
      jvms("The Structure of the JVM", "jvms-2.html", "Chapter 2: the runtime data areas, frames and the instruction set at a glance."),
    ],
  },

  /* ───────────────────────────── 02 · Front end (quickshot) ───────────────────────────── */
  {
    slug: "front-end",
    title: "Lexer & Parser, Fast",
    level: "Foundational",
    accent: "violet",
    icon: "Braces",
    summary: "A quick, complete lexer and Pratt parser that turn Wisp source into a syntax tree, explained one small function at a time, with links to longer videos.",
    tags: ["Tokens", "Pratt parsing", "AST", "Quickshot"],
    intro: [
      "Before there's any bytecode, text has to become structure. This part of the course is deliberately short, because lexers and parsers are covered very well elsewhere. If this is your first one, the videos below are worth watching. Here you get a small, complete front end, explained one function at a time, so you can understand it, copy it and move on.",
      "Everything after this lesson only needs the output: a list of statements in a tree shape, the **AST**. That's where the VM part of the course really starts.",
    ],
    references: [
      {
        title: "Implementing a Lox interpreter in Rust",
        by: "Jon Gjengset",
        url: "https://youtu.be/mNOLaw-_Buc",
        kind: "video",
        note: "A long live-coding session that builds a lexer and parser in idiomatic Rust, with lots of commentary on why.",
      },
      {
        title: "Build a Custom Scripting Language in TypeScript",
        by: "tylerlaceby",
        url: "https://youtube.com/playlist?list=PL_2VhOvlMk4UHGqYCLWc6GO8FaPl8fQTh",
        kind: "playlist",
        note: "A beginner-friendly series: tokens, the AST and parsing explained step by step. The ideas carry straight over to Rust.",
      },
      {
        title: "Simple but Powerful Pratt Parsing",
        by: "Alex Kladov (matklad)",
        url: "https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html",
        kind: "article",
        note: "The clearest explanation of the operator-precedence loop used below, written in Rust.",
      },
      ci("Scanning", "scanning", "A gentle chapter on lexers, if you prefer reading."),
    ],
    sim: "flow",
    simTitle: "The front-end pipeline",
    flow: [
      { label: "Source", sub: "let x = 1 + 2 * 3" },
      { label: "Tokens", sub: "Let Ident Eq Num Plus…" },
      { label: "AST", sub: "Let(x, Add(1, Mul(2,3)))" },
      { label: "Compiler", sub: "next lessons" },
    ],
    jvm: {
      title: "What javac teaches us",
      points: [
        "`javac` runs the same stages: scan characters into tokens, parse the tokens into a tree, then check, simplify and generate bytecode. The JVM never sees any of it, only the finished class file.",
        "Tokens remember which line they came from. Those line numbers end up in the class file's `LineNumberTable`, which is why Java stack traces can show line numbers.",
        "Java's parser is hand-written recursive descent with precedence rules, like ours. Java's grammar is much bigger, but the technique is the same.",
      ],
    },
    concepts: [
      {
        heading: "The whole idea in two sentences",
        body: [
          "The **lexer** groups characters into words: `let`, `x`, `=`, `1`. The **parser** groups words into a tree that captures meaning, so `1 + 2 * 3` becomes `Add(1, Mul(2, 3))` because `*` binds tighter than `+`.",
          "The only tricky part is precedence (which operator goes first), and the parser below solves it with one number per operator, its **binding power**. Higher numbers bind tighter.",
        ],
      },
    ],
    build: {
      intro: "Three files, each built from small functions. Read the plain-English summary first, then the code, then the walkthrough.",
      milestone: "`parser::parse(lexer::lex(src)?)` returns the syntax tree for any Wisp program in this course.",
      steps: [
        {
          section: "Part 1 · The lexer",
          title: "The kinds of token",
          body: "**What it's for:** naming every kind of \"word\" Wisp has. A `Tok` is one of these kinds. Numbers, strings and names also carry their actual value. A `Token` is a `Tok` plus the line it was found on, so errors can say where they happened.",
          code: {
            lang: "rust",
            caption: "src/lexer.rs",
            code: `#[derive(Debug, Clone, PartialEq)]
pub enum Tok {
    // values written directly in the source
    Num(f64), Str(String), Ident(String),
    // keywords
    Let, Fn, Return, If, Else, While, Print, And, Or, True, False, Nil,
    // punctuation and operators
    LParen, RParen, LBrace, RBrace, Comma, Dot, Colon,
    Plus, Minus, Star, Slash, Bang, Eq, EqEq, BangEq, Lt, LtEq, Gt, GtEq,
    Eof, // "end of input", so the parser always has something to look at
}

#[derive(Debug, Clone)]
pub struct Token {
    pub tok: Tok,
    pub line: u32,
}`,
          },
          explain: [
            "An `enum` is a type that is exactly one of a fixed list of options. `Tok::Plus` is one option, and `Tok::Num(3.0)` is an option that carries a number.",
            "`#[derive(...)]` asks Rust to write some common code for us: `Debug` lets us print a token, `Clone` lets us copy one, and `PartialEq` lets us compare two with `==`.",
            "`Eof` is a fake token added at the end. With it, the parser can always ask \"what's next?\" without checking whether it has run out.",
          ],
        },
        {
          title: "The Lexer struct and lex()",
          body: "**What it's for:** `Lexer` remembers where we are in the source: the characters, the position of the next one, and the current line. `lex` is the function the rest of the program calls. It asks for tokens one at a time until there are none left, then adds `Eof`.",
          code: {
            lang: "rust",
            caption: "src/lexer.rs (continued)",
            code: `struct Lexer {
    chars: Vec<char>, // the source, one character per slot, so we can index it
    pos: usize,       // index of the next character to read
    line: u32,        // the line we're on, counted as we pass newlines
}

pub fn lex(src: &str) -> Result<Vec<Token>, String> {
    let mut lexer = Lexer { chars: src.chars().collect(), pos: 0, line: 1 };
    let mut tokens = Vec::new();
    while let Some(token) = lexer.next_token()? {
        tokens.push(token);
    }
    tokens.push(Token { tok: Tok::Eof, line: lexer.line });
    Ok(tokens)
}`,
          },
          explain: [
            "`src.chars().collect()` turns the text into a `Vec<char>`, so we can look at any character by its position, as in `chars[5]`.",
            "`next_token` (two steps down) returns `Some(token)` while there's more to read and `None` at the end. `while let Some(token) = ...` keeps looping while it gets `Some`.",
            "The `?` passes any error straight back to whoever called `lex`, such as an unterminated string.",
          ],
        },
        {
          title: "Small helpers for reading characters",
          body: "**What they're for:** every other lexer function reads characters through these four helpers, so none of them needs to worry about running past the end of the text.",
          code: {
            lang: "rust",
            caption: "src/lexer.rs (continued)",
            code: `impl Lexer {
    /// The current character, without moving past it. '\\0' means "end of input".
    fn peek(&self) -> char {
        self.chars.get(self.pos).copied().unwrap_or('\\0')
    }

    /// Move past the current character and return it.
    fn advance(&mut self) -> char {
        let c = self.peek();
        self.pos += 1;
        c
    }

    /// If the current character is \`expected\`, step past it and say yes.
    fn matches(&mut self, expected: char) -> bool {
        if self.peek() == expected {
            self.pos += 1;
            true
        } else {
            false
        }
    }

    /// Skip spaces, tabs, newlines and # comments, counting lines as we go.
    fn skip_whitespace(&mut self) {
        loop {
            match self.peek() {
                ' ' | '\\t' | '\\r' => self.pos += 1,
                '\\n' => {
                    self.line += 1;
                    self.pos += 1;
                }
                '#' => {
                    while self.peek() != '\\n' && self.peek() != '\\0' {
                        self.pos += 1;
                    }
                }
                _ => return, // something that isn't whitespace: stop skipping
            }
        }
    }
}`,
          },
          explain: [
            "`peek` is like looking at the next word in a book without turning the page. `.get(pos)` returns nothing past the end instead of crashing, and `unwrap_or('\\0')` turns that into a special \"end\" character.",
            "`advance` reads the character and moves forward one place, like turning the page.",
            "`matches` handles two-character operators. After seeing `=`, ask \"is the next one also `=`?\" If so, it's `==`.",
            "`skip_whitespace` throws away anything that isn't part of a token. In Wisp, `#` starts a comment that lasts to the end of the line.",
          ],
        },
        {
          title: "next_token(): decide what the next token is",
          body: "**What it's for:** this is the heart of the lexer. It skips whitespace, looks at one character, and decides which kind of token starts there. Single characters like `(` are done immediately. Strings, numbers and words are handed to their own helper.",
          code: {
            lang: "rust",
            caption: "src/lexer.rs (continued)",
            code: `impl Lexer {
    fn next_token(&mut self) -> Result<Option<Token>, String> {
        self.skip_whitespace();
        let line = self.line; // remember where this token starts
        if self.peek() == '\\0' {
            return Ok(None); // nothing left
        }
        let tok = match self.advance() {
            '(' => Tok::LParen, ')' => Tok::RParen,
            '{' => Tok::LBrace, '}' => Tok::RBrace,
            ',' => Tok::Comma, '.' => Tok::Dot, ':' => Tok::Colon,
            '+' => Tok::Plus, '-' => Tok::Minus, '*' => Tok::Star, '/' => Tok::Slash,
            // one or two characters: = or ==, ! or !=, < or <=, > or >=
            '=' => if self.matches('=') { Tok::EqEq } else { Tok::Eq },
            '!' => if self.matches('=') { Tok::BangEq } else { Tok::Bang },
            '<' => if self.matches('=') { Tok::LtEq } else { Tok::Lt },
            '>' => if self.matches('=') { Tok::GtEq } else { Tok::Gt },
            // longer tokens get their own helper
            '"' => self.string()?,
            c if c.is_ascii_digit() => self.number()?,
            c if c.is_alphabetic() || c == '_' => self.word(),
            other => return Err(format!("[line {line}] unexpected character '{other}'")),
        };
        Ok(Some(Token { tok, line }))
    }
}`,
          },
          explain: [
            "`match self.advance()` reads one character and compares it with each pattern in turn. The first one that fits wins.",
            "`c if c.is_ascii_digit()` is a pattern with a condition: it matches any character for which the condition is true.",
            "Anything not listed, like `@`, reaches the last arm and becomes an error that names the line.",
            "The result is wrapped as `Ok(Some(token))`: no error, and here's a token.",
          ],
        },
        {
          title: "string(), number() and word(): the longer tokens",
          body: "**What they're for:** each one is called after the first character has already been read, and keeps reading until its token ends. Then it slices that stretch of text out of the source.",
          code: {
            lang: "rust",
            caption: "src/lexer.rs (continued)",
            code: `impl Lexer {
    /// "hello": the opening quote has already been read.
    fn string(&mut self) -> Result<Tok, String> {
        let start = self.pos;
        while self.peek() != '"' {
            if self.peek() == '\\0' {
                return Err(format!("[line {}] unterminated string", self.line));
            }
            if self.peek() == '\\n' {
                self.line += 1; // strings may span lines
            }
            self.pos += 1;
        }
        let text: String = self.chars[start..self.pos].iter().collect();
        self.pos += 1; // step over the closing quote
        Ok(Tok::Str(text))
    }

    /// 42 or 3.14: the first digit has already been read.
    fn number(&mut self) -> Result<Tok, String> {
        let start = self.pos - 1;
        while self.peek().is_ascii_digit() || self.peek() == '.' {
            self.pos += 1;
        }
        let text: String = self.chars[start..self.pos].iter().collect();
        text.parse().map(Tok::Num).map_err(|_| format!("[line {}] bad number '{text}'", self.line))
    }

    /// A name like \`count\` or a keyword like \`while\`: the first letter has been read.
    fn word(&mut self) -> Tok {
        let start = self.pos - 1;
        while self.peek().is_alphanumeric() || self.peek() == '_' {
            self.pos += 1;
        }
        let word: String = self.chars[start..self.pos].iter().collect();
        keyword(&word).unwrap_or(Tok::Ident(word))
    }
}`,
          },
          explain: [
            "All three follow the same pattern: remember where the token **starts**, keep moving while the characters still belong to it, then collect `chars[start..pos]` into a `String`.",
            "`number` starts at `pos - 1` because its first digit was already consumed by `next_token`. `string` starts at `pos` because we don't want the opening quote in the text.",
            "`text.parse()` turns `\"3.14\"` into the number `3.14`. If the text is something like `1.2.3`, parsing fails and we report a bad number.",
            "`word` reads a whole name, then asks `keyword` whether it's a reserved word. If not, it's an identifier (a variable or function name).",
          ],
        },
        {
          title: "keyword(): reserved words",
          body: "**What it's for:** telling keywords apart from ordinary names. Keywords are read exactly like names, then looked up here.",
          code: {
            lang: "rust",
            caption: "src/lexer.rs (continued)",
            code: `fn keyword(word: &str) -> Option<Tok> {
    Some(match word {
        "let" => Tok::Let, "fn" => Tok::Fn, "return" => Tok::Return,
        "if" => Tok::If, "else" => Tok::Else, "while" => Tok::While,
        "print" => Tok::Print, "and" => Tok::And, "or" => Tok::Or,
        "true" => Tok::True, "false" => Tok::False, "nil" => Tok::Nil,
        _ => return None, // not a keyword
    })
}`,
          },
          explain: ["`Option<Tok>` means \"maybe a token\": `Some(Tok::Let)` for `let`, or `None` for something like `count`."],
        },
        {
          section: "Part 2 · The syntax tree",
          title: "The AST: two enums",
          body: "**What it's for:** describing the shape of a program. An `Expr` (expression) is anything that produces a value, like `1 + 2` or `f(x)`. A `Stmt` (statement) is an action, like `let x = 1` or `while ...`. Some variants are only used in later lessons. They're defined now so the parser never has to change.",
          code: {
            lang: "rust",
            caption: "src/ast.rs",
            code: `use crate::lexer::Tok;

#[derive(Debug)]
pub enum Expr {
    Num(f64),
    Str(String),
    Bool(bool),
    Nil,
    Var(String, u32),                        // x
    Assign(String, Box<Expr>, u32),          // x = value
    Unary(Tok, Box<Expr>, u32),              // -x   !x
    Binary(Box<Expr>, Tok, Box<Expr>, u32),  // a + b   a < b
    Logical(Box<Expr>, Tok, Box<Expr>),      // a and b   a or b
    Call(Box<Expr>, Vec<Expr>, u32),         // f(a, b)
    Lambda(Vec<String>, Vec<Stmt>),          // fn(a) { ... }       (lesson 08)
    Table(Vec<(String, Expr)>),              // { x: 1, y: 2 }      (lesson 06)
    Get(Box<Expr>, String, u32),             // obj.field
    Set(Box<Expr>, String, Box<Expr>, u32),  // obj.field = value
}

#[derive(Debug)]
pub enum Stmt {
    Let(String, Expr),                       // let x = expr
    Expr(Expr),                              // f(x)  (the value is thrown away)
    Print(Expr),                             // print expr
    Block(Vec<Stmt>),                        // { ... }
    If(Expr, Vec<Stmt>, Option<Vec<Stmt>>),  // if c { } else { }
    While(Expr, Vec<Stmt>),                  // while c { }
    Fn(String, Vec<String>, Vec<Stmt>),      // fn name(a, b) { }   (lesson 07)
    Return(Option<Expr>),                    // return expr
}`,
          },
          explain: [
            "Each variant is one kind of node. `Binary(left, op, right, line)` holds an operator and the two expressions on either side of it.",
            "`Box<Expr>` is needed when an expression contains another expression. Rust needs to know the size of every type, and a box is always pointer-sized, whatever is inside it.",
            "The `u32` on some variants is the source line. Only nodes that can fail while running keep one, so error messages can point at the right line.",
          ],
        },
        {
          section: "Part 3 · The parser",
          title: "The Parser struct and parse()",
          body: "**What it's for:** `Parser` holds the token list and a position in it. `parse` is the function the rest of the program calls: it reads statements until it reaches `Eof`.",
          code: {
            lang: "rust",
            caption: "src/parser.rs",
            code: `use crate::ast::{Expr, Stmt};
use crate::lexer::{Tok, Token};

struct Parser {
    tokens: Vec<Token>,
    pos: usize, // index of the next token to read
}

pub fn parse(tokens: Vec<Token>) -> Result<Vec<Stmt>, String> {
    let mut parser = Parser { tokens, pos: 0 };
    let mut program = Vec::new();
    while *parser.peek() != Tok::Eof {
        program.push(parser.statement()?);
    }
    Ok(program)
}`,
          },
          explain: [
            "A program is just a list of statements, so `parse` returns `Vec<Stmt>`.",
            "`*parser.peek()` reads the current token. The `*` is there because `peek` returns a reference, and we compare the token itself.",
          ],
        },
        {
          title: "Parser helpers: look, step, check",
          body: "**What they're for:** the same job as the lexer's helpers, one level up. They look at tokens instead of characters, and they produce helpful error messages when something expected is missing.",
          code: {
            lang: "rust",
            caption: "src/parser.rs (continued)",
            code: `impl Parser {
    /// The current token, without moving past it.
    fn peek(&self) -> &Tok {
        &self.tokens[self.pos].tok
    }

    /// The line of the current token, for error messages.
    fn line(&self) -> u32 {
        self.tokens[self.pos].line
    }

    /// Move past the current token and return it (never past Eof).
    fn advance(&mut self) -> Tok {
        let t = self.tokens[self.pos].tok.clone();
        if t != Tok::Eof {
            self.pos += 1;
        }
        t
    }

    /// If the current token is \`t\`, step past it and say yes.
    fn eat(&mut self, t: Tok) -> bool {
        if *self.peek() == t {
            self.pos += 1;
            true
        } else {
            false
        }
    }

    /// Like eat(), but a missing token is an error: "expected ')'".
    fn expect(&mut self, t: Tok, what: &str) -> Result<(), String> {
        if self.eat(t) { Ok(()) } else { Err(format!("[line {}] expected {what}", self.line())) }
    }

    /// Read a name (identifier) or fail.
    fn name(&mut self) -> Result<String, String> {
        match self.advance() {
            Tok::Ident(n) => Ok(n),
            _ => Err(format!("[line {}] expected a name", self.line())),
        }
    }
}`,
          },
          explain: [
            "`advance` never moves past `Eof`, so a parser that tries to read too far just keeps seeing `Eof` instead of crashing.",
            "`eat` is for optional tokens, such as the comma between arguments. `expect` is for required ones, such as the `)` that must close a call.",
          ],
        },
        {
          title: "statement(): which kind of statement is this?",
          body: "**What it's for:** looking at the first token of a statement and choosing the right rule. `let` starts a variable declaration, `while` starts a loop, and so on. If no keyword matches, the statement is an expression on its own, like `f(x)`.",
          code: {
            lang: "rust",
            caption: "src/parser.rs (continued)",
            code: `impl Parser {
    fn statement(&mut self) -> Result<Stmt, String> {
        match self.peek() {
            Tok::Let => {
                self.advance(); // 'let'
                let name = self.name()?;
                self.expect(Tok::Eq, "'='")?;
                Ok(Stmt::Let(name, self.expr(0)?))
            }
            Tok::Print => {
                self.advance();
                Ok(Stmt::Print(self.expr(0)?))
            }
            Tok::LBrace => Ok(Stmt::Block(self.block()?)),
            Tok::If => self.if_stmt(),
            Tok::While => {
                self.advance();
                let cond = self.expr(0)?;
                Ok(Stmt::While(cond, self.block()?))
            }
            Tok::Fn => {
                self.advance();
                let name = self.name()?;
                let (params, body) = self.fn_rest()?;
                Ok(Stmt::Fn(name, params, body))
            }
            Tok::Return => {
                self.advance();
                // \`return\` right before \`}\` has no value: it returns nil
                let value = if *self.peek() == Tok::RBrace { None } else { Some(self.expr(0)?) };
                Ok(Stmt::Return(value))
            }
            _ => Ok(Stmt::Expr(self.expr(0)?)),
        }
    }
}`,
          },
          explain: [
            "Each arm reads the tokens of its statement in the order they appear in the source. `let x = 1` is: `let`, a name, `=`, an expression.",
            "`self.expr(0)` parses an expression. The `0` means \"accept any operator\", which is explained in the Pratt parser step below.",
          ],
        },
        {
          title: "block(), if_stmt() and fn_rest(): the bracketed parts",
          body: "**What they're for:** `block` reads `{ statement statement ... }`. `if_stmt` reads an `if`, its block, and an optional `else`. `fn_rest` reads a function's `(parameters) { body }`, which is shared by named and anonymous functions.",
          code: {
            lang: "rust",
            caption: "src/parser.rs (continued)",
            code: `impl Parser {
    fn block(&mut self) -> Result<Vec<Stmt>, String> {
        self.expect(Tok::LBrace, "'{'")?;
        let mut body = Vec::new();
        while *self.peek() != Tok::RBrace && *self.peek() != Tok::Eof {
            body.push(self.statement()?);
        }
        self.expect(Tok::RBrace, "'}'")?;
        Ok(body)
    }

    fn if_stmt(&mut self) -> Result<Stmt, String> {
        self.advance(); // 'if'
        let cond = self.expr(0)?;
        let then = self.block()?;
        let otherwise = if self.eat(Tok::Else) {
            // \`else if\` is simply an else-block that holds one more if
            if *self.peek() == Tok::If { Some(vec![self.if_stmt()?]) } else { Some(self.block()?) }
        } else {
            None
        };
        Ok(Stmt::If(cond, then, otherwise))
    }

    /// \`(a, b) { body }\`, for both \`fn name(...)\` and \`fn(...)\`.
    fn fn_rest(&mut self) -> Result<(Vec<String>, Vec<Stmt>), String> {
        self.expect(Tok::LParen, "'('")?;
        let mut params = Vec::new();
        if *self.peek() != Tok::RParen {
            loop {
                params.push(self.name()?);
                if !self.eat(Tok::Comma) {
                    break; // no comma: that was the last parameter
                }
            }
        }
        self.expect(Tok::RParen, "')'")?;
        Ok((params, self.block()?))
    }
}`,
          },
          explain: [
            "`block` keeps reading statements until it sees the closing `}`. Checking for `Eof` too means a missing `}` gives an error instead of looping forever.",
            "`else if` doesn't need its own AST node. `if_stmt` calls itself, and the result goes inside the else branch.",
            "In `fn_rest`, the `loop` reads a name, then continues only if a comma follows. That reads `a`, `a, b` and `a, b, c` with one piece of code.",
          ],
        },
        {
          title: "binding_power(): how tightly each operator holds on",
          body: "**What it's for:** precedence. Each operator gets a number, and a bigger number means \"do me first\". That's why `*` (7) happens before `+` (6). Anything that isn't an infix operator gets `None`.",
          code: {
            lang: "rust",
            caption: "src/parser.rs (continued)",
            code: `impl Parser {
    fn binding_power(t: &Tok) -> Option<u8> {
        Some(match t {
            Tok::Eq => 1,                                    // a = b   (lowest)
            Tok::Or => 2,
            Tok::And => 3,
            Tok::EqEq | Tok::BangEq => 4,
            Tok::Lt | Tok::LtEq | Tok::Gt | Tok::GtEq => 5,
            Tok::Plus | Tok::Minus => 6,
            Tok::Star | Tok::Slash => 7,
            Tok::LParen | Tok::Dot => 9,                     // f(x)  a.b  (highest)
            _ => return None,
        })
    }
}`,
          },
          explain: [
            "A call `f(x)` and a field access `a.b` are treated as operators too, with the highest power, so `a.b(c)` groups as \"call (a.b) with c\".",
            "This table is the only place precedence is written down. To change how Wisp groups operators, you change a number here.",
          ],
        },
        {
          title: "expr(): the Pratt loop",
          body: "**What it's for:** parsing an expression with the right grouping. It reads one value first (the \"prefix\"), then keeps grabbing operators that follow it, but only while they bind tighter than `min_bp`, the minimum its caller asked for. That one rule handles all precedence.",
          code: {
            lang: "rust",
            caption: "src/parser.rs (continued)",
            code: `impl Parser {
    /// Parse an expression whose operators all bind tighter than \`min_bp\`.
    fn expr(&mut self, min_bp: u8) -> Result<Expr, String> {
        let mut lhs = self.prefix()?; // 1. the first value: 1, x, (…), -y …

        loop {
            // 2. is the next token an operator that binds tightly enough?
            let op = self.peek().clone();
            let Some(bp) = Self::binding_power(&op) else { break }; // not an operator
            if bp <= min_bp {
                break; // too weak: leave it for our caller
            }
            let line = self.line();
            self.advance();
            // 3. combine what we have with the operator and its right side
            lhs = self.infix(lhs, op, bp, line)?;
        }
        Ok(lhs)
    }
}`,
          },
          explain: [
            "Follow `1 + 2 * 3` from `expr(0)`. The prefix is `1`. The loop sees `+` (power 6, more than 0), so it parses the right side with `expr(6)`.",
            "Inside `expr(6)`: the prefix is `2`. The loop sees `*` (power 7, more than 6), so it takes `* 3` too and returns `2 * 3`. That's how `*` ends up deeper in the tree, so it happens first.",
            "With `1 * 2 + 3`, the inner call is `expr(7)`. It sees `+` (6, not more than 7), stops, and hands the `+` back to the outer level. Result: `(1 * 2) + 3`.",
          ],
        },
        {
          title: "prefix(): the first value of an expression",
          body: "**What it's for:** every expression starts with something that isn't an operator in the middle: a number, a string, a name, a bracketed expression, a minus sign, a table or a function. This function reads that first piece.",
          code: {
            lang: "rust",
            caption: "src/parser.rs (continued)",
            code: `impl Parser {
    fn prefix(&mut self) -> Result<Expr, String> {
        let line = self.line();
        Ok(match self.advance() {
            Tok::Num(n) => Expr::Num(n),
            Tok::Str(s) => Expr::Str(s),
            Tok::True => Expr::Bool(true),
            Tok::False => Expr::Bool(false),
            Tok::Nil => Expr::Nil,
            Tok::Ident(name) => Expr::Var(name, line),
            Tok::LParen => {
                let inner = self.expr(0)?; // brackets: start again at the lowest level
                self.expect(Tok::RParen, "')'")?;
                inner
            }
            // -x and !x: 8 makes them bind tighter than * and /
            op @ (Tok::Minus | Tok::Bang) => Expr::Unary(op, Box::new(self.expr(8)?), line),
            Tok::LBrace => self.table()?,
            Tok::Fn => {
                let (params, body) = self.fn_rest()?;
                Expr::Lambda(params, body)
            }
            t => return Err(format!("[line {line}] unexpected {t:?}")),
        })
    }
}`,
          },
          explain: [
            "Brackets call `expr(0)` again, which means \"anything goes inside\". That's why `(1 + 2) * 3` adds first.",
            "`op @ (Tok::Minus | Tok::Bang)` matches either token and also saves it in `op`, so we know which one it was.",
            "If the token can't start an expression (such as a stray `)`), we report it with `{t:?}`, which prints the token's name.",
          ],
        },
        {
          title: "infix(): build the node for an operator",
          body: "**What it's for:** once `expr` has decided to take an operator, this builds the matching tree node. Most operators just parse their right side. Calls, field access and assignment need a little extra.",
          code: {
            lang: "rust",
            caption: "src/parser.rs (continued)",
            code: `impl Parser {
    fn infix(&mut self, lhs: Expr, op: Tok, bp: u8, line: u32) -> Result<Expr, String> {
        Ok(match op {
            Tok::LParen => Expr::Call(Box::new(lhs), self.args()?, line), // f(…)
            Tok::Dot => Expr::Get(Box::new(lhs), self.name()?, line),      // a.b
            Tok::Eq => {
                // bp - 1 lets \`a = b = c\` group as \`a = (b = c)\`
                let value = Box::new(self.expr(bp - 1)?);
                match lhs {
                    Expr::Var(name, _) => Expr::Assign(name, value, line),
                    Expr::Get(obj, field, _) => Expr::Set(obj, field, value, line),
                    _ => return Err(format!("[line {line}] can't assign to that")),
                }
            }
            Tok::And | Tok::Or => Expr::Logical(Box::new(lhs), op, Box::new(self.expr(bp)?)),
            _ => Expr::Binary(Box::new(lhs), op, Box::new(self.expr(bp)?), line),
        })
    }
}`,
          },
          explain: [
            "For ordinary operators the right side is parsed with the operator's own power. That makes `1 - 2 - 3` group as `(1 - 2) - 3`, the usual left-to-right order.",
            "Assignment first parses the left side as a normal expression, then checks it's something you can assign to. `x = 1` becomes `Assign`, `p.x = 1` becomes `Set`, and `1 = 2` is an error.",
          ],
        },
        {
          title: "args() and table(): lists inside brackets",
          body: "**What they're for:** `args` reads the comma-separated arguments of a call up to `)`. `table` reads `{ name: value, ... }` up to `}`. Both use the same \"read one, continue if there's a comma\" loop as `fn_rest`.",
          code: {
            lang: "rust",
            caption: "src/parser.rs (continued)",
            code: `impl Parser {
    fn args(&mut self) -> Result<Vec<Expr>, String> {
        let mut args = Vec::new();
        if *self.peek() != Tok::RParen {
            loop {
                args.push(self.expr(0)?);
                if !self.eat(Tok::Comma) {
                    break;
                }
            }
        }
        self.expect(Tok::RParen, "')'")?;
        Ok(args)
    }

    /// { x: 1, y: 2 }: the \`{\` has already been read by prefix().
    fn table(&mut self) -> Result<Expr, String> {
        let mut fields = Vec::new();
        while *self.peek() != Tok::RBrace {
            let key = self.name()?;
            self.expect(Tok::Colon, "':'")?;
            fields.push((key, self.expr(0)?));
            if !self.eat(Tok::Comma) {
                break;
            }
        }
        self.expect(Tok::RBrace, "'}'")?;
        Ok(Expr::Table(fields))
    }
}`,
          },
        },
        {
          section: "Part 4 · Check it",
          title: "Print the tree",
          body: "Temporarily add this to `run` in `main.rs` and run any script. If the nesting looks right, the front end is done, and you won't need to change it again until the modules lesson adds one keyword.",
          code: {
            lang: "rust",
            caption: "src/main.rs (temporary)",
            code: `let program = parser::parse(lexer::lex("let x = 1 + 2 * 3")?)?;
println!("{program:?}");`,
          },
          output: `[Let("x", Binary(Num(1.0), Plus, Binary(Num(2.0), Star, Num(3.0), 1), 1))]`,
          explain: ["Read it from the inside out: `Binary(Num(2.0), Star, Num(3.0))` sits inside the `Plus` node. Multiplication is deeper in the tree, so it happens first, which is the precedence you wanted."],
        },
      ],
    },
    questions: [
      {
        q: "Why not parse straight into bytecode and skip the tree?",
        intuition: "You can, and Lua's compiler does. The tree is a pause point: it lets the compiler look at the whole program before deciding what to emit, which makes the compiler much easier to write and debug.",
        technical:
          "A single-pass compiler has to emit code while parsing, so jumps, scopes and optimizations get tangled into the grammar code. With an AST, the parser only builds structure and the compiler only walks it. `javac` keeps a full tree and runs several passes over it.",
      },
      {
        q: "What does \"binding power\" actually mean?",
        intuition: "Picture each operator pulling on the values next to it. `*` pulls harder than `+`, so in `1 + 2 * 3` the `2` gets pulled toward the `*`.",
        technical:
          "`expr(min_bp)` only takes operators whose power is greater than `min_bp`. Parsing an operator's right side with that operator's own power makes it group left to right. Using `bp - 1`, as `=` does, makes it group right to left.",
      },
      {
        q: "How do I get better error messages than \"expected ')'\"?",
        intuition: "Keep more position information, the column as well as the line, then print the source line with a caret under the problem.",
        technical:
          "Store a start index and length in each token, and keep the source string for error printing. To report several errors at once, skip tokens after an error until a likely statement start (`let`, `fn`, `}`) and keep parsing.",
      },
    ],
  },

  /* ───────────────────────────── 03 · Bytecode ───────────────────────────── */
  {
    slug: "bytecode",
    title: "Values & Bytecode",
    level: "Foundational",
    accent: "cyan",
    icon: "Binary",
    summary: "Design the VM's data: a Value type, an instruction set modelled on JVM opcodes, and a Chunk that holds code, constants and line numbers.",
    tags: ["Value enum", "Opcodes", "Constant pool", "Disassembler"],
    intro: [
      "The bytecode format is the most important design decision in a VM. The compiler writes it and the interpreter reads it, so it's the contract between them. In the JVM that's the class file: each method has a list of instructions, and the class has a **constant pool** that those instructions point into.",
      "In this lesson you'll define Wisp's version: what a value is, which instructions exist, and the `Chunk` that holds one function's compiled code. You'll also write a disassembler, your own version of `javap`, so you can read the compiler's output from now on.",
    ],
    sim: "bytecode",
    simTitle: "Step through bytecode on an operand stack",
    jvm: {
      title: "What JVM bytecode teaches us",
      points: [
        "JVM opcodes are one byte each, so there can be at most 256 of them (about 200 are used). Operands follow the opcode: `bipush 100` is the two bytes `10 64`.",
        "Constants too big to sit inside an instruction (large numbers, strings, class and method names) live in the **constant pool**. Instructions refer to them by number, as in `ldc #7`.",
        "The JVM has typed instructions: `iadd` adds ints and `dadd` adds doubles. Wisp is dynamically typed, so it has one `Add` that checks the types while running.",
        "Each method records `max_stack` and `max_locals`, worked out by the compiler, so the VM can size each call's memory up front.",
      ],
    },
    concepts: [
      {
        heading: "A stack machine, like the JVM",
        body: [
          "Instructions don't name their inputs. They take them from the top of a stack and put the result back. `2 * (3 + 4)` becomes: push 2, push 3, push 4, add, multiply. The tree's shape turns into the order of the instructions.",
          "The alternative is a **register machine** (used by Lua and Android's Dalvik), where instructions name their inputs: `ADD r0, r1, r2`. That needs fewer instructions, but each one is bigger and the compiler has more work to do. A stack machine is easier to compile to, which is why the JVM chose it, and why we will too.",
        ],
        code: {
          lang: "text",
          caption: "javap -c for: int x = 2 * (3 + 4);",
          code: `0: iconst_2        // push 2
1: iconst_3        // push 3
2: iconst_4        // push 4
3: iadd            // 3 + 4  -> 7
4: imul            // 2 * 7  -> 14
5: istore_1        // pop into local slot 1 (x)`,
        },
      },
      {
        heading: "Bytes or enums?",
        body: [
          "The JVM packs instructions into a byte array, and the interpreter decodes operands by hand. Rust has a simpler option with the same benefits: an `enum` whose variants carry their operands. Each one takes 4 bytes, so a `Vec<Op>` is still one compact list, and `match` unpacks the operands for you.",
          "We'll use enums. If you later want to save compiled code to a file, like a `.class` file, turning `Vec<Op>` into bytes is a short function.",
        ],
      },
    ],
    build: {
      intro: "Two small files. Nothing runs yet, but by the end you can build bytecode by hand and print it.",
      milestone: "a `Chunk` you can fill with instructions and constants, and a disassembler that prints it like `javap -c`.",
      steps: [
        {
          section: "Part 1 · Values",
          title: "The Value type",
          body: "**What it's for:** describing anything a Wisp variable can hold. For now that's `nil`, `true` and `false`, and numbers. Strings, tables and functions are added in lesson 06 as one more option.",
          code: {
            lang: "rust",
            caption: "src/value.rs",
            code: `use std::fmt;

/// A Wisp value: small (16 bytes) and cheap to copy.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Value {
    Nil,
    Bool(bool),
    Num(f64), // every number is a 64-bit float, as in JavaScript and Lua
    // Obj(ObjRef) arrives in lesson 06
}

impl Value {
    /// Wisp's rule for if/while: only \`nil\` and \`false\` count as false.
    pub fn is_truthy(self) -> bool {
        !matches!(self, Value::Nil | Value::Bool(false))
    }
}`,
          },
          explain: [
            "`Copy` means a `Value` is copied automatically whenever it's assigned or passed along, like an integer. The VM moves values around constantly, so this keeps it fast and simple.",
            "`is_truthy` answers \"does this value count as true?\". `matches!` checks whether the value is `Nil` or `Bool(false)`, and `!` flips the answer. So `0` and `\"\"` count as true in Wisp, as they do in Lua and Ruby.",
          ],
          jvm: "The JVM has no single Value type. Its slots are untyped, and the *instruction* says how to read them: `iload` reads an int and `aload` reads a reference. Java's types are known before the program runs, so the instructions can carry them. A dynamic language only finds out while running, so each value carries its own type tag.",
        },
        {
          title: "Printing a value",
          body: "**What it's for:** turning a value into text for `print`. Implementing Rust's `Display` trait means `println!(\"{}\", value)` works.",
          code: {
            lang: "rust",
            caption: "src/value.rs (continued)",
            code: `impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Value::Nil => write!(f, "nil"),
            Value::Bool(b) => write!(f, "{b}"),
            Value::Num(n) => write!(f, "{n}"), // Rust prints 7.0 as "7"
        }
    }
}`,
          },
          explain: ["Each kind of value chooses how it looks. Rust already prints whole-number floats without the `.0`, so `print 3 + 4` shows `7`."],
        },
        {
          section: "Part 2 · Instructions",
          title: "The instruction set",
          body: "**What it's for:** listing every operation the VM can perform. Each variant is one instruction, and the comment names the closest JVM instruction so you can compare. This list is long but simple: read it once now, and each group comes back with its own explanation when the VM implements it. Later lessons add a few more, such as `Call`.",
          code: {
            lang: "rust",
            caption: "src/chunk.rs",
            code: `use crate::value::Value;

/// One instruction. Operands live inside the variant. Each Op is 4 bytes.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Op {
    // put a value on the stack                  JVM equivalent
    Const(u16),       // push constant number i    ldc #i
    Nil, True, False, // push a literal            aconst_null, iconst_1, iconst_0
    // shuffle the stack
    Pop,              // throw the top value away  pop
    Dup,              // copy the top value        dup
    // variables
    GetLocal(u16),    // push a local slot         iload / aload
    SetLocal(u16),    // overwrite a local slot    istore / astore
    GetGlobal(u16),   // operand = which name      getstatic
    SetGlobal(u16),   //                           putstatic
    DefineGlobal(u16),
    // maths and comparisons: pop 2, push 1
    Add, Sub, Mul, Div, //                         dadd dsub dmul ddiv
    Neg, Not,         // -x and !x                 dneg
    Eq, Lt, Gt,       // ==  <  >                  dcmpg + if<cond>
    // control flow: operands are instruction positions
    Jump(u16),        // go to position i          goto
    JumpIfFalse(u16), // pop; go there if falsy    ifeq
    Loop(u16),        // a backwards jump          goto (negative offset)
    // misc
    Print,            // pop and print it
    Return,           // leave the function        return
}`,
          },
          explain: [
            "There's no `<=` or `!=` instruction. The compiler writes `a <= b` as `Gt` followed by `Not` (\"not greater than\"). Fewer instructions means less VM code to write and test.",
            "Jump operands are **positions** in the instruction list: `Jump(12)` means \"continue at instruction 12\". `u16` limits a function to 65,535 instructions. Coincidentally, the JVM limits a method's code to 64 KB.",
            "`Loop` does exactly what `Jump` does. It's a separate name because a backwards jump means \"a loop repeats here\", and later lessons count loops and check for pauses right there.",
          ],
        },
        {
          title: "The Chunk: code, line numbers and constants",
          body: "**What it's for:** holding one function's compiled form. `code` is the list of instructions. `lines` says which source line each instruction came from. `consts` and `names` are the constant pools that instructions point into.",
          code: {
            lang: "rust",
            caption: "src/chunk.rs (continued)",
            code: `#[derive(Debug, Default)]
pub struct Chunk {
    pub code: Vec<Op>,      // the instructions, in order
    pub lines: Vec<u32>,    // lines[i] = source line of code[i]
    pub consts: Vec<Value>, // constant pool for values (numbers, for now)
    pub names: Vec<String>, // constant pool for global variable names
}

impl Chunk {
    /// Add an instruction to the end, and return its position.
    pub fn emit(&mut self, op: Op, line: u32) -> usize {
        self.code.push(op);
        self.lines.push(line);
        self.code.len() - 1
    }
}`,
          },
          explain: [
            "`code` and `lines` always grow together, so entry 5 of `lines` is the line of instruction 5. That's all a runtime error needs to report a line number.",
            "`emit` returns the new instruction's position. Most of the time it's ignored, but for jumps the compiler needs it to go back and fill in the target later (lesson 05).",
            "`Default` lets us write `Chunk::default()` to get an empty chunk.",
          ],
        },
        {
          title: "add_const() and add_name(): filling the constant pools",
          body: "**What they're for:** storing a constant and returning its number, which is what instructions carry. If an equal constant is already stored, its existing number is reused, so the pool never holds duplicates.",
          code: {
            lang: "rust",
            caption: "src/chunk.rs (continued)",
            code: `impl Chunk {
    pub fn add_const(&mut self, v: Value) -> u16 {
        // already in the pool? reuse its slot
        if let Some(i) = self.consts.iter().position(|c| *c == v) {
            return i as u16;
        }
        self.consts.push(v);
        (self.consts.len() - 1) as u16
    }

    pub fn add_name(&mut self, name: &str) -> u16 {
        if let Some(i) = self.names.iter().position(|n| n == name) {
            return i as u16;
        }
        self.names.push(name.to_string());
        (self.names.len() - 1) as u16
    }
}`,
          },
          explain: [
            "`.iter().position(...)` searches the list and returns the index of the first match, if any.",
            "So `x + 1 + 1` stores the number `1` only once, and both `Const` instructions say `Const(0)`.",
            "Names have their own pool for now because `Value` can't hold text yet. Lesson 13 merges them into `consts`.",
          ],
          jvm: "Run `javap -v` on any class to see its constant pool, with entries like `#7 = Utf8 hello`. Instructions such as `ldc #2` point into it, just as `Const(k)` points into `consts`.",
        },
        {
          section: "Part 3 · See it",
          title: "disassemble(): your own javap",
          body: "**What it's for:** printing a chunk as readable text, one instruction per line, with its position and source line. You'll use it constantly to check what the compiler produced.",
          code: {
            lang: "rust",
            caption: "src/chunk.rs (continued)",
            code: `impl Chunk {
    pub fn disassemble(&self, name: &str) {
        println!("== {name} ==");
        for (i, op) in self.code.iter().enumerate() {
            // show the line only when it changes, so the output stays readable
            let line = if i > 0 && self.lines[i] == self.lines[i - 1] {
                "   |".to_string()
            } else {
                format!("{:4}", self.lines[i])
            };
            match op {
                Op::Const(k) => println!("{i:04} {line}  Const {k:>4}   ; {:?}", self.consts[*k as usize]),
                other => println!("{i:04} {line}  {other:?}"),
            }
        }
    }
}`,
          },
          explain: [
            "`enumerate()` gives each instruction together with its position `i`.",
            "`{i:04}` prints the position padded to 4 digits, like `0003`.",
            "For `Const`, we also look up and show the constant it loads, which saves you from checking the pool by hand. Every other instruction is printed with `{:?}`, which writes its name and operand, like `GetLocal(1)`.",
          ],
        },
        {
          title: "Try it: build bytecode by hand",
          body: "Before the compiler exists, write the instructions for `print 1 + 2 * 3` yourself. Put this in `main` temporarily.",
          code: {
            lang: "rust",
            caption: "src/main.rs (temporary)",
            code: `let mut c = Chunk::default();
let a = c.add_const(Value::Num(1.0));
let b = c.add_const(Value::Num(2.0));
let d = c.add_const(Value::Num(3.0));
for op in [Op::Const(a), Op::Const(b), Op::Const(d), Op::Mul, Op::Add, Op::Print, Op::Return] {
    c.emit(op, 1);
}
c.disassemble("demo");`,
          },
          output: `== demo ==
0000    1  Const    0   ; Num(1.0)
0001    |  Const    1   ; Num(2.0)
0002    |  Const    2   ; Num(3.0)
0003    |  Mul
0004    |  Add
0005    |  Print
0006    |  Return`,
          explain: ["Notice the order: all three numbers are pushed first, then `Mul` combines the top two (2 and 3), then `Add` combines 1 with that result. Operators come after their inputs. This is called **postfix** order."],
        },
      ],
    },
    questions: [
      {
        q: "Why does the JVM limit opcodes to one byte?",
        intuition: "Small instructions mean small class files and more code fitting in the CPU's cache. Java was designed in the 1990s to be sent over slow networks, so size mattered a lot.",
        technical:
          "One byte allows at most 256 opcodes. The JVM uses about 200, with a `wide` prefix for the rare cases that need bigger operands. Short forms like `iload_0` to `iload_3` exist because the most common operands are worth folding into the opcode itself.",
      },
      {
        q: "Why does Wisp need a constant pool at all? Couldn't `Const` hold an f64 directly?",
        intuition: "It could for numbers, but strings and functions don't fit inside an instruction. A pool gives every kind of constant one home that instructions can point to.",
        technical:
          "An f64 operand would make every `Op` 16 bytes instead of 4, so the instruction list would be four times larger and slower to read. The pool also removes duplicates and is where the compiler puts nested functions (lesson 07).",
      },
      {
        q: "Stack machine or register machine: which is faster?",
        intuition: "Register machines run fewer instructions, so there's less overhead. Stack machines are simpler to compile to and produce smaller code.",
        technical:
          "Studies of Lua 5 and of register-based JVM variants found roughly 30–45% fewer instructions with registers, but each instruction is bigger and takes longer to decode. For a first VM, the simpler compiler is worth far more, and a JIT erases the difference anyway.",
      },
    ],
    references: [
      ci("Chunks of Bytecode", "chunks-of-bytecode", "The same design in C, with a byte-level encoding."),
      jvms("The Instruction Set", "jvms-6.html", "Chapter 6: every JVM opcode, its operands and what it does to the stack."),
    ],
  },

  /* ───────────────────────────── 04 · The interpreter loop ───────────────────────────── */
  {
    slug: "execution-engine",
    title: "The Interpreter Loop",
    level: "Foundational",
    accent: "emerald",
    icon: "Zap",
    summary: "Write the heart of the VM: an operand stack and a fetch–decode–execute loop that runs bytecode, modelled on the JVM interpreter.",
    tags: ["Operand stack", "Instruction pointer", "Dispatch", "Runtime errors"],
    intro: [
      "Every JVM thread runs a loop: get the instruction at the current position, work out which operation it is, do it, and move on. HotSpot's version is machine code generated for your CPU, but the shape is exactly what you'll write here.",
      "We'll build it in small pieces. First the VM's data and a few helpers, then an empty loop, then the instructions one group at a time. Once it works, you can run hand-written bytecode. The next lesson adds the compiler that writes the bytecode for you.",
    ],
    sim: "dispatch",
    simTitle: "Watch the dispatch loop run",
    jvm: {
      title: "What HotSpot's interpreter teaches us",
      points: [
        "Each method call gets a **frame** with an array of local variables and an operand stack. Instructions move values between the two, as in `iload_1` and `istore_2`.",
        "The interpreter keeps the current instruction position and the top of the stack in CPU registers while it runs. Keeping busy values in local variables rather than in memory is the most important speed trick an interpreter has.",
        "HotSpot's **template interpreter** generates a small piece of machine code for each opcode and jumps straight between them. A Rust `match` on an enum compiles to a jump table, which is the portable version of that.",
        "Runtime errors such as `ArithmeticException` know exactly which instruction failed. Ours use the chunk's line table for the same reason.",
      ],
    },
    concepts: [
      {
        heading: "Fetch, decode, execute",
        body: [
          "**Fetch**: read the instruction at position `ip` (the *instruction pointer*). **Advance**: add 1 to `ip` straight away, so a jump only has to overwrite it. **Decode and execute**: `match` on the instruction and do its job, usually popping inputs and pushing a result.",
          "Watch the order on the stack: for `a - b`, `b` was pushed last, so it's on top. Popping gives you `b` first. Getting that backwards is the classic first bug in a stack VM.",
        ],
      },
    ],
    build: {
      intro: "The VM is a struct with a stack and a table of global variables, plus one method, `run`. We write `run` as an empty loop first, then fill in the instructions group by group.",
      milestone: "a VM that runs any chunk using the instructions from lesson 03, with runtime type errors that report the source line.",
      steps: [
        {
          section: "Part 1 · The VM's data",
          title: "The Vm struct",
          body: "**What it's for:** holding everything a running program needs. `stack` is where instructions take their inputs and leave their results. `globals` stores top-level variables by name.",
          code: {
            lang: "rust",
            caption: "src/vm.rs",
            code: `use crate::chunk::{Chunk, Op};
use crate::value::Value;
use std::collections::HashMap;

pub struct Vm {
    stack: Vec<Value>,               // the operand stack (and, from lesson 05, local variables)
    globals: HashMap<String, Value>, // top-level variables, looked up by name
}

impl Vm {
    pub fn new() -> Self {
        Vm { stack: Vec::with_capacity(256), globals: HashMap::new() }
    }
}`,
          },
          explain: [
            "A `Vec` works well as a stack: `push` adds to the end, `pop` removes from the end, and the end is the top.",
            "A `HashMap` is a lookup table: give it a name, get back a value.",
            "`with_capacity(256)` reserves room up front so small programs never resize the stack. It isn't a limit: the `Vec` still grows if it needs to.",
          ],
          jvm: "A JVM frame's operand stack has a fixed size, `max_stack`, worked out by `javac`, so it never needs to grow. A growable `Vec` is simpler for us and costs very little.",
        },
        {
          title: "push(), pop() and peek()",
          body: "**What they're for:** the three ways instructions touch the stack. `push` puts a value on top. `pop` removes the top value and returns it. `peek` looks at a value without removing it: `peek(0)` is the top, `peek(1)` the one under it.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `impl Vm {
    fn push(&mut self, v: Value) {
        self.stack.push(v);
    }

    fn pop(&mut self) -> Value {
        // the compiler always balances pushes and pops, so an empty
        // stack here means a bug in OUR code, not in the user's script
        self.stack.pop().expect("stack underflow (compiler bug)")
    }

    /// Look without popping. 0 = the top, 1 = just below it, ...
    fn peek(&self, distance: usize) -> Value {
        self.stack[self.stack.len() - 1 - distance]
    }
}`,
          },
          explain: [
            "`expect` crashes with a message if `pop` found nothing. That's deliberate: it can only happen if our compiler made a mistake, and a loud crash makes that easy to find.",
            "`peek` lets an instruction check its inputs *before* removing them. If the types are wrong, the stack still shows exactly what was there.",
          ],
        },
        {
          title: "error(): a message with a line number",
          body: "**What it's for:** building runtime error messages such as `[line 3] runtime error: operands must be numbers`. It uses the chunk's line table to find which source line the failing instruction came from.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `impl Vm {
    fn error(&self, chunk: &Chunk, ip: usize, msg: &str) -> String {
        // ip has already moved past the failing instruction, hence ip - 1
        format!("[line {}] runtime error: {msg}", chunk.lines[ip - 1])
    }
}`,
          },
        },
        {
          section: "Part 2 · The loop",
          title: "run(): the empty loop",
          body: "**What it's for:** running a chunk from its first instruction until `Return`. Each pass of the loop gets one instruction, moves `ip` forward, and then does what the instruction says in a `match`. The match arms come in the next steps: paste each group where the comment says.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `impl Vm {
    pub fn run(&mut self, chunk: &Chunk) -> Result<(), String> {
        let mut ip = 0; // instruction pointer: position of the next instruction

        loop {
            let op = chunk.code[ip]; // FETCH
            ip += 1;                 // advance now, so a jump can simply overwrite ip

            match op {               // DECODE + EXECUTE
                // ── the arms from the next steps go here ──
            }
        }
    }
}`,
          },
          explain: [
            "`ip` is a plain local variable, not a field of `Vm`. A local can live in a CPU register, which makes the loop noticeably faster. Every fast interpreter, HotSpot's included, does this.",
            "The loop has no exit condition. It ends when the `Return` instruction returns from the function, or when an instruction returns an error.",
            "Rust insists that the `match` handles **every** `Op`. Until all the arms below are pasted in, it won't compile. That's a useful safety net: if a later lesson adds an instruction and you forget to handle it, Rust tells you.",
          ],
        },
        {
          title: "Arms: constants and stack shuffling",
          body: "**What they do:** put values on the stack, or rearrange the top of the stack. These are the simplest instructions: each one is a single line.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Const(k) => self.push(chunk.consts[k as usize]), // copy constant k onto the stack
                Op::Nil => self.push(Value::Nil),
                Op::True => self.push(Value::Bool(true)),
                Op::False => self.push(Value::Bool(false)),
                Op::Pop => {
                    self.pop(); // throw the top value away
                }
                Op::Dup => self.push(self.peek(0)), // push a copy of the top value`,
          },
          explain: [
            "`Const(k)` carries a number `k`. It isn't the value itself, it's the value's position in the constant pool. `k as usize` converts it into an index Rust can use.",
            "`Dup` is used by `and` and `or` in lesson 05, which need to inspect a value while keeping it.",
          ],
        },
        {
          title: "Arms: arithmetic and comparisons",
          body: "**What they do:** take the top two values, check that both are numbers, and push the result. Six instructions share one arm because they only differ in the final calculation.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Add | Op::Sub | Op::Mul | Op::Div | Op::Lt | Op::Gt => {
                    // b was pushed last, so it's on top (distance 0)
                    let (Value::Num(a), Value::Num(b)) = (self.peek(1), self.peek(0)) else {
                        return Err(self.error(chunk, ip, "operands must be numbers"));
                    };
                    self.pop();
                    self.pop();
                    self.push(match op {
                        Op::Add => Value::Num(a + b),
                        Op::Sub => Value::Num(a - b),
                        Op::Mul => Value::Num(a * b),
                        Op::Div => Value::Num(a / b),
                        Op::Lt => Value::Bool(a < b),
                        _ => Value::Bool(a > b), // Op::Gt
                    });
                }`,
          },
          explain: [
            "`let (Value::Num(a), Value::Num(b)) = ... else { ... }` means: if both values are numbers, call them `a` and `b` and carry on. If not, run the `else` block, which returns an error.",
            "Only after the check do we pop the two inputs and push the answer.",
            "Comparisons push `true` or `false` instead of a number. `JumpIfFalse` (below) reads them.",
          ],
          jvm: "HotSpot runs `iadd` in a handful of machine instructions with no type check, because the bytecode verifier proved ahead of time that both values are ints. Wisp has to check at runtime, which is the price of dynamic typing.",
        },
        {
          title: "Arms: negate, not and equals",
          body: "**What they do:** `Neg` turns `5` into `-5` and only works on numbers. `Not` flips truthiness, so `!nil` is `true`. `Eq` compares any two values and pushes whether they're equal.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Neg => match self.pop() {
                    Value::Num(n) => self.push(Value::Num(-n)),
                    _ => return Err(self.error(chunk, ip, "operand must be a number")),
                },
                Op::Not => {
                    let v = self.pop();
                    self.push(Value::Bool(!v.is_truthy()));
                }
                Op::Eq => {
                    let b = self.pop();
                    let a = self.pop();
                    self.push(Value::Bool(a == b)); // values of different types are simply unequal
                }`,
          },
        },
        {
          title: "Arms: global variables",
          body: "**What they do:** `DefineGlobal` creates a top-level variable (`let x = ...` outside any block). `GetGlobal` reads one, and `SetGlobal` changes one. Each operand is the variable's position in the chunk's `names` pool.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::DefineGlobal(k) => {
                    let v = self.pop();
                    self.globals.insert(chunk.names[k as usize].clone(), v);
                }
                Op::GetGlobal(k) => {
                    let name = &chunk.names[k as usize];
                    let Some(&v) = self.globals.get(name) else {
                        return Err(self.error(chunk, ip, &format!("undefined variable '{name}'")));
                    };
                    self.push(v);
                }
                Op::SetGlobal(k) => {
                    let name = &chunk.names[k as usize];
                    let v = self.peek(0); // assignment is an expression: the value stays on the stack
                    match self.globals.get_mut(name) {
                        Some(slot) => *slot = v,
                        None => return Err(self.error(chunk, ip, &format!("undefined variable '{name}'"))),
                    }
                }`,
          },
          explain: [
            "Reading a variable that was never defined is an error, not a silent `nil`. That catches typos like `pirnt`.",
            "`SetGlobal` uses `peek`, not `pop`, because in Wisp `x = 5` is itself an expression with the value `5`. That's what makes `a = b = 1` work. When an assignment is used on its own line, the compiler adds a `Pop` after it.",
            "`get_mut` gives us a writable reference to the stored value, and `*slot = v` overwrites it.",
          ],
        },
        {
          title: "Arms: local variables and jumps",
          body: "**What they do:** locals live directly in the stack, so `GetLocal(2)` simply copies `stack[2]` to the top (lesson 05 explains why). Jumps change `ip`, which changes which instruction runs next. That's all `if` and `while` need.",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::GetLocal(slot) => self.push(self.stack[slot as usize]),
                Op::SetLocal(slot) => self.stack[slot as usize] = self.peek(0),

                Op::Jump(target) | Op::Loop(target) => ip = target as usize,
                Op::JumpIfFalse(target) => {
                    if !self.pop().is_truthy() {
                        ip = target as usize; // condition was false: skip ahead
                    }
                }`,
          },
          explain: [
            "Because the loop already added 1 to `ip`, doing nothing means \"continue with the next instruction\". Setting `ip` means \"continue somewhere else\".",
            "`JumpIfFalse` pops the condition. If it's falsy, it jumps. If it's truthy, execution falls through into the code right after it, which is the `then` branch of an `if`.",
          ],
        },
        {
          title: "Arms: print and return",
          body: "**What they do:** `Print` pops a value and prints it. `Return` ends `run`. Lesson 07 changes it to \"go back to whoever called this function\".",
          code: {
            lang: "rust",
            caption: "src/vm.rs · inside run's match",
            code: `                Op::Print => println!("{}", self.pop()),
                Op::Return => return Ok(()),`,
          },
        },
        {
          section: "Part 3 · Run something",
          title: "Run hand-written bytecode",
          body: "Replace the disassembler demo in `main` with this. It's the program `let x = 4  print x * x - 1`, written as instructions by hand.",
          code: {
            lang: "rust",
            caption: "src/main.rs (temporary)",
            code: `let mut c = Chunk::default();
let four = c.add_const(Value::Num(4.0));
let one = c.add_const(Value::Num(1.0));
let x = c.add_name("x");
for op in [
    Op::Const(four), Op::DefineGlobal(x),         // let x = 4
    Op::GetGlobal(x), Op::GetGlobal(x), Op::Mul,  // x * x
    Op::Const(one), Op::Sub,                      // ... - 1
    Op::Print, Op::Return,
] {
    c.emit(op, 1);
}
vm::Vm::new().run(&c)?;`,
          },
          output: "15",
          explain: [
            "Try breaking it on purpose: swap `Op::Const(one)` for `Op::True` and you'll get `[line 1] runtime error: operands must be numbers`. That's your first runtime error.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why keep `ip` in a local variable instead of a field on `Vm`?",
        intuition: "A local variable can live in a CPU register. A field lives in memory, so every read and write is a trip out to the cache.",
        technical:
          "The compiler can't keep `self.ip` in a register across calls like `self.push()`, because those calls might read or change it. A local doesn't have that problem. Every fast interpreter keeps `ip` in a local and only writes it back when something else needs to see it, such as a function call or an error.",
      },
      {
        q: "Is a big `match` really fast enough?",
        intuition: "Yes, for a first VM. The compiler turns it into a jump table: one lookup and one jump per instruction.",
        technical:
          "The cost is the single jump at the top of the loop, which the CPU has to predict from very little history. \"Threaded\" dispatch puts a separate jump at the end of each handler so each one is predicted separately. Rust can't express that safely. Lesson 13 covers what to do instead.",
      },
      {
        q: "What happens if the bytecode is wrong, say a jump to position 99999?",
        intuition: "The VM stops with an index-out-of-bounds panic. That's safe, but it's a crash rather than a helpful message.",
        technical:
          "Rust's bounds checks keep the VM memory-safe. The JVM goes further: its **verifier** checks every class before running it, rejecting jumps outside the method or a stack that doesn't balance. If you ever load bytecode from disk, write a small verifier too.",
      },
    ],
    references: [
      ci("A Virtual Machine", "a-virtual-machine", "The same loop in C, with a stack-tracing debug mode."),
      { title: "JVM Anatomy Quarks", by: "Aleksey Shipilëv", url: "https://shipilev.net/jvm/anatomy-quarks/", kind: "article", note: "Short deep dives into how HotSpot really executes code." },
    ],
  },

  /* ───────────────────────────── 05 · The compiler ───────────────────────────── */
  {
    slug: "compiler",
    title: "Compiling to Bytecode",
    level: "Foundational",
    accent: "pink",
    icon: "Cog",
    summary: "Walk the syntax tree and write bytecode: expressions, global and local variables, scopes, and if/while with jump patching, the way javac's code generator does.",
    tags: ["Code generation", "Local slots", "Scopes", "Jump patching"],
    intro: [
      "This lesson connects the two halves. The compiler walks the tree from lesson 02 and writes the instructions from lesson 03, so the VM from lesson 04 can run real Wisp programs.",
      "There are three ideas. Expressions are compiled **inputs first, operator last**. Local variables become **numbered stack slots** decided at compile time. And `if`/`while` use **jumps whose target is filled in later**, once the compiler knows where they should land.",
    ],
    sim: "flow",
    simTitle: "From tree to instructions",
    flow: [
      { label: "AST", sub: "If(Lt(x, 10), …)" },
      { label: "Walk", sub: "children first" },
      { label: "Emit", sub: "GetLocal 0, Const 10, Lt" },
      { label: "Patch", sub: "JumpIfFalse → 12" },
      { label: "Chunk", sub: "ready to run" },
    ],
    jvm: {
      title: "What javac's code generator teaches us",
      points: [
        "Local variables have no names at runtime. `javac` gives each one a numbered slot (`istore_1`, `iload_2`), so reading a variable is an array index, not a name lookup.",
        "Slots are reused when a block ends: two variables in neighbouring blocks can share slot 3, which keeps each call's memory small.",
        "`javac` writes forward jumps with a placeholder and fills in the target once it gets there, keeping a list of jumps that still need fixing.",
        "Short-circuit `&&` and `||` compile to jumps that skip over the right-hand side, not to an operator instruction.",
      ],
    },
    concepts: [
      {
        heading: "Locals are numbered slots, decided at compile time",
        body: [
          "At the top level, `let` creates a **global**, stored by name in the VM's table. Inside a block, `let` creates a **local**. The compiler keeps a list of the locals currently in scope, and a local's position in that list is its stack slot. At runtime, `GetLocal(2)` reads `stack[2]`. No names, no lookups.",
          "This works because of one rule: between statements, the stack holds exactly the locals in scope and nothing else. So when `let y = ...` computes its value, the value lands in the next free slot, which is exactly where `y` belongs. The compiler just writes down the name.",
        ],
      },
      {
        heading: "Filling in jumps later (backpatching)",
        body: [
          "For `if cond { A } else { B }`, the compiler must write \"if false, jump to B\" *before* it has written `A`, so it doesn't know where `B` starts yet. It writes `JumpIfFalse(0)` as a placeholder, remembers that instruction's position, compiles `A`, and then goes back and **patches** in the real target. Loops are easier: the backwards jump's target is already known.",
        ],
      },
    ],
    build: {
      intro: "One file, `compiler.rs`. The same pattern as the VM: the compiler's data and helpers first, then two functions with an empty `match` each, then their arms one group at a time.",
      milestone: "`cargo run -- loop.wisp` compiles and runs real programs with variables, blocks, `if`, `while`, `and` and `or`.",
      steps: [
        {
          section: "Part 1 · The compiler's data",
          title: "Compiler state and compile()",
          body: "**What it's for:** the compiler remembers the chunk it's filling, the local variables currently in scope, how deeply nested in blocks it is (0 = top level), and the current source line. `compile` is the entry point: it compiles every statement and adds a final `Return`.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs",
            code: `use crate::ast::{Expr, Stmt};
use crate::chunk::{Chunk, Op};
use crate::lexer::Tok;
use crate::value::Value;

struct Local {
    name: String,
    depth: usize, // how many blocks deep it was declared
}

pub struct Compiler {
    chunk: Chunk,
    locals: Vec<Local>, // locals[i] lives in stack slot i
    scope_depth: usize, // 0 = top level, where \`let\` makes globals
    line: u32,          // source line stamped on each new instruction
}

pub fn compile(program: &[Stmt]) -> Result<Chunk, String> {
    let mut c = Compiler { chunk: Chunk::default(), locals: Vec::new(), scope_depth: 0, line: 1 };
    for stmt in program {
        c.stmt(stmt)?;
    }
    c.emit(Op::Return);
    Ok(c.chunk)
}`,
          },
          explain: [
            "`locals` is a list kept in declaration order, so the first local is slot 0, the second is slot 1, and so on.",
            "`scope_depth` goes up by one on entering `{` and down by one on leaving `}`. It's how the compiler knows which locals to discard when a block ends.",
          ],
        },
        {
          title: "emit(), patch() and resolve_local()",
          body: "**What they're for:** `emit` adds an instruction stamped with the current line. `patch` goes back to a placeholder jump and sets its real target. `resolve_local` answers \"is this name a local, and if so, which slot?\".",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler {
    fn emit(&mut self, op: Op) -> usize {
        self.chunk.emit(op, self.line)
    }

    /// Point the placeholder jump at position \`at\` to the end of the code so far.
    fn patch(&mut self, at: usize) {
        let target = self.chunk.code.len() as u16;
        match &mut self.chunk.code[at] {
            Op::Jump(t) | Op::JumpIfFalse(t) => *t = target,
            _ => unreachable!("only jumps get patched"),
        }
    }

    /// Search newest-first, so an inner \`let x\` hides an outer \`x\`.
    fn resolve_local(&self, name: &str) -> Option<u16> {
        self.locals.iter().rposition(|l| l.name == name).map(|i| i as u16)
    }
}`,
          },
          explain: [
            "`patch` sets the target to `code.len()`, the position of the *next* instruction to be written. Call it at the exact moment the compiler reaches the place the jump should land.",
            "`match &mut self.chunk.code[at]` gets a writable reference to that instruction, so `*t = target` changes its operand in place.",
            "`rposition` searches from the end of the list. The most recently declared variable with that name wins, which is exactly how shadowing works.",
          ],
        },
        {
          section: "Part 2 · Expressions",
          title: "expr(): the empty match",
          body: "**What it's for:** compiling one expression. The rule every arm follows: when the instructions run, they leave **exactly one** new value on the stack. Anything not handled yet (strings, calls, tables) falls into the last arm and reports \"not supported yet\".",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler {
    fn expr(&mut self, e: &Expr) -> Result<(), String> {
        match e {
            // ── the arms from the next steps go here ──
            other => return Err(format!("not supported yet: {other:?}")),
        }
        Ok(())
    }
}`,
          },
        },
        {
          title: "Arms: literal values",
          body: "**What they do:** a number is added to the constant pool and loaded with `Const`. `true`, `false` and `nil` have their own one-instruction shortcuts.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside expr's match",
            code: `            Expr::Num(n) => {
                let k = self.chunk.add_const(Value::Num(*n));
                self.emit(Op::Const(k));
            }
            Expr::Bool(true) => {
                self.emit(Op::True);
            }
            Expr::Bool(false) => {
                self.emit(Op::False);
            }
            Expr::Nil => {
                self.emit(Op::Nil);
            }`,
          },
        },
        {
          title: "Arms: unary and binary operators",
          body: "**What they do:** compile the inputs first, then the operator. `self.expr(a)` writes all the instructions for the left side, `self.expr(b)` for the right side, and the operator comes last, which is exactly the order the VM needs.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside expr's match",
            code: `            Expr::Unary(op, operand, line) => {
                self.expr(operand)?; // the input first...
                self.line = *line;
                self.emit(if *op == Tok::Minus { Op::Neg } else { Op::Not }); // ...then the operator
            }
            Expr::Binary(a, op, b, line) => {
                self.expr(a)?;
                self.expr(b)?;
                self.line = *line;
                match op {
                    Tok::Plus => self.emit(Op::Add),
                    Tok::Minus => self.emit(Op::Sub),
                    Tok::Star => self.emit(Op::Mul),
                    Tok::Slash => self.emit(Op::Div),
                    Tok::EqEq => self.emit(Op::Eq),
                    Tok::Lt => self.emit(Op::Lt),
                    Tok::Gt => self.emit(Op::Gt),
                    // operators without their own instruction: combine two
                    Tok::BangEq => { self.emit(Op::Eq); self.emit(Op::Not) } // a != b  is  !(a == b)
                    Tok::LtEq => { self.emit(Op::Gt); self.emit(Op::Not) }   // a <= b  is  !(a > b)
                    Tok::GtEq => { self.emit(Op::Lt); self.emit(Op::Not) }   // a >= b  is  !(a < b)
                    _ => unreachable!("the parser only builds these"),
                };
            }`,
          },
          explain: [
            "The recursion does all the ordering work. For `1 + 2 * 3`, compiling the `+` node first compiles `1`, then the whole `2 * 3` subtree, then emits `Add`. The result is `Const 1, Const 2, Const 3, Mul, Add`, the same sequence you wrote by hand in lesson 03.",
            "`self.line = *line` stamps the operator's instruction with its source line, so a type error points at the right place.",
          ],
        },
        {
          title: "Arms: reading and assigning variables",
          body: "**What they do:** decide, here at compile time, whether a name is a local or a global, and emit the matching instruction. The VM never has to ask.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside expr's match",
            code: `            Expr::Var(name, line) => {
                self.line = *line;
                match self.resolve_local(name) {
                    Some(slot) => self.emit(Op::GetLocal(slot)),
                    None => {
                        // not a local in scope, so it must be a global
                        let k = self.chunk.add_name(name);
                        self.emit(Op::GetGlobal(k))
                    }
                };
            }
            Expr::Assign(name, value, line) => {
                self.expr(value)?; // compute the new value first
                self.line = *line;
                match self.resolve_local(name) {
                    Some(slot) => self.emit(Op::SetLocal(slot)),
                    None => {
                        let k = self.chunk.add_name(name);
                        self.emit(Op::SetGlobal(k))
                    }
                };
            }`,
          },
          explain: ["Locals become a slot number and globals become a name number. That's why locals are faster: an array index instead of a hash lookup."],
        },
        {
          title: "Arms: and / or (short-circuiting)",
          body: "**What they do:** `a and b` only evaluates `b` if `a` is truthy, and `a or b` only if `a` is falsy. The compiler does this with jumps that skip over `b`'s instructions. The result is one of the two values, as in Lua and JavaScript.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside expr's match",
            code: `            Expr::Logical(a, op, b) => {
                self.expr(a)?;
                self.emit(Op::Dup); // keep a copy: if we skip b, \`a\` is the answer
                if *op == Tok::And {
                    // a and b: falsy a? jump past b, keeping a
                    let skip_b = self.emit(Op::JumpIfFalse(0));
                    self.emit(Op::Pop); // a was truthy: drop it, the answer is b
                    self.expr(b)?;
                    self.patch(skip_b);
                } else {
                    // a or b: truthy a? jump past b, keeping a
                    let try_b = self.emit(Op::JumpIfFalse(0));
                    let done = self.emit(Op::Jump(0));
                    self.patch(try_b);
                    self.emit(Op::Pop);
                    self.expr(b)?;
                    self.patch(done);
                }
            }`,
          },
          explain: [
            "Trace `and` with `a` falsy: the stack is `[a, a]`, `JumpIfFalse` pops one copy and jumps past `b`, leaving `[a]`. Trace it with `a` truthy: no jump, `Pop` leaves `[]`, `b` leaves `[b]`. Either way exactly one value remains, which keeps the \"one value per expression\" rule.",
          ],
          jvm: "`javac` compiles `a && b` the same way: evaluate `a`, then `ifeq` past `b`'s code. Java needs no `Dup` because `&&` always produces a boolean.",
        },
        {
          section: "Part 3 · Statements",
          title: "stmt(): the empty match",
          body: "**What it's for:** compiling one statement. The rule here is the opposite of expressions: a statement leaves the stack **exactly as it found it**. The one deliberate exception is `let` inside a block, explained two steps down.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler {
    fn stmt(&mut self, s: &Stmt) -> Result<(), String> {
        match s {
            // ── the arms from the next steps go here ──
            other => return Err(format!("not supported yet: {other:?}")),
        }
        Ok(())
    }
}`,
          },
        },
        {
          title: "Arms: expression and print statements",
          body: "**What they do:** an expression statement like `f(x)` computes a value nobody uses, so a `Pop` throws it away. `print` consumes its value instead.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside stmt's match",
            code: `            Stmt::Expr(e) => {
                self.expr(e)?;
                self.emit(Op::Pop); // nobody uses the value: drop it to keep the stack balanced
            }
            Stmt::Print(e) => {
                self.expr(e)?;
                self.emit(Op::Print);
            }`,
          },
        },
        {
          title: "Arms: let and blocks",
          body: "**What they do:** `let` computes the value, then either stores it as a global or, inside a block, simply leaves it on the stack. That stack slot *is* the new local, so the compiler only records the name. A block statement compiles its contents with `block`, shown at the end.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside stmt's match",
            code: `            Stmt::Let(name, init) => {
                self.expr(init)?; // the value is now on top of the stack
                if self.scope_depth == 0 {
                    let k = self.chunk.add_name(name);
                    self.emit(Op::DefineGlobal(k)); // move it into the globals table
                } else {
                    // a local: emit nothing! The value already sits in the next
                    // free slot, so recording the name makes that slot the variable.
                    self.locals.push(Local { name: name.clone(), depth: self.scope_depth });
                }
            }
            Stmt::Block(body) => self.block(body)?,`,
          },
          explain: [
            "This \"emit nothing\" trick is why locals are so cheap. Creating one costs no instruction at all beyond computing its value.",
          ],
        },
        {
          title: "Arms: if/else with placeholder jumps",
          body: "**What it does:** compiles the condition, then a `JumpIfFalse` with a placeholder target. After the `then` block, a `Jump` skips over the `else` block. Then both placeholders are patched once their targets are known.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside stmt's match",
            code: `            Stmt::If(cond, then, otherwise) => {
                self.expr(cond)?;
                let to_else = self.emit(Op::JumpIfFalse(0)); // target unknown yet
                self.block(then)?;
                let to_end = self.emit(Op::Jump(0));         // after \`then\`, skip the else part
                self.patch(to_else);                         // the else part starts HERE
                if let Some(otherwise) = otherwise {
                    self.block(otherwise)?;
                }
                self.patch(to_end);                          // both paths meet HERE
            }`,
          },
          explain: [
            "Read it as a timeline. When `self.patch(to_else)` runs, the next instruction to be written is the first one of the else block, so that's where the false-jump lands.",
            "Without an `else`, the `Jump` jumps to the very next instruction. It's harmless, and skipping it in that case is a nice small optimization to try.",
          ],
        },
        {
          title: "Arms: while loops",
          body: "**What it does:** remembers where the condition starts, compiles the condition and a placeholder exit jump, compiles the body, then adds a `Loop` back to the condition. Finally it patches the exit jump to land after the loop.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs · inside stmt's match",
            code: `            Stmt::While(cond, body) => {
                let start = self.chunk.code.len();   // the condition starts here
                self.expr(cond)?;
                let exit = self.emit(Op::JumpIfFalse(0));
                self.block(body)?;
                self.emit(Op::Loop(start as u16));   // back to the condition: target already known
                self.patch(exit);                    // the loop is over: continue here
            }`,
          },
          jvm: "Java's `while` loops compile to the same shape: a conditional jump out, the body, and a `goto` back. HotSpot counts how often that backwards `goto` runs to decide when to compile the loop to machine code, which is the job our `Loop` instruction is reserved for in lesson 13.",
        },
        {
          title: "block(): enter and leave a scope",
          body: "**What it's for:** compiling `{ ... }`. It raises the depth, compiles the statements, lowers the depth, and then pops every local that was declared inside, because those variables no longer exist.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler {
    fn block(&mut self, body: &[Stmt]) -> Result<(), String> {
        self.scope_depth += 1;
        for s in body {
            self.stmt(s)?;
        }
        self.scope_depth -= 1;
        // leaving the block: pop each local declared inside it
        while self.locals.last().is_some_and(|l| l.depth > self.scope_depth) {
            self.locals.pop();    // forget the name at compile time...
            self.emit(Op::Pop);   // ...and remove the value at runtime
        }
        Ok(())
    }
}`,
          },
          explain: [
            "Popping keeps the rule that, between statements, the stack holds only the locals in scope. That rule is what keeps slot numbers correct.",
            "A `while` body is a block, so locals declared inside it are created and popped on every pass of the loop, and the stack never grows across iterations.",
          ],
        },
        {
          section: "Part 4 · Run it",
          title: "Run your first real program",
          body: "Make sure `run` in `main.rs` calls `compiler::compile`, then run this script. You now have a working language.",
          code: {
            lang: "wisp",
            caption: "loop.wisp",
            code: `let total = 0
let i = 1
while i <= 100 {
  total = total + i
  i = i + 1
}
print total

{
  let a = 2
  let b = 3
  if a < b and b < 10 { print a * b } else { print 0 }
}`,
          },
          output: `5050
6`,
          explain: [
            "`total` and `i` are globals because they're at the top level. `a` and `b` are locals in slots 0 and 1. Call `chunk.disassemble(\"script\")` before running to see `GetGlobal` in the first part and `GetLocal(0)` and `GetLocal(1)` in the second.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why are globals looked up by name but locals by slot?",
        intuition: "The compiler can see every local's declaration, so it can number them. A global might be defined later, in another file, or never, so it has to be found by name while the program runs.",
        technical:
          "Locals are lexically scoped: their whole lifetime is visible inside one function. Globals are late-bound, so a function can mention a global that's defined after the function. Lesson 13 shows how to make globals cheaper too.",
      },
      {
        q: "What would break if a statement left an extra value on the stack?",
        intuition: "Every later local would end up one slot away from where the compiler thinks it is, so variables would silently read each other's values.",
        technical:
          "Slot numbers come from positions in `locals`, and they're only correct if the runtime stack holds nothing else between statements. That's why expression statements end with `Pop`. A debug check comparing `stack.len()` with the number of locals after each statement catches these bugs right away.",
      },
      {
        q: "Why not give every comparison its own opcode, like `Le` and `Ne`?",
        intuition: "You can, and it saves one instruction per comparison. Start with fewer opcodes, and add them when measurement says they matter.",
        technical:
          "Each combined form costs one extra trip around the loop (`Gt`, then `Not`). In a hot loop condition that's measurable, so mature VMs add specialized versions, and also merge \"compare and jump\" into one instruction, like the JVM's `if_icmple`.",
      },
    ],
    references: [
      ci("Compiling Expressions", "compiling-expressions"),
      ci("Local Variables", "local-variables"),
      ci("Jumping Back and Forth", "jumping-back-and-forth", "Backpatching, explained with diagrams."),
    ],
  },
];
