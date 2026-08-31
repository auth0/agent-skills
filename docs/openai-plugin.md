# OpenAI / Codex plugin

This repository packages the unified `auth0` skill as a skills-only OpenAI
plugin. ChatGPT and Codex use the same universal plugin format and directory.

## Package layout

```text
plugins/auth0/
├── .codex-plugin/
│   └── plugin.json
└── skills/
    └── auth0/
        ├── SKILL.md
        └── agents/
            └── openai.yaml
```

The canonical skill content is shared with the Claude and Cursor packages; do
not create a Codex-specific copy of the skill.

## Testing before submission

The repository includes an OpenAI-compatible marketplace at:

```text
.agents/plugins/marketplace.json
```

Add that marketplace in the ChatGPT desktop or Codex Plugins UI, install Auth0,
restart the host if necessary, and test in a new conversation. Test direct and
indirect authentication requests, framework routing, reference loading, and
negative requests that should not activate the skill.

The entry resolves `plugins/auth0` from the published `main` branch, so push
your changes before reinstalling — an uncommitted working tree is not what gets
installed.

For Codex CLI, inspect configured marketplaces with:

```bash
codex plugin marketplace list
codex plugin marketplace upgrade
```

## Public publication

A manifest and repository marketplace do not publish the plugin. To list Auth0 in
the universal ChatGPT and Codex directory:

1. Open the [OpenAI plugin submission portal](https://platform.openai.com/plugins).
2. Create a **Skills only** submission.
3. Upload the tested `plugins/auth0` bundle.
4. Provide Auth0 listing, legal, support, and brand metadata.
5. Add starter prompts and five positive plus three negative test cases.
6. Submit for review and publish after approval.

The OpenAI submission requires a verified developer or business identity and
Apps Management write access for the submitting organization.
