---
type: "manual"
---

# AI Agent Rules

Updated: 2025-07-15 16:37

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

- Only use colors defined in `_variables.scss` or _colors.scss.
- Never use undefined color variables.

## File Management

- DO NOT create new files unless explicitly requested
- Assume any required functions/scripts may already exist elsewhere in the codebase
- Work with existing files only unless given permission otherwise

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