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
    tags: ["Source → Bytecode → VM", "javac vs JVM", "Project setup", "The Wisp language"],
    intro: [
      "Java never runs your source code directly. `javac` turns `.java` files into `.class` files full of **bytecode**, and the JVM runs that bytecode. Bytecode is the contract between the two halves. The compiler only has to produce valid bytecode, and the VM only has to run it. Neither needs to know how the other works.",
      "In this course you'll build the same split, in Rust, for a tiny scripting language called **Wisp**. Wisp has numbers, strings, tables, functions and closures, and no classes. Every lesson adds one working piece to one growing codebase, and each piece is explained next to how the JVM does the same job.",
    ],
    sim: "pipeline",
    simTitle: "Step a tiny Wisp program through every stage",
    jvm: {
      title: "What the JVM teaches us",
      points: [
        "`javac` and the JVM are separate programs that only talk through the class-file format. Kotlin, Scala and Clojure can run on the JVM because they produce the same format.",
        "Execution is layered. The JVM starts by **interpreting** bytecode, then compiles hot methods to machine code (the JIT). We'll build the interpreter, which is the part every VM needs first.",
        "A `.class` file holds a **constant pool** (numbers, strings, names), the bytecode of every method, and debug tables such as line numbers. Your compiled Wisp functions will hold the same three things.",
        "The JVM is a **stack machine**. Instructions take their inputs from an operand stack and push their results back. Wisp's VM works the same way.",
      ],
    },
    concepts: [
      {
        heading: "Look at real JVM bytecode first",
        body: [
          "Compile a tiny Java method and disassemble it with `javap -c`. You'll see four instructions. Two load the arguments onto the operand stack, one adds the top two values, and one returns the result. Your VM will run almost exactly this sequence.",
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
          "The simplest interpreter walks the syntax tree: `eval(node)` checks the node type and recurses into its children. It's easy to write but slow to run, because every node is a separate allocation and every step chases a pointer.",
          "Bytecode flattens the tree into one dense array. Running it is a loop that reads the next instruction, does it, and repeats. The loop is short and predictable, and it usually runs several times faster than a tree walker. It's the same reason the JVM doesn't run Java syntax trees.",
        ],
      },
      {
        heading: "The Wisp language in one screen",
        body: [
          "Wisp is small on purpose. There are no classes. Objects are plain **tables** of fields, and behaviour comes from functions and closures. This program uses everything the course builds, except modules and fibers.",
        ],
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
      intro: "Set up the project and the pipeline. Some stages will be empty for a few lessons, and that's fine. Having a skeleton that compiles and runs early makes every later lesson a small, testable step.",
      milestone: "a Rust crate called `wisp` that reads a `.wisp` file and passes it through a four-stage pipeline: lex, parse, compile, run.",
      steps: [
        {
          title: "Create the crate and the module layout",
          body: "One file per stage keeps each lesson's changes in one place. Create these empty files now. Each lesson tells you which file it adds to.",
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
            "There are no external dependencies. Everything in this course uses only Rust's standard library, so you can see every line that runs.",
            "The split mirrors the JDK: `javac` is the front end and compiler, `java` is the VM. Here they're modules in one binary, but they only talk through plain data types (`Vec<Token>`, `Vec<Stmt>`, `Chunk`).",
          ],
        },
        {
          title: "Write main.rs: read a file and run the pipeline",
          body: "`run` is the whole compiler and VM in four lines. Each stage returns a `Result`, so `?` stops at the first error from any stage.",
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
}

/// The whole pipeline. Every stage returns Result<_, String>,
/// so \`?\` stops at the first error, whichever stage it came from.
fn run(source: &str) -> Result<(), String> {
    let tokens = lexer::lex(source)?;          // "let x = 1"  ->  [Let, Ident(x), Eq, Num(1)]
    let program = parser::parse(tokens)?;      // tokens       ->  Vec<Stmt> (the AST)
    let chunk = compiler::compile(&program)?;  // AST          ->  bytecode
    vm::Vm::new().run(&chunk)                  // bytecode     ->  side effects (print!)
}`,
          },
          explain: [
            "`env::args().nth(1)` is the first argument after the program name. `let ... else` exits early when it's missing.",
            "Errors are plain `String`s that already contain a line number, such as `[line 3] unexpected ')'`. That's enough for a learning VM, and it keeps every signature short.",
            "`run` returns as soon as any stage fails, the same way `javac` refuses to write a `.class` file when parsing fails.",
            "Exit codes 64 and 70 are the conventional \"usage error\" and \"internal error\" codes from `sysexits.h`. Any non-zero code works.",
          ],
          jvm: "`java Main` does the same thing in a different order. The launcher finds `Main.class`, the class loader reads its bytes, the verifier checks them, and the interpreter starts running `main`. Compiling already happened earlier, when you ran `javac`.",
        },
        {
          title: "Add the test script you'll grow into",
          body: "Save the Wisp program from above as `everything.wisp`. It won't run yet. Each lesson makes more of it work, and by lesson 08 the whole file runs.",
          explain: [
            "Write a one-line script for each feature as you add it, too. A folder of tiny `.wisp` files with their expected output is the simplest test suite a VM can have, and it's how real VMs are tested.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "If the syntax tree already describes the program, why add bytecode at all?",
        intuition:
          "A recipe written as a family tree of sub-recipes is complete but awkward to follow while you cook. Bytecode is the same recipe rewritten as a numbered checklist you read from top to bottom.",
        technical:
          "Walking a tree costs a branch and a pointer chase per node, and the nodes are scattered across memory. Bytecode is a contiguous array, so each step is an index and a jump. The array also gives you natural places for jump targets, line tables and caches.",
      },
      {
        q: "What makes Java portable: the language or the VM?",
        intuition:
          "The bytecode. Think of it as a standard plug shape. Every operating system gets its own native JVM, an adapter that accepts that plug.",
        technical:
          "The JVM Specification fixes the class-file format and the meaning of every opcode, down to byte order and integer widths. Any program that emits valid class files, from any language, runs on any conforming JVM.",
      },
      {
        q: "Is Java compiled or interpreted?",
        intuition: "Both. It's compiled once for portability (source to bytecode), then interpreted, and then compiled again for speed (bytecode to machine code) for the parts that run often.",
        technical:
          "`javac` compiles to bytecode ahead of time. At runtime HotSpot interprets first and profiles as it goes, then the C1 and C2 JIT compilers turn hot methods into native code. Our VM stops at the interpreter. The JIT lesson explains what comes after it.",
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
    summary: "A quick, complete lexer and Pratt parser that turn Wisp source into a syntax tree, with links to longer videos if you want the deep dive.",
    tags: ["Tokens", "Pratt parsing", "AST", "Quickshot"],
    intro: [
      "Before there's any bytecode, text has to become structure. This part of the course is deliberately short. Lexers and parsers are covered very well elsewhere, so the videos linked below are worth watching if this is your first one. Here you get a small, complete front end you can copy, read once, and move on from.",
      "Everything after this lesson only needs the output: a `Vec<Stmt>`, the **abstract syntax tree** (AST). That's where the VM part of the course really starts.",
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
        note: "The clearest explanation of the binding-power loop used below, written in Rust.",
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
        "`javac` runs the same stages: scan characters into tokens, parse tokens into a tree, then check, desugar and generate bytecode. The JVM never sees any of it, only the finished class file.",
        "Tokens remember where they came from. The line numbers end up in the class file's `LineNumberTable`, which is why Java stack traces can show line numbers.",
        "Java's parser is recursive descent with precedence rules, like ours. Java's grammar is much larger, but the technique is the same.",
      ],
    },
    concepts: [
      {
        heading: "The whole idea in two sentences",
        body: [
          "The **lexer** groups characters into words: `let`, `x`, `=`, `1`. The **parser** groups words into a tree that captures meaning, so `1 + 2 * 3` becomes `Add(1, Mul(2, 3))` because `*` binds tighter than `+`.",
          "The only tricky part is precedence, and a Pratt parser solves it with one number per operator, its **binding power**. Higher numbers bind tighter.",
        ],
      },
    ],
    build: {
      intro: "Three files, roughly 220 lines in all. Skim the comments, copy the code, and check it with the debug print at the end.",
      milestone: "`parser::parse(lexer::lex(src)?)` returns a `Vec<Stmt>` for any Wisp program in this course.",
      steps: [
        {
          title: "Tokens and the lexer",
          body: "The lexer walks the source one character at a time and emits a `Token` (a kind plus a line number) for each word or symbol. It skips spaces, newlines and `#` comments.",
          code: {
            lang: "rust",
            caption: "src/lexer.rs",
            code: `#[derive(Debug, Clone, PartialEq)]
pub enum Tok {
    // literals carry their value
    Num(f64), Str(String), Ident(String),
    // keywords
    Let, Fn, Return, If, Else, While, Print, And, Or, True, False, Nil,
    // punctuation and operators
    LParen, RParen, LBrace, RBrace, Comma, Dot, Colon,
    Plus, Minus, Star, Slash, Bang, Eq, EqEq, BangEq, Lt, LtEq, Gt, GtEq,
    Eof, // "end of input", so the parser never runs off the end
}

#[derive(Debug, Clone)]
pub struct Token {
    pub tok: Tok,
    pub line: u32, // kept for error messages and, later, the line table
}

pub fn lex(src: &str) -> Result<Vec<Token>, String> {
    let chars: Vec<char> = src.chars().collect();
    let mut out = Vec::new();
    let mut i = 0; // index of the current character
    let mut line = 1;

    while i < chars.len() {
        let c = chars[i];
        let next = chars.get(i + 1).copied().unwrap_or('\\0'); // one char of lookahead
        let tok = match c {
            '\\n' => { line += 1; i += 1; continue; }
            ' ' | '\\t' | '\\r' => { i += 1; continue; }
            '#' => { // a comment runs to the end of the line
                while i < chars.len() && chars[i] != '\\n' { i += 1; }
                continue;
            }
            '(' => Tok::LParen, ')' => Tok::RParen,
            '{' => Tok::LBrace, '}' => Tok::RBrace,
            ',' => Tok::Comma, '.' => Tok::Dot, ':' => Tok::Colon,
            '+' => Tok::Plus, '-' => Tok::Minus, '*' => Tok::Star, '/' => Tok::Slash,
            // two-character operators: look at \`next\`, and skip it if it matches
            '=' if next == '=' => { i += 1; Tok::EqEq }
            '!' if next == '=' => { i += 1; Tok::BangEq }
            '<' if next == '=' => { i += 1; Tok::LtEq }
            '>' if next == '=' => { i += 1; Tok::GtEq }
            '=' => Tok::Eq, '!' => Tok::Bang, '<' => Tok::Lt, '>' => Tok::Gt,
            '"' => {
                let start = i + 1;
                i += 1;
                while i < chars.len() && chars[i] != '"' {
                    if chars[i] == '\\n' { line += 1; }
                    i += 1;
                }
                if i == chars.len() {
                    return Err(format!("[line {line}] unterminated string"));
                }
                Tok::Str(chars[start..i].iter().collect()) // i is on the closing quote
            }
            c if c.is_ascii_digit() => {
                let start = i;
                while i + 1 < chars.len() && (chars[i + 1].is_ascii_digit() || chars[i + 1] == '.') {
                    i += 1;
                }
                let text: String = chars[start..=i].iter().collect();
                Tok::Num(text.parse().map_err(|_| format!("[line {line}] bad number {text}"))?)
            }
            c if c.is_alphabetic() || c == '_' => {
                let start = i;
                while i + 1 < chars.len() && (chars[i + 1].is_alphanumeric() || chars[i + 1] == '_') {
                    i += 1;
                }
                let word: String = chars[start..=i].iter().collect();
                keyword(&word).unwrap_or(Tok::Ident(word))
            }
            other => return Err(format!("[line {line}] unexpected character '{other}'")),
        };
        out.push(Token { tok, line });
        i += 1; // step past the token's last character
    }
    out.push(Token { tok: Tok::Eof, line });
    Ok(out)
}

fn keyword(word: &str) -> Option<Tok> {
    Some(match word {
        "let" => Tok::Let, "fn" => Tok::Fn, "return" => Tok::Return,
        "if" => Tok::If, "else" => Tok::Else, "while" => Tok::While,
        "print" => Tok::Print, "and" => Tok::And, "or" => Tok::Or,
        "true" => Tok::True, "false" => Tok::False, "nil" => Tok::Nil,
        _ => return None, // not a keyword: it's a name
    })
}`,
          },
          explain: [
            "Every branch of the `match` ends with `i` on the **last** character of its token. The shared `i += 1` after the `match` then moves past it. Multi-character tokens advance `i` inside their branch, and whitespace uses `continue` to skip the push.",
            "Keywords are lexed exactly like names, then looked up in `keyword()`. That's simpler than a separate rule per keyword, and it's how most real lexers do it.",
            "Newlines are just whitespace in Wisp, so statements don't need semicolons. The parser can tell where a statement ends because an expression can't continue past it.",
          ],
        },
        {
          title: "The AST: two enums",
          body: "`Expr` is anything that produces a value, and `Stmt` is anything that's run for its effect. Nodes that can fail at runtime keep a line number, so later error messages can point at the source.",
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
    Expr(Expr),                              // f(x)  (value is thrown away)
    Print(Expr),                             // print expr
    Block(Vec<Stmt>),                        // { ... }
    If(Expr, Vec<Stmt>, Option<Vec<Stmt>>),  // if c { } else { }
    While(Expr, Vec<Stmt>),                  // while c { }
    Fn(String, Vec<String>, Vec<Stmt>),      // fn name(a, b) { }   (lesson 07)
    Return(Option<Expr>),                    // return expr
}`,
          },
          explain: [
            "`Box<Expr>` is needed because an enum can't contain itself directly. Its size would be infinite. A `Box` is a pointer, so the size is fixed.",
            "Some variants are only used in later lessons. They're defined now so the parser can be written once and never touched again.",
          ],
        },
        {
          title: "The parser: statements, then a Pratt loop for expressions",
          body: "Statements are easy: look at the first token and pick a rule. Expressions use the Pratt loop. Parse one operand, then keep absorbing operators while they bind tighter than the caller's minimum.",
          code: {
            lang: "rust",
            caption: "src/parser.rs",
            code: `use crate::ast::{Expr, Stmt};
use crate::lexer::{Tok, Token};

pub fn parse(tokens: Vec<Token>) -> Result<Vec<Stmt>, String> {
    let mut p = Parser { tokens, pos: 0 };
    let mut program = Vec::new();
    while *p.peek() != Tok::Eof {
        program.push(p.statement()?);
    }
    Ok(program)
}

struct Parser { tokens: Vec<Token>, pos: usize }

impl Parser {
    // ── helpers ──
    fn peek(&self) -> &Tok { &self.tokens[self.pos].tok }
    fn line(&self) -> u32 { self.tokens[self.pos].line }
    fn advance(&mut self) -> Tok {
        let t = self.tokens[self.pos].tok.clone();
        if t != Tok::Eof { self.pos += 1; }
        t
    }
    fn eat(&mut self, t: Tok) -> bool { // consume \`t\` if it's next
        if *self.peek() == t { self.pos += 1; true } else { false }
    }
    fn expect(&mut self, t: Tok, what: &str) -> Result<(), String> {
        if self.eat(t) { Ok(()) } else { Err(format!("[line {}] expected {what}", self.line())) }
    }
    fn name(&mut self) -> Result<String, String> {
        match self.advance() {
            Tok::Ident(n) => Ok(n),
            _ => Err(format!("[line {}] expected a name", self.line())),
        }
    }

    // ── statements ──
    fn statement(&mut self) -> Result<Stmt, String> {
        match self.peek() {
            Tok::Let => {
                self.advance();
                let name = self.name()?;
                self.expect(Tok::Eq, "'='")?;
                Ok(Stmt::Let(name, self.expr(0)?))
            }
            Tok::Print => { self.advance(); Ok(Stmt::Print(self.expr(0)?)) }
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
                // a bare \`return\` right before \`}\` returns nil
                let value = if *self.peek() == Tok::RBrace { None } else { Some(self.expr(0)?) };
                Ok(Stmt::Return(value))
            }
            _ => Ok(Stmt::Expr(self.expr(0)?)),
        }
    }

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
            // \`else if\` is just an else-block holding one more if
            if *self.peek() == Tok::If { Some(vec![self.if_stmt()?]) } else { Some(self.block()?) }
        } else {
            None
        };
        Ok(Stmt::If(cond, then, otherwise))
    }

    /// \`(a, b) { body }\`, shared by \`fn name(...)\` and anonymous \`fn(...)\`.
    fn fn_rest(&mut self) -> Result<(Vec<String>, Vec<Stmt>), String> {
        self.expect(Tok::LParen, "'('")?;
        let mut params = Vec::new();
        if *self.peek() != Tok::RParen {
            loop {
                params.push(self.name()?);
                if !self.eat(Tok::Comma) { break; }
            }
        }
        self.expect(Tok::RParen, "')'")?;
        Ok((params, self.block()?))
    }

    // ── expressions: the Pratt loop ──

    /// How tightly an infix operator binds. None means "not an infix operator".
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

    /// Parse an expression whose operators all bind tighter than \`min_bp\`.
    fn expr(&mut self, min_bp: u8) -> Result<Expr, String> {
        let line = self.line();

        // 1. Prefix: every expression starts with one of these.
        let mut lhs = match self.advance() {
            Tok::Num(n) => Expr::Num(n),
            Tok::Str(s) => Expr::Str(s),
            Tok::True => Expr::Bool(true),
            Tok::False => Expr::Bool(false),
            Tok::Nil => Expr::Nil,
            Tok::Ident(name) => Expr::Var(name, line),
            Tok::LParen => {
                let inner = self.expr(0)?; // parentheses reset precedence to the lowest level
                self.expect(Tok::RParen, "')'")?;
                inner
            }
            op @ (Tok::Minus | Tok::Bang) => Expr::Unary(op, Box::new(self.expr(8)?), line),
            Tok::LBrace => self.table()?,
            Tok::Fn => {
                let (params, body) = self.fn_rest()?;
                Expr::Lambda(params, body)
            }
            t => return Err(format!("[line {line}] unexpected {t:?}")),
        };

        // 2. Infix: absorb operators while they bind tighter than min_bp.
        loop {
            let op = self.peek().clone();
            let Some(bp) = Self::binding_power(&op) else { break };
            if bp <= min_bp { break; } // too weak: let our caller have it
            let line = self.line();
            self.advance();
            lhs = match op {
                Tok::LParen => Expr::Call(Box::new(lhs), self.args()?, line),
                Tok::Dot => Expr::Get(Box::new(lhs), self.name()?, line),
                Tok::Eq => {
                    // bp - 1 makes \`=\` right-associative: a = b = c  is  a = (b = c)
                    let value = Box::new(self.expr(bp - 1)?);
                    match lhs {
                        Expr::Var(name, _) => Expr::Assign(name, value, line),
                        Expr::Get(obj, field, _) => Expr::Set(obj, field, value, line),
                        _ => return Err(format!("[line {line}] can't assign to that")),
                    }
                }
                Tok::And | Tok::Or => Expr::Logical(Box::new(lhs), op, Box::new(self.expr(bp)?)),
                _ => Expr::Binary(Box::new(lhs), op, Box::new(self.expr(bp)?), line),
            };
        }
        Ok(lhs)
    }

    fn args(&mut self) -> Result<Vec<Expr>, String> {
        let mut args = Vec::new();
        if *self.peek() != Tok::RParen {
            loop {
                args.push(self.expr(0)?);
                if !self.eat(Tok::Comma) { break; }
            }
        }
        self.expect(Tok::RParen, "')'")?;
        Ok(args)
    }

    fn table(&mut self) -> Result<Expr, String> { // \`{\` already consumed
        let mut fields = Vec::new();
        while *self.peek() != Tok::RBrace {
            let key = self.name()?;
            self.expect(Tok::Colon, "':'")?;
            fields.push((key, self.expr(0)?));
            if !self.eat(Tok::Comma) { break; }
        }
        self.expect(Tok::RBrace, "'}'")?;
        Ok(Expr::Table(fields))
    }
}`,
          },
          explain: [
            "Follow `1 + 2 * 3` through `expr(0)`. The prefix step reads `1`. The loop sees `+` with power 6, which is more than 0, so it parses the right side with `expr(6)`.",
            "Inside `expr(6)`: the prefix step reads `2`. The loop sees `*` with power 7, which is more than 6, so it takes `* 3` too and returns `2 * 3`. That's how `*` ends up deeper in the tree than `+`.",
            "If the input were `1 * 2 + 3`, then inside `expr(7)` the loop would see `+` (6 ≤ 7) and stop, handing `+` back to the outer level. One comparison, `bp <= min_bp`, handles all precedence and left-associativity.",
            "Calls and `.` are infix operators with the highest power, which is why `a.b(c).d` chains naturally.",
            "Assignment parses its left side as an ordinary expression, then checks it's something you can assign to. `x = 1` becomes `Assign`, `p.x = 1` becomes `Set`, and `1 = 2` is an error.",
          ],
        },
        {
          title: "Check it with a debug print",
          body: "Temporarily print the tree from `run` in `main.rs`. If the nesting looks right, the front end is done. You won't need to change it again until the modules lesson adds one keyword.",
          code: {
            lang: "rust",
            caption: "src/main.rs (temporary)",
            code: `let program = parser::parse(lexer::lex("let x = 1 + 2 * 3")?)?;
println!("{program:?}");`,
          },
          output: `[Let("x", Binary(Num(1.0), Plus, Binary(Num(2.0), Star, Num(3.0), 1), 1))]`,
          explain: ["`Binary(Num(2.0), Star, Num(3.0))` sits inside the `Plus` node, so multiplication happens first. That's the precedence you wanted."],
        },
      ],
    },
    questions: [
      {
        q: "Why not parse straight into bytecode and skip the tree?",
        intuition:
          "You can, and Lua's compiler does. The tree is a pause point. It lets you look at the whole program before deciding what code to emit, which makes the compiler much easier to write and debug.",
        technical:
          "A single-pass compiler has to emit code while parsing, so jumps, scopes and constant folding all get tangled into the grammar code. With an AST, the parser only builds structure and the compiler only walks it. `javac` keeps a full tree and runs several passes over it.",
      },
      {
        q: "What does \"binding power\" actually mean?",
        intuition:
          "Picture each operator pulling on the operands next to it. `*` pulls harder than `+`, so in `1 + 2 * 3` the `2` gets pulled toward the `*`.",
        technical:
          "`expr(min_bp)` only absorbs operators whose power is greater than `min_bp`. Parsing an operator's right side with that operator's own power makes it left-associative. Using `bp - 1`, as `=` does, makes it right-associative.",
      },
      {
        q: "How do I get better error messages than \"expected ')'\"?",
        intuition: "Keep more position information: the column as well as the line. Then print the source line with a caret under the problem.",
        technical:
          "Store a span (start and length) in each token instead of only a line, and keep the source string around for error printing. For recovery, skip tokens until a likely statement start (`let`, `fn`, `}`) and keep parsing, so one typo doesn't hide the rest of the errors.",
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
      "The bytecode format is the most important design decision in a VM. The compiler writes it and the interpreter reads it, so it's the contract in the middle. The JVM's version is the class file. Each method has a byte array of instructions, and the class has a **constant pool** that those instructions point into.",
      "In this lesson you'll define Wisp's version: what a value is, which instructions exist, and the `Chunk` that holds a function's compiled code. You'll also write a disassembler, your own `javap`, so you can read what the compiler produces from now on.",
    ],
    sim: "bytecode",
    simTitle: "Step through bytecode on an operand stack",
    jvm: {
      title: "What JVM bytecode teaches us",
      points: [
        "JVM opcodes are one byte each, so there are at most 256 of them (about 200 are used). Operands follow the opcode in the byte stream. `bipush 100` is the two bytes `10 64`.",
        "Constants that don't fit in an instruction, such as big numbers, strings, and class and method names, live in the **constant pool**. Instructions refer to them by index, as in `ldc #7`.",
        "The JVM has typed instructions: `iadd` for ints, `dadd` for doubles, and so on. Wisp is dynamically typed, so it has one `Add` that checks types at runtime instead.",
        "Each method's `Code` attribute stores `max_stack` and `max_locals`, which the compiler calculates so the VM can size each frame up front.",
      ],
    },
    concepts: [
      {
        heading: "A stack machine, like the JVM",
        body: [
          "Instructions don't name their inputs. They pop them from an operand stack and push results back. `2 * (3 + 4)` becomes push 2, push 3, push 4, add, multiply. The tree's structure turns into instruction order.",
          "The other design is a **register machine**, which Lua and Dalvik (Android) use. Instructions name their operands explicitly, as in `ADD r0, r1, r2`. That means fewer instructions, but each one is bigger and the compiler has to allocate registers. A stack machine is simpler to compile to, which is why the JVM chose it and why we will too.",
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
          "The JVM packs instructions into a `byte[]`, and the interpreter decodes operands by hand. In Rust there's a simpler option with the same benefits: an `enum` whose variants carry their operands. With `u16` operands each `Op` is 4 bytes, so a `Vec<Op>` is still one dense, cache-friendly array, and `match` decodes the operands for you.",
          "We'll use enums. If you want a real byte format later, to save compiled code to disk like a `.class` file, converting `Vec<Op>` to bytes is a short serializer.",
        ],
      },
    ],
    build: {
      intro: "Two small files. Nothing runs yet, but by the end you can build bytecode by hand and print it.",
      milestone: "a `Chunk` you can fill with instructions and constants, and a disassembler that prints it like `javap -c`.",
      steps: [
        {
          title: "The Value type",
          body: "A `Value` is anything a Wisp variable can hold. For now that's nil, booleans and numbers. Strings, tables and functions live on the heap and arrive in lesson 06 as one more variant.",
          code: {
            lang: "rust",
            caption: "src/value.rs",
            code: `use std::fmt;

/// A Wisp value. It's small (16 bytes) and Copy, so the VM can move
/// values around freely without allocating.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Value {
    Nil,
    Bool(bool),
    Num(f64), // all numbers are f64, as in JavaScript and Lua
    // Obj(ObjRef) arrives in lesson 06
}

impl Value {
    /// Wisp's truthiness rule: only \`nil\` and \`false\` count as false.
    pub fn is_truthy(self) -> bool {
        !matches!(self, Value::Nil | Value::Bool(false))
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Value::Nil => write!(f, "nil"),
            Value::Bool(b) => write!(f, "{b}"),
            Value::Num(n) => write!(f, "{n}"), // Rust prints 7.0 as "7"
        }
    }
}`,
          },
          explain: [
            "A Rust enum is a **tagged union**: a small tag saying which variant it is, plus room for the largest payload. That's 16 bytes here, and every value is the same size.",
            "Deriving `Copy` matters. Pushing, popping and reading locals copy a value instead of cloning or allocating, which keeps the interpreter loop cheap.",
            "Truthiness is a language design choice. Wisp follows Lua and Ruby, where `0` and `\"\"` are true. Choose your rule once and keep it in one function.",
          ],
          jvm: "The JVM has no single Value type. Its slots are untyped 32-bit words, and the *instruction* says how to read them: `iload` reads an int, `aload` reads a reference. The verifier proves ahead of time that every slot is used consistently. A dynamic language can't know types ahead of time, so the value has to carry its own tag.",
        },
        {
          title: "The instruction set",
          body: "Each variant is one instruction. The comments name the closest JVM instruction, so you can compare as you go. Later lessons add a few more, such as `Call`, `Closure` and `GetField`.",
          code: {
            lang: "rust",
            caption: "src/chunk.rs",
            code: `use crate::value::Value;

/// One instruction. Operands live inside the variant, so the
/// interpreter's \`match\` decodes them for free. Each Op is 4 bytes.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Op {
    // ── constants ──                         JVM equivalent
    Const(u16),       // push consts[i]          ldc #i
    Nil,              // push nil                aconst_null
    True,             // push true               iconst_1
    False,            // push false              iconst_0

    // ── stack shuffling ──
    Pop,              // drop the top value      pop
    Dup,              // copy the top value      dup

    // ── variables ──
    GetLocal(u16),    // push a local slot       iload / aload
    SetLocal(u16),    // write a local slot      istore / astore
    GetGlobal(u16),   // operand = name index    getstatic
    SetGlobal(u16),   //                         putstatic
    DefineGlobal(u16),

    // ── arithmetic and comparison ──
    Add, Sub, Mul, Div, // pop 2, push 1         dadd dsub dmul ddiv
    Neg,              // -x                      dneg
    Not,              // !x
    Eq, Lt, Gt,       // pop 2, push a bool      dcmpg + if<cond>

    // ── control flow (operands are absolute instruction indexes) ──
    Jump(u16),        // ip = target             goto
    JumpIfFalse(u16), // pop; if falsy jump      ifeq
    Loop(u16),        // a backwards jump        goto (negative offset)

    // ── misc ──
    Print,            // pop and print           (a call to System.out.println)
    Return,           // leave the function      return / areturn
}`,
          },
          explain: [
            "There's no `Le` or `Ne`. The compiler turns `a <= b` into `Gt` followed by `Not`. A smaller instruction set means less interpreter code, and the JVM does the same thing (it has no `>=` for doubles either).",
            "Jump targets are **absolute** indexes into the instruction list. That's simpler than the JVM's relative offsets. `u16` limits a function to 65,535 instructions, which happens to match the JVM's 64 KB limit on a method's code.",
            "`Loop` behaves exactly like `Jump`. It's kept separate because a backwards jump is where a loop repeats, which is exactly where later lessons count hot loops and check for safepoints.",
          ],
        },
        {
          title: "The Chunk: code, constants and lines",
          body: "A `Chunk` is one function's compiled form. It's the equivalent of a method's `Code` attribute plus the parts of the constant pool it uses.",
          code: {
            lang: "rust",
            caption: "src/chunk.rs (continued)",
            code: `#[derive(Debug, Default)]
pub struct Chunk {
    pub code: Vec<Op>,      // the instructions
    pub lines: Vec<u32>,    // lines[i] = source line of code[i]
    pub consts: Vec<Value>, // the constant pool for values
    pub names: Vec<String>, // the constant pool for global names
}

impl Chunk {
    /// Append an instruction and return its index.
    /// The compiler needs that index to patch jump targets later.
    pub fn emit(&mut self, op: Op, line: u32) -> usize {
        self.code.push(op);
        self.lines.push(line);
        self.code.len() - 1
    }

    /// Add a constant, reusing the slot if an equal one already exists.
    pub fn add_const(&mut self, v: Value) -> u16 {
        if let Some(i) = self.consts.iter().position(|c| *c == v) {
            return i as u16;
        }
        self.consts.push(v);
        (self.consts.len() - 1) as u16
    }

    /// Same idea for variable names used by the *Global instructions.
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
            "`lines` runs parallel to `code`: entry *i* is the source line of instruction *i*. It costs 4 bytes per instruction and gives every runtime error a line number. The JVM's `LineNumberTable` is a compressed version of the same thing.",
            "Deduplicating constants means `x + 1 + 1` stores `1` only once. `javac` does the same, so each string or number appears in a class's constant pool only once.",
            "Names get their own pool for now because `Value` has no strings yet. Lesson 06 shows how strings become ordinary constants.",
          ],
          jvm: "Run `javap -v` on any class and you'll see the constant pool printed as `#1 = Methodref`, `#2 = String`, `#7 = Utf8 hello`. Instructions such as `ldc #2` and `getstatic #3` point into it, just as `Const(k)` and `GetGlobal(k)` point into `consts` and `names`.",
        },
        {
          title: "A disassembler: your own javap",
          body: "Before the VM or the compiler exists, write the tool that shows you what's in a chunk. You'll use it on every lesson from here on.",
          code: {
            lang: "rust",
            caption: "src/chunk.rs (continued)",
            code: `impl Chunk {
    pub fn disassemble(&self, name: &str) {
        println!("== {name} ==");
        for (i, op) in self.code.iter().enumerate() {
            // print the line only when it changes, so the output stays readable
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
}

// Try it: build \`print 1 + 2 * 3\` by hand (in main.rs, temporarily).
let mut c = Chunk::default();
let (a, b, d) = (c.add_const(Value::Num(1.0)), c.add_const(Value::Num(2.0)), c.add_const(Value::Num(3.0)));
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
          explain: [
            "`{:?}` on an `Op` prints the variant name and its operand, such as `GetLocal(1)`, so most instructions need no special formatting.",
            "Notice the order: both multiplication operands are pushed before `Mul`, and `Add` comes last. That's postfix order, the same shape `javap` showed for `2 * (3 + 4)`.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why does the JVM limit opcodes to one byte?",
        intuition: "Small instructions mean small class files and more code fitting in the CPU cache. In 1995 Java was designed to be sent over slow networks, so size mattered a lot.",
        technical:
          "One byte gives at most 256 opcodes. The JVM uses about 200, with a `wide` prefix for the rare cases that need bigger operands. Short forms like `iload_0` to `iload_3` exist because the most common operands are worth encoding inside the opcode itself.",
      },
      {
        q: "Why does Wisp need a constant pool at all? Couldn't `Const` hold an f64 directly?",
        intuition: "It could for numbers, but strings and functions don't fit in an instruction. A pool gives every kind of constant one uniform home that instructions can point to.",
        technical:
          "An f64 operand would make every `Op` 16 bytes instead of 4, so the whole array would be four times larger and less cache-friendly. The pool also deduplicates repeated constants and is where the compiler puts nested functions (lesson 07).",
      },
      {
        q: "Stack machine or register machine: which is faster?",
        intuition: "Register machines run fewer instructions, so each program does less dispatch work. Stack machines are simpler to compile to and produce smaller code.",
        technical:
          "Studies of Lua 5 and of register-based JVM variants found roughly 30–45% fewer instructions with registers, but each instruction is larger and decodes more operands. For a first VM, a stack machine's simpler compiler is worth much more than that difference, and a JIT erases it anyway.",
      },
    ],
    references: [
      ci("Chunks of Bytecode", "chunks-of-bytecode", "The same design in C, with a byte-level encoding."),
      jvms("The Instruction Set", "jvms-6.html", "Chapter 6: every JVM opcode, its operands and its stack effect."),
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
      "Every JVM thread runs a loop that fetches the instruction at the program counter, works out which operation it is, does it, and repeats. HotSpot's version is generated machine code tuned for each CPU, but the shape is the same as the loop you'll write here in about 80 lines of Rust.",
      "Once this loop works, you can hand-assemble bytecode and watch it run. The next lesson adds the compiler that produces that bytecode for you.",
    ],
    sim: "dispatch",
    simTitle: "Watch the dispatch loop run",
    jvm: {
      title: "What HotSpot's interpreter teaches us",
      points: [
        "Each method call gets a **frame** with an array of local variables and an operand stack. Instructions move values between the two, as in `iload_1` and `istore_2`.",
        "The interpreter keeps the program counter and the top of the stack in machine registers while it runs. Keeping hot state in local variables, not in heap fields, is the most important interpreter optimization.",
        "HotSpot's **template interpreter** generates a small machine-code routine per opcode at startup and jumps straight between them. A Rust `match` on a dense enum compiles to a jump table, which is the portable version of that.",
        "Runtime errors such as `ArithmeticException` know exactly which instruction failed, because the program counter is always known. Our errors use the line table for the same reason.",
      ],
    },
    concepts: [
      {
        heading: "Fetch, decode, execute",
        body: [
          "**Fetch**: read `code[ip]`. **Advance**: `ip += 1`, before doing anything else, so a jump can simply overwrite `ip`. **Decode and execute**: `match` on the instruction and do its work, which usually means popping operands and pushing a result.",
          "Note that the operands come off the stack in reverse order. For `a - b`, `b` was pushed last, so it's on top. Getting that backwards is the classic first bug in a stack VM.",
        ],
      },
    ],
    build: {
      intro: "The VM is a struct with a stack and a globals table, plus one method, `run`, that loops over a chunk.",
      milestone: "a VM that runs any chunk using the instructions from lesson 03, with runtime type errors that report the source line.",
      steps: [
        {
          title: "The VM struct and stack helpers",
          body: "The operand stack is a `Vec<Value>`. Locals will live in the same Vec in the next lesson. Globals are a `HashMap` from name to value.",
          code: {
            lang: "rust",
            caption: "src/vm.rs",
            code: `use crate::chunk::{Chunk, Op};
use crate::value::Value;
use std::collections::HashMap;

pub struct Vm {
    stack: Vec<Value>,               // operand stack (and, from lesson 05, local variables)
    globals: HashMap<String, Value>, // top-level variables, by name
}

impl Vm {
    pub fn new() -> Self {
        Vm { stack: Vec::with_capacity(256), globals: HashMap::new() }
    }

    fn push(&mut self, v: Value) {
        self.stack.push(v);
    }

    fn pop(&mut self) -> Value {
        // the compiler guarantees balanced pushes and pops,
        // so an empty stack here is a bug in *our* code, not the user's
        self.stack.pop().expect("stack underflow (compiler bug)")
    }

    /// Look at a value without popping it. 0 = top, 1 = just below it.
    fn peek(&self, distance: usize) -> Value {
        self.stack[self.stack.len() - 1 - distance]
    }

    /// A runtime error that points at the source line of the failing instruction.
    fn error(&self, chunk: &Chunk, ip: usize, msg: &str) -> String {
        // ip has already moved past the failing instruction, hence ip - 1
        format!("[line {}] runtime error: {msg}", chunk.lines[ip - 1])
    }
}`,
          },
          explain: [
            "`peek` exists so an instruction can check its operands *before* popping them. When there's an error, the stack still shows what went wrong, which helps when you add a debugger.",
            "`Vec::with_capacity(256)` avoids reallocating for small programs. It's an optimization, not a limit, because the Vec still grows if it needs to.",
          ],
          jvm: "A JVM frame's operand stack has a fixed size, `max_stack`, calculated by `javac`, so it never grows. You could calculate the same for each Wisp chunk. A growable `Vec` is simpler, and costs little.",
        },
        {
          title: "The loop",
          body: "Here's the whole interpreter. Each arm is a few lines, and the comment above each group says what it does to the stack.",
          code: {
            lang: "rust",
            caption: "src/vm.rs (continued)",
            code: `impl Vm {
    pub fn run(&mut self, chunk: &Chunk) -> Result<(), String> {
        let mut ip = 0; // instruction pointer: index of the next instruction

        loop {
            // FETCH, then advance first, so jumps can just overwrite ip
            let op = chunk.code[ip];
            ip += 1;

            // DECODE + EXECUTE
            match op {
                // ── push constants ──
                Op::Const(k) => self.push(chunk.consts[k as usize]),
                Op::Nil => self.push(Value::Nil),
                Op::True => self.push(Value::Bool(true)),
                Op::False => self.push(Value::Bool(false)),
                Op::Pop => { self.pop(); }
                Op::Dup => self.push(self.peek(0)),

                // ── arithmetic: [.., a, b] -> [.., a op b] ──
                Op::Add | Op::Sub | Op::Mul | Op::Div | Op::Lt | Op::Gt => {
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
                }
                Op::Neg => match self.pop() {
                    Value::Num(n) => self.push(Value::Num(-n)),
                    _ => return Err(self.error(chunk, ip, "operand must be a number")),
                },
                Op::Not => {
                    let v = self.pop();
                    self.push(Value::Bool(!v.is_truthy()));
                }
                Op::Eq => {
                    let (b, a) = (self.pop(), self.pop());
                    self.push(Value::Bool(a == b)); // any two values can be compared
                }

                // ── globals: the operand indexes chunk.names ──
                Op::DefineGlobal(k) => {
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
                }

                // ── locals: the operand is a stack slot (see lesson 05) ──
                Op::GetLocal(slot) => self.push(self.stack[slot as usize]),
                Op::SetLocal(slot) => self.stack[slot as usize] = self.peek(0),

                // ── control flow: just move ip ──
                Op::Jump(target) | Op::Loop(target) => ip = target as usize,
                Op::JumpIfFalse(target) => {
                    if !self.pop().is_truthy() {
                        ip = target as usize;
                    }
                }

                Op::Print => println!("{}", self.pop()),
                Op::Return => return Ok(()),
            }
        }
    }
}`,
          },
          explain: [
            "The arithmetic instructions share one arm. The `let (Value::Num(a), Value::Num(b)) = ... else` pattern checks both types in a single line. If either one isn't a number, the `else` branch runs and returns the error.",
            "Comparisons push a `Bool`, and `JumpIfFalse` pops it. So `if a < b` compiles to `... Lt, JumpIfFalse(else)`. The JVM fuses those two steps into one instruction (`if_icmpge`). That's an optimization you could add later.",
            "`SetGlobal` and `SetLocal` don't pop, because assignment is an expression in Wisp (`a = b = 1` works). When an assignment is used as a statement, the compiler emits a `Pop` after it.",
            "`Return` simply ends the loop for now. Lesson 07 turns it into \"go back to the caller\".",
            "The `match` is **exhaustive**: if a later lesson adds an `Op` variant and you forget to handle it, Rust refuses to compile. That's a useful safety net while the instruction set grows.",
          ],
          jvm: "HotSpot interprets `iadd` with a few machine instructions: pop two ints, add them, push the result, then load the next opcode and jump to its handler. It doesn't type-check, because the bytecode verifier already proved both operands are ints. Wisp checks at runtime instead, the price of dynamic typing that a JIT later tries to win back.",
        },
        {
          title: "Run hand-written bytecode",
          body: "Replace the disassembler demo in `main.rs` with this. It's the program `let x = 4  print x * x - 1`, compiled by hand.",
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
            "Try breaking it on purpose. Swap `Op::Const(one)` for `Op::True` and you'll get `[line 1] runtime error: operands must be numbers`. That's your first runtime error.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why keep `ip` in a local variable instead of a field on `Vm`?",
        intuition: "A local variable can live in a CPU register. A field lives in memory, so every read and write is a trip to the cache.",
        technical:
          "The compiler can't keep `self.ip` in a register across calls like `self.push()`, because those calls might read or write it. A local has no such problem. Every fast interpreter, HotSpot's included, keeps `ip` and often the stack top in locals, and writes them back only when something else needs to see them, such as a call or an error.",
      },
      {
        q: "Is a big `match` really fast enough?",
        intuition: "Yes, for a first VM. The compiler turns it into a jump table: one lookup and one jump per instruction.",
        technical:
          "The cost is the single indirect jump at the top of the loop, which the CPU's branch predictor has to guess from very little history. \"Threaded\" dispatch puts a separate jump at the end of every handler so each one is predicted separately. Rust can't express that directly without unsafe tricks. The performance lesson covers what to do instead.",
      },
      {
        q: "What happens if the bytecode is wrong, say a jump to index 99999?",
        intuition: "The VM panics with an index-out-of-bounds error. That's safe, but it's a crash rather than a helpful message.",
        technical:
          "Rust's bounds checks keep it memory-safe. The JVM goes further: its **verifier** checks every class before running it, so a jump target outside the method or a stack that doesn't balance is rejected at load time. If you ever load bytecode from disk, write a small verifier too.",
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
    summary: "Walk the AST and emit bytecode: expressions, global and local variables, scopes, and if/while with jump patching, the way javac's code generator does.",
    tags: ["Code generation", "Local slots", "Scopes", "Jump patching"],
    intro: [
      "This lesson connects the two halves. The compiler walks the syntax tree from lesson 02 and emits the instructions from lesson 03, so the VM from lesson 04 can run real Wisp programs.",
      "There are only three ideas to learn. Expressions compile to **postfix order**: operands first, then the operator. Local variables become **stack slots** decided at compile time. And control flow uses **jumps whose targets are filled in later**, once the compiler knows where they should land.",
    ],
    sim: "flow",
    simTitle: "From tree to instructions",
    flow: [
      { label: "AST", sub: "If(Lt(x, 10), …)" },
      { label: "Walk", sub: "post-order: kids first" },
      { label: "Emit", sub: "GetLocal 0, Const 10, Lt" },
      { label: "Patch", sub: "JumpIfFalse → 12" },
      { label: "Chunk", sub: "ready to run" },
    ],
    jvm: {
      title: "What javac's code generator teaches us",
      points: [
        "Local variables have no names at runtime. `javac` gives each one a numbered slot in the frame (`istore_1`, `iload_2`), so a variable read is an array index, not a hash lookup.",
        "Slots are reused when a scope ends. Two variables in sibling blocks can share slot 3, which keeps `max_locals` small.",
        "`javac` emits forward jumps with a placeholder and fills in the target once it reaches it. Its code generator keeps a list of pending jumps for exactly this.",
        "Short-circuit `&&` and `||` are compiled to jumps, not to an operator. The right-hand side is skipped by jumping over its code.",
      ],
    },
    concepts: [
      {
        heading: "Locals are slots, decided at compile time",
        body: [
          "At the top level, `let` creates a **global**, stored by name in the VM's table. Inside a block it creates a **local**. The compiler keeps a list of locals in scope, and a local's position in that list is its stack slot. At runtime, `GetLocal(2)` reads `stack[2]`, with no names and no hashing.",
          "This works because of one invariant: between statements, the stack holds exactly the local variables in scope and nothing else. So when `let y = ...` evaluates its initializer, the value lands in the next free slot, which is exactly where the variable belongs. The compiler just records the name.",
        ],
        code: {
          lang: "text",
          caption: "javap -c: locals in Java",
          code: `void demo() {          //  0: iconst_2
  int a = 2;           //  1: istore_1     slot 0 is \`this\`
  int b = 3;           //  2: iconst_3
  print(a * b);        //  3: istore_2
}                      //  4: aload_0 ... iload_1, iload_2, imul ...`,
        },
      },
      {
        heading: "Backpatching jumps",
        body: [
          "When compiling `if cond { A } else { B }`, the compiler has to emit \"jump to the else branch if false\" *before* it has compiled `A`, so it doesn't know the target yet. It emits `JumpIfFalse(0)`, remembers that instruction's index, compiles `A`, and then **patches** the placeholder with the real target. Loops are easier: the target of the backwards jump is already known.",
        ],
      },
    ],
    build: {
      intro: "One file, `compiler.rs`. It's a recursive walk with one function for expressions and one for statements.",
      milestone: "`cargo run -- loop.wisp` compiles and runs real programs with variables, blocks, `if`, `while`, `and` and `or`.",
      steps: [
        {
          title: "Compiler state",
          body: "The compiler owns the chunk it's filling, the locals currently in scope, and the current scope depth (0 means the top level).",
          code: {
            lang: "rust",
            caption: "src/compiler.rs",
            code: `use crate::ast::{Expr, Stmt};
use crate::chunk::{Chunk, Op};
use crate::lexer::Tok;
use crate::value::Value;

struct Local {
    name: String,
    depth: usize, // the scope depth where it was declared
}

pub struct Compiler {
    chunk: Chunk,
    locals: Vec<Local>, // locals[i] lives in stack slot i
    scope_depth: usize, // 0 = top level, where \`let\` makes globals
    line: u32,          // source line recorded for each emitted op
}

pub fn compile(program: &[Stmt]) -> Result<Chunk, String> {
    let mut c = Compiler { chunk: Chunk::default(), locals: Vec::new(), scope_depth: 0, line: 1 };
    for stmt in program {
        c.stmt(stmt)?;
    }
    c.emit(Op::Return);
    Ok(c.chunk)
}

impl Compiler {
    fn emit(&mut self, op: Op) -> usize {
        self.chunk.emit(op, self.line)
    }

    /// Point a placeholder jump at the *current* end of the code.
    fn patch(&mut self, at: usize) {
        let target = self.chunk.code.len() as u16;
        match &mut self.chunk.code[at] {
            Op::Jump(t) | Op::JumpIfFalse(t) => *t = target,
            _ => unreachable!("only jumps get patched"),
        }
    }

    /// Search innermost-first, so an inner \`let x\` shadows an outer one.
    fn resolve_local(&self, name: &str) -> Option<u16> {
        self.locals.iter().rposition(|l| l.name == name).map(|i| i as u16)
    }
}`,
          },
          explain: [
            "`emit` returns the new instruction's index. For most instructions it's ignored, but for jumps it's what `patch` needs later.",
            "`rposition` searches from the end of the list. The newest local with that name wins, which is exactly how shadowing works.",
          ],
        },
        {
          title: "Expressions: children first, then the operator",
          body: "Each expression leaves exactly **one** value on the stack. To compile a binary operator, compile the left side (one value), then the right side (another value), then emit the operator, which pops two and pushes one.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler {
    fn expr(&mut self, e: &Expr) -> Result<(), String> {
        match e {
            Expr::Num(n) => {
                let k = self.chunk.add_const(Value::Num(*n));
                self.emit(Op::Const(k));
            }
            Expr::Bool(true) => { self.emit(Op::True); }
            Expr::Bool(false) => { self.emit(Op::False); }
            Expr::Nil => { self.emit(Op::Nil); }

            Expr::Unary(op, operand, line) => {
                self.expr(operand)?; // the operand first...
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
                    // derived operators: two instructions instead of a new opcode
                    Tok::BangEq => { self.emit(Op::Eq); self.emit(Op::Not) } // a != b  is  !(a == b)
                    Tok::LtEq => { self.emit(Op::Gt); self.emit(Op::Not) }   // a <= b  is  !(a > b)
                    Tok::GtEq => { self.emit(Op::Lt); self.emit(Op::Not) }   // a >= b  is  !(a < b)
                    _ => unreachable!("the parser only builds these"),
                };
            }

            Expr::Var(name, line) => {
                self.line = *line;
                match self.resolve_local(name) {
                    Some(slot) => self.emit(Op::GetLocal(slot)),
                    None => { // not a local, so it must be a global
                        let k = self.chunk.add_name(name);
                        self.emit(Op::GetGlobal(k))
                    }
                };
            }
            Expr::Assign(name, value, line) => {
                self.expr(value)?;
                self.line = *line;
                match self.resolve_local(name) {
                    Some(slot) => self.emit(Op::SetLocal(slot)),
                    None => {
                        let k = self.chunk.add_name(name);
                        self.emit(Op::SetGlobal(k))
                    }
                };
            }

            Expr::Logical(a, op, b) => {
                self.expr(a)?;
                self.emit(Op::Dup); // keep a copy: if we short-circuit, \`a\` is the answer
                if *op == Tok::And {
                    // a and b: if a is falsy, stop with a. Otherwise the answer is b.
                    let skip_b = self.emit(Op::JumpIfFalse(0));
                    self.emit(Op::Pop); // a was truthy: discard it
                    self.expr(b)?;
                    self.patch(skip_b);
                } else {
                    // a or b: if a is truthy, stop with a. Otherwise the answer is b.
                    let try_b = self.emit(Op::JumpIfFalse(0));
                    let done = self.emit(Op::Jump(0));
                    self.patch(try_b);
                    self.emit(Op::Pop);
                    self.expr(b)?;
                    self.patch(done);
                }
            }
            other => return Err(format!("not supported yet: {other:?}")), // strings, calls, tables: coming up
        }
        Ok(())
    }
}`,
          },
          explain: [
            "The recursion **is** the postfix ordering. `self.expr(a)` emits all of `a`'s instructions before `b`'s, and the operator comes last. For `1 + 2 * 3` that gives `Const 1, Const 2, Const 3, Mul, Add`, the same sequence you hand-wrote in lesson 03.",
            "Variable lookup is decided **here, once**, at compile time: is the name in the locals list or not? The VM never has to ask. Locals turn into an array index, and only globals pay for a hash lookup.",
            "Trace `and` with `a` falsy: the stack is `[a, a]`, then `JumpIfFalse` pops one copy and jumps past `b`, leaving `[a]`. With `a` truthy: it doesn't jump, `Pop` leaves `[]`, and `b` leaves `[b]`. Either way, exactly one value remains.",
          ],
          jvm: "`javac` compiles `a && b` the same way: evaluate `a`, `ifeq` past the code for `b`. Java doesn't need the `Dup` because its `&&` always produces a boolean. Wisp's `and` returns one of its operands (as Lua's and JavaScript's do), so it has to keep that operand on the stack.",
        },
        {
          title: "Statements, scopes and jumps",
          body: "Statements leave the stack exactly as they found it, apart from `let` inside a block, which deliberately leaves its value behind because that stack slot *is* the new variable.",
          code: {
            lang: "rust",
            caption: "src/compiler.rs (continued)",
            code: `impl Compiler {
    fn stmt(&mut self, s: &Stmt) -> Result<(), String> {
        match s {
            Stmt::Expr(e) => {
                self.expr(e)?;
                self.emit(Op::Pop); // the value isn't used, so drop it to keep the stack balanced
            }
            Stmt::Print(e) => {
                self.expr(e)?;
                self.emit(Op::Print);
            }
            Stmt::Let(name, init) => {
                self.expr(init)?; // the value is now on top of the stack
                if self.scope_depth == 0 {
                    let k = self.chunk.add_name(name);
                    self.emit(Op::DefineGlobal(k)); // pop it into the globals table
                } else {
                    // a local: emit nothing. The value already sits in the next
                    // free slot, so recording the name makes that slot the variable.
                    self.locals.push(Local { name: name.clone(), depth: self.scope_depth });
                }
            }
            Stmt::Block(body) => self.block(body)?,

            Stmt::If(cond, then, otherwise) => {
                self.expr(cond)?;
                let to_else = self.emit(Op::JumpIfFalse(0)); // target not known yet
                self.block(then)?;
                let to_end = self.emit(Op::Jump(0)); // after \`then\`, skip over \`else\`
                self.patch(to_else);                 // the else branch starts here
                if let Some(otherwise) = otherwise {
                    self.block(otherwise)?;
                }
                self.patch(to_end);                  // both paths meet here
            }
            Stmt::While(cond, body) => {
                let start = self.chunk.code.len();   // the loop header: re-check cond here
                self.expr(cond)?;
                let exit = self.emit(Op::JumpIfFalse(0));
                self.block(body)?;
                self.emit(Op::Loop(start as u16));   // the backwards jump: target already known
                self.patch(exit);
            }
            other => return Err(format!("not supported yet: {other:?}")),
        }
        Ok(())
    }

    fn block(&mut self, body: &[Stmt]) -> Result<(), String> {
        self.scope_depth += 1;
        for s in body {
            self.stmt(s)?;
        }
        self.scope_depth -= 1;
        // leaving the scope: pop every local declared inside it
        while self.locals.last().is_some_and(|l| l.depth > self.scope_depth) {
            self.locals.pop();
            self.emit(Op::Pop);
        }
        Ok(())
    }
}`,
          },
          explain: [
            "`If` emits two placeholders. `to_else` is patched to point just after the `Jump`. `to_end` is patched to point after the else branch. Draw the instruction list once on paper and it clicks.",
            "Without an `else`, the `Jump` jumps to the very next instruction. It's harmless, and you could skip emitting it, which is a nice small optimization to try.",
            "`block` pops its locals on the way out. This keeps the invariant that between statements the stack holds only the locals in scope, which is what makes slot numbers line up with `locals` positions.",
            "The `while` loop's body is a block, so locals declared inside it are pushed and popped on every iteration, and the stack never grows across iterations.",
          ],
          jvm: "Java's `while (i < n) { ... }` compiles to the same shape (often with the test moved to the bottom to save a jump): a conditional jump out, the body, and a `goto` back to the test. The backwards `goto` is where HotSpot counts loop iterations to decide when to JIT-compile, the job our `Loop` instruction is reserved for.",
        },
        {
          title: "Run your first real program",
          body: "Change `run` in `main.rs` to call `compiler::compile`, if you haven't already, and give it a script. You now have a working language.",
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
            "`total` and `i` are globals because they're at the top level. `a` and `b` are locals in slots 0 and 1. Call `chunk.disassemble(\"script\")` before running to see `GetGlobal` for the first part and `GetLocal(0)` and `GetLocal(1)` for the second.",
          ],
        },
      ],
    },
    questions: [
      {
        q: "Why are globals looked up by name but locals by slot?",
        intuition: "The compiler can see every local's declaration, so it can number them. A global might be defined later, in another file, or never, so it has to be found by name when the code runs.",
        technical:
          "Locals are lexically scoped: their whole lifetime is visible inside one function. Globals are late-bound, so a function can refer to a global that's defined after the function. The performance lesson shows how to turn global names into slots too, by resolving them on first use.",
      },
      {
        q: "What would break if a statement left an extra value on the stack?",
        intuition: "Every later local would end up one slot away from where the compiler thinks it is, so variables would silently read each other's values.",
        technical:
          "Slot numbers come from positions in the `locals` list, and they're only correct if the runtime stack contains nothing else between statements. That's why expression statements end with `Pop`. A debug-mode check that compares `stack.len()` with the number of locals after each statement catches these bugs right away.",
      },
      {
        q: "Why not give every comparison its own opcode, like `Le` and `Ne`?",
        intuition: "You can. It saves one instruction per comparison. Fewer opcodes means less code to write and test, so start small and add them when profiling says they matter.",
        technical:
          "Each derived form costs one extra dispatch (`Gt` plus `Not`). In a hot loop condition that's measurable, so mature VMs add the specialized versions and also fuse compare-and-jump, like the JVM's `if_icmple`. Both are simple peephole changes in `Binary` and `If` once the basics work.",
      },
    ],
    references: [
      ci("Compiling Expressions", "compiling-expressions"),
      ci("Local Variables", "local-variables"),
      ci("Jumping Back and Forth", "jumping-back-and-forth", "Backpatching, explained with diagrams."),
    ],
  },
];
