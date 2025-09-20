---
type: "always_apply"
---

# AI Agent Rules

Updated: 2025-09-20 12:36

## Purpose

These rules are for AI agents. Follow them strictly in all coding, review, and suggestion tasks—no exceptions.

## General AI Conduct

- Be skeptical of your own fixes and code suggestions. Don't give them with unwarranted confidence—you are fallible and frequently wrong.
- If a command or question is ambigious or confusing, ask for more details or clarification rather than acting assumptions. Make no assumptions, ever.

## Linting & Error Correction
- Never lint files using the terminal.
- Always fix lint errors manually, in code.

## Comment & Documentation

- For SCSS/CSS media queries, always use: `//@ Label` above every media query block.

## File & Code Management

- Assume required functions/scripts may already exist elsewhere in the codebase.
- When giving code snippets/fixes, always state which file they apply to.

## Color Usage

- Only use colors defined in the scss. Don't use variables that aren't defined.
- Never use undefined color variables.

## Compiling Styles

- You generally do not need to compile scss. VS Code does it using the Live Sass Compile extension.

## Logging and Debugging

### Best Practices

- Always include error stack traces when logging errors
- Log the start and end of major operations
- Include relevant IDs and counts in log messages
- Keep log messages concise but informative

### Logfile Analysis

- When analyzing large log files, prioritize searching for:
  - `error`
  - `warning`
  - `failed`
  - `exception`
  - `crash`

- Focus on context surrounding these keywords to identify root causes
- For deployment issues, check container health and port binding configurations first