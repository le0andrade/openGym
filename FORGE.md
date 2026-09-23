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

For the current product-testing phase, Forge temporarily displays the same exercise still images
and GIF animations used by upstream openGym. The Windows development updater points Vite at the
pinned `hasaneyldrm/exercises-dataset` media revision through jsDelivr, so those files are not
committed to or redistributed from this repository.

This is a development/testing decision only. The media is third-party content (upstream openGym
attributes it to Gym visual), is not covered by Forge/openGym's AGPL licence, and must be reviewed
or replaced before commercial production if the required rights are not independently secured.

## Upstream strategy

- `main`: keep close to `DuarteSantos8/openGym` for easier upstream updates.
- `forge-commercial`: Forge product integration branch.
- Product-specific defaults live in `frontend/src/lib/forge.js`.

## License / source

Forge modifications remain under AGPL-3.0-or-later. The corresponding source for this variant
is published at <https://github.com/le0andrade/openGym>.
