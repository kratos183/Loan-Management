# docs

Documentation assets referenced by the root `README.md`.

| Folder | Purpose |
|---|---|
| `screenshots/` | Every image the README links to. Contains images only — no notes files. |

Paths are always relative to the repository root, so a file at
`docs/screenshots/user-dashboard.png` is referenced as:

```markdown
![Dashboard](docs/screenshots/user-dashboard.png)
```

The capture table — which route, which account, which filename — lives in the root
`README.md` under **Screenshots → Capturing the rest**, so the list of images and the
list of what to take them from can never drift apart.

Nothing else is stored here. Architecture notes, ADRs and API documentation belong
in the root `README.md`, [CONTRIBUTING.md](../CONTRIBUTING.md) or
[DEPLOY.md](../DEPLOY.md) — keeping them in one place is what stops them going stale
next to the code they describe.