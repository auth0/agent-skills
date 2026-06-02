# Contributing

We appreciate feedback and contribution to this repo! Before you get started, please see [Auth0's general contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md).

## How to Contribute

### Adding a New Skill

1. Create a new directory under `plugins/auth0/skills/`
2. Add a `SKILL.md` file following the [Agent Skills specification](https://agentskills.io/specification)
3. Optionally add additional reference files
4. Update the README.md to list your skill in the appropriate table
5. Submit a pull request

### Skill Structure

Per the Agent Skills specification, **only `SKILL.md` may live in the skill root**. All other content must go in one of these subdirectories:

```
plugins/auth0/skills/my-skill/
├── SKILL.md           # Required: Main skill file (the ONLY file allowed in root)
├── references/        # Optional: Additional documentation (kebab-case .md files)
│   ├── setup.md
│   ├── integration.md
│   └── api.md
├── scripts/           # Optional: Executable helper code
│   └── helper.js
├── assets/            # Optional: Static resources (templates, images, data files)
└── tests/             # Optional: Validation artifacts (test transcripts, fixtures)
```

Markdown files in subdirectories must be **kebab-case** (e.g. `route-protection.md`). Framework integration skills conventionally split their reference docs into `setup.md`, `integration.md`, and `api.md` — follow that naming so skills stay consistent.

### SKILL.md Requirements

Your `SKILL.md` must include:

1. **YAML Frontmatter** with the following fields. `name`, `description`, `license`, `metadata.author`, and the full `metadata.openclaw` block (with `emoji` and `homepage`) are **required and enforced by the linter** — a skill missing any of them will fail validation:

   ```yaml
   ---
   name: my-skill
   description: Brief description of what this skill does and when to use it.
   license: Apache-2.0
   metadata:
     author: Auth0 <support@auth0.com>   # required, must be "Name <email>" format
     version: '1.0.0'                      # recommended; most skills pin this
     openclaw:                             # required block
       emoji: "\U0001F510"
       homepage: https://github.com/auth0/agent-skills
       requires:                           # optional: declare external dependencies
         bins:
           - auth0                         # declare `auth0` if the skill runs CLI commands
       os:                                 # optional: darwin, linux, windows
         - darwin
         - linux
       install:                            # optional: how to install required bins
         - id: brew
           kind: brew
           package: auth0/auth0-cli/auth0
           bins: [auth0]
           label: 'Install Auth0 CLI (brew)'
   ---
   ```

   Notes:
   - `license` must be `Apache-2.0` unless a specific package requires otherwise (matches the repository `LICENSE`).
   - `metadata.author` must follow `Name <email>`; separate multiple authors with commas, not semicolons.
   - The `requires`, `os`, and `install` fields under `metadata.openclaw` are [ClawHub](https://clawhub.ai) metadata used when installing the skill via `npx clawhub install`. If your skill's workflow invokes `auth0` CLI commands, declare `requires.bins: [auth0]` (and the matching `install` block) so ClawHub can prompt the user to install the CLI. Apply this consistently.

2. **Clear Instructions**: Step-by-step guidance for the AI agent

3. **Code Examples**: Working code samples for each SDK where applicable

4. **Error Handling**: Common errors and how to handle them

### Code Style

- Use TypeScript for examples where applicable
- Include comments explaining complex logic
- Follow Auth0's coding conventions
- Test code examples before submitting

### Updating Existing Skills

1. Fork the repository
2. Make your changes
3. Ensure all code examples are correct
4. Update version in metadata if significant changes
5. Submit a pull request with clear description of changes

## Local Development

### Validating Skills

This repository uses [skillsaw](https://github.com/stbenjam/skillsaw) to enforce frontmatter and structure conventions. The same check runs in CI (`.github/workflows/skillsaw.yml`) and **must pass before a PR can merge**, so run it locally first:

```bash
# Validate the whole repository in strict mode (matches CI)
uvx skillsaw --strict
```

Rules are configured in [`.skillsaw.yaml`](./.skillsaw.yaml), with repository-specific custom rules in [`.skillsaw/rules.py`](./.skillsaw/rules.py).

### Testing with AI Assistants

Test your skills work correctly with AI assistants:

1. Install the plugin/skill locally:
   ```bash
   # Install entire plugin
   npx skills add ./plugins/auth0

   # Or copy to Claude skills directory
   cp -r ./plugins/auth0/skills/my-skill ~/.claude/skills/
   ```
2. Ask an AI assistant to use the skill
3. Verify the generated code is correct

## Pull Request Process

1. Ensure your changes follow the contribution guidelines
2. Update documentation as needed
3. Add your changes to CHANGELOG.md (if applicable)
4. Request review from maintainers
5. Address any feedback

## Code of Conduct

Please follow [Auth0's Code of Conduct](https://github.com/auth0/open-source-template/blob/master/CODE-OF-CONDUCT.md).

## Questions?

If you have questions about contributing, please [open an issue](https://github.com/auth0/agent-skills/issues/new) with the "question" label.
