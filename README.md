<p align="center">
  <img src="src/app/icon.svg" width="72" height="72" alt="ByteMong logo" />
</p>

<h1 align="center">ByteMong</h1>

<p align="center">
  Learn the Java Virtual Machine by building your own bytecode VM.
</p>

---

ByteMong is an interactive, learner-first guide to how virtual machines work. Each topic starts with what the **JVM** does (class loading, the operand stack, the template interpreter, garbage collection, tiered JIT, Loom, safepoints) and then shows how to build the same piece for **Wisp**, a small scripting language built on functions and prototypes instead of classes.

It isn't interview prep. Every lesson pairs a live simulation with questions that are answered twice: once as a plain-language intuition and once "under the hood".

## What's inside

- **A 16-stop roadmap**, from "how code runs" to profiling and tuning your own VM.
- **Explore Architecture**, an interactive map of the whole VM. Click any component to see its JVM counterpart, what the JVM teaches about it, and a build plan with Rust sketches.
- **11 live simulations**:
  - bytecode stepper with an operand stack
  - stack/heap visualizer
  - tri-color mark & sweep
  - dispatch loop with quickening
  - open/closed upvalues
  - hidden-class shapes and inline caches
  - tiered JIT with deoptimization
  - fibers on carrier threads (with pinning)
  - safepoints and time-to-safepoint
  - module loading phases
  - the source → bytecode pipeline
- **Build-along steps** for each lesson, with Rust code for the VM itself.

## Lessons

| #  | Stop                         | Level        |
| -- | ---------------------------- | ------------ |
| 00 | How Code Runs                | Foundational |
| 01 | VM Architecture (explorer)   | Foundational |
| 02 | Lexing, Parsing & ASTs       | Foundational |
| 03 | Designing Bytecode           | Foundational |
| 04 | Compiling to Bytecode        | Intermediate |
| 05 | Stack, Heap & Values         | Foundational |
| 06 | Module Loading & Linking     | Intermediate |
| 07 | The Dispatch Loop            | Intermediate |
| 08 | Functions, Closures & Upvalues | Intermediate |
| 09 | Objects Without Classes      | Intermediate |
| 10 | Garbage Collection           | Intermediate |
| 11 | Tiered Execution & JIT       | Advanced     |
| 12 | Fibers & Concurrency         | Advanced     |
| 13 | Safepoints & Memory Model    | Advanced     |
| 14 | Native Interface & Off-Heap  | Advanced     |
| 15 | Profiling, Flags & Debugging | Advanced     |

## Running locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build   # production build (all lessons are prerendered)
npm run lint
```

The navbar's star badge reads live from the GitHub API. To point it at a fork, set:

```bash
NEXT_PUBLIC_GITHUB_REPO=your-name/your-fork
```

## Project layout

```
src/
  app/                 routes: home, /architecture, /learn/[slug]
  content/             lesson text, roadmap order, architecture nodes
  components/
    sims/              one file per interactive simulation
    architecture/      the clickable VM graph
    home/              hero diagram + roadmap timeline
    lesson/            Q&A cards
```

Lesson content is plain TypeScript data in `src/content/`, so fixing a typo or adding a question doesn't require touching any components.

## Built with

[Next.js 16](https://nextjs.org) (App Router, Cache Components), [Tailwind CSS v4](https://tailwindcss.com), [Motion](https://motion.dev) and [Lucide](https://lucide.dev) icons.

## Contributing

Issues and PRs are welcome, especially corrections to JVM details, clearer intuitions, and new simulations. Keep the tone learner-first: explain *why* before *how*.

## License

[MIT](LICENSE) © Hasnain Izhar
