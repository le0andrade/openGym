# Forge commercial variant

This branch is the commercial Forge product built on top of
[openGym](https://github.com/DuarteSantos8/openGym), licensed under AGPL-3.0-or-later.

## Local development

```bash
cp .env.example .env
docker compose up -d --build
```

Open <http://localhost:8080>.

The default experience in this branch is Brazilian Portuguese and the passkey relying-party
display name is **Forge**.

## Exercise media

The commercial Forge variant intentionally does **not** download or display the third-party
exercise images/GIFs used by upstream openGym. Forge keeps the exercise metadata, names and
instructions, while rendering neutral placeholders until independently licensed media is introduced.

## Upstream strategy

- `main`: keep close to `DuarteSantos8/openGym` for easier upstream updates.
- `forge-commercial`: Forge product integration branch.
- Product-specific defaults live in `frontend/src/lib/forge.js`.

## License / source

Forge modifications remain under AGPL-3.0-or-later. The corresponding source for this variant
is published at <https://github.com/le0andrade/openGym>.
