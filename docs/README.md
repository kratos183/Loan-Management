# docs

Documentation assets referenced by the root `README.md`.

| Folder | Purpose |
|---|---|
| `screenshots/` | Every image the README links to. See `screenshots/README.md` for the URL, account and filename for each one. |

Paths are always relative to the repository root, so a file at
`docs/screenshots/user-dashboard.png` is referenced as:

```markdown
![Dashboard](docs/screenshots/user-dashboard.png)
```

Nothing else is stored here. Architecture notes, ADRs and API documentation belong
in the root `README.md`, [CONTRIBUTING.md](../CONTRIBUTING.md) or
[DEPLOY.md](../DEPLOY.md) — keeping them in one place is what stops them going stale
next to the code they describe.