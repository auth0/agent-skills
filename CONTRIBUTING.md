# Contributing

We appreciate feedback and contribution to this repo! Before you get started, please see [Auth0's general contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md).

## How to Contribute

### Adding a New Skill

1. Determine which plugin your skill belongs to:
   - `plugins/auth0/` - Core skills (quickstart, migration, MFA, etc.)
   - `plugins/auth0-sdks/` - Language or Framework related SDK skills
2. Create a new directory under the appropriate plugin's `skills/` directory
3. Add a `SKILL.md` file following the [Agent Skills specification](https://agentskills.io/specification)
4. Optionally add additional reference files
5. Update the README.md to list your skill in the appropriate table
6. Submit a pull request

### Skill Structure

```
plugins/auth0-sdks/skills/my-skill/
├── SKILL.md           # Required: Main skill file
├── references/        # Optional: Additional documentation
│   └── reference.md
└── scripts/           # Optional: Helper scripts
    └── helper.js
```

### SKILL.md Requirements

Your `SKILL.md` must include:

1. **YAML Frontmatter** with required fields:
   ```yaml
   ---
   name: my-skill
   description: Brief description of what this skill does and when to use it.
   license: Apache-2.0
   metadata:
     author: your-name
     version: 1.0.0
   ---
   ```

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

Use the skills reference library to validate your skills:

```bash
# Validate a specific skill
npx skills-ref validate ./plugins/auth0-sdks/skills/my-skill

# Validate all skills in a plugin
npx skills-ref validate ./plugins/auth0-sdks/skills/
```

### Testing with AI Assistants

Test your skills work correctly with AI assistants:

1. Install the plugin/skill locally:
   ```bash
   # Install entire plugin
   npx skills add ./plugins/auth0-sdks

   # Or copy to Claude skills directory
   cp -r ./plugins/auth0-sdks/skills/my-skill ~/.claude/skills/
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
