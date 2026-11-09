export const site = {
  name: "ByteStack",
  tagline: "Learn the JVM by building your own bytecode VM.",
  description:
    "A learner-first walkthrough of JVM internals, reframed as a guide to building a modern bytecode virtual machine for a small scripting language.",
  // Override with NEXT_PUBLIC_GITHUB_REPO="owner/repo" when running a fork.
  repo: process.env.NEXT_PUBLIC_GITHUB_REPO ?? "imhasnainizhar/bytestack",
};

export const githubUrl = `https://github.com/${site.repo}`;
