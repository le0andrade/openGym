# Summer Shredded — product scope

This document is the working product contract for the `summer-shredded` branch.

## Product model

Summer Shredded is not a generic workout builder for students. It is a closed training + nutrition product managed by the producer.

The student consumes the prescribed program, records execution/progress and follows the nutrition panel. The producer owns the global program catalogue and can change it from an admin area.

## Canonical training programs

Only two student training systems are in scope initially:

- Summer Shredded Masculino
- Summer Shredded Feminino

Both are 12-week programs with workouts A–E plus abdominal and cardio prescriptions, based on the source material supplied by the product owner.

The original external exercise-video links are not part of the product.

### Exercise media and catalogue

For each prescribed exercise:

1. Match it to an existing openGym exercise whenever the movement is equivalent.
2. Reuse the existing openGym still image and GIF animation for that exercise.
3. Preserve the producer's Portuguese display name, prescription and notes at the program level even when the underlying openGym catalogue entry has an English canonical name.
4. If there is no acceptable openGym equivalent, create a Summer Shredded catalogue exercise without image/GIF/video. Media can be added later.
5. Student-created exercises are disabled. Only the producer/admin may create global custom exercises.

## Student experience

Students cannot:

- create routines;
- edit the prescribed program structure;
- add/remove exercises from the product programs;
- create custom exercises;
- share/export a plan as a product-sharing feature.

Students can still use execution-oriented functionality that is useful to the prescribed program, such as recording loads/repetitions, workout history, timers and progress where applicable.

The student navigation should converge on a small product-focused surface, conceptually:

- Hoje / Treino
- Progresso
- Dieta
- Configurações

The generic gym check-in feature is removed from Summer Shredded.

## Producer admin

The producer has a separate admin surface and is the only person who manages global training content.

Admin capabilities:

- create/edit/remove training programs;
- create/edit/remove workouts inside a program;
- add/remove/reorder exercises;
- configure prescriptions per week;
- configure notes and techniques such as rest-pause / dead-stop;
- search and use the existing openGym exercise catalogue;
- create global custom exercises when the catalogue has no suitable movement;
- publish changes for students.

The producer does not manage customer entitlement manually in this panel.

### Admin authentication

Admin authentication is separate from Kiwify customer entitlement. Initial implementation should prefer the smallest secure option compatible with the existing stack (passkey/admin account). Password or Google OAuth can be added if needed without changing the program-content model.

## Student entitlement

Kiwify remains the commercial source of truth for student access.

Purchase/refund/entitlement handling is outside the producer's workout-content editor. A valid entitlement grants access to the student product; a revoked/refunded entitlement blocks it.

The exact assignment between the Masculino/Feminino program can be driven later by product/SKU mapping or onboarding without changing the program schema.

## Global content vs user state

Program definitions and admin-created custom exercises are global product content and must not live inside an individual student's Zustand/local workout state.

The backend should expose product-content endpoints and persist global content separately from per-user execution/history state.

Suggested logical entities:

- `programs`
- `program_workouts`
- `program_exercises`
- `custom_exercises`
- `program_versions` / publication metadata

Student state continues to store execution data such as completed sessions, loads, repetitions and progress.

## Nutrition / Diet panel

Summer Shredded adds a student nutrition area while keeping the visual language of openGym.

The source material supplied by the owner is the product basis for the initial implementation, including:

- Harris-Benedict TMB calculation for male/female;
- activity factor and GET;
- calorie target by protocol week;
- recalculation after the first six weeks;
- meal composition;
- nutritional-food table supplied in the spreadsheet;
- protein/carbohydrate/fat tracking;
- food quantities and substitutions where the source table supports them.

The initial goal is a usable product panel, not a generic calorie-tracking social app.

Suggested student diet flow:

1. Profile inputs: sex, age, height, current weight, activity level.
2. Calculated TMB and GET.
3. Current protocol week and daily calorie target.
4. Meal cards following openGym's compact card language.
5. Food/quantity editor based on the supplied nutritional table.
6. Daily totals for kcal, protein, carbohydrates and fat.
7. Weight update / week-7 recalculation flow.

## Removed / out of scope for this branch

- gym check-in cards;
- student routine builder;
- student custom exercises;
- generic plan sharing;
- original YouTube/Instagram exercise links from the source plans;
- openGym as an unrestricted general-purpose training planner for the student.

## Implementation order

1. Build the canonical male/female program data model and map source exercises to openGym catalogue IDs.
2. Add missing Summer Shredded exercises without media where necessary.
3. Introduce global backend program-content storage/API.
4. Seed the two 12-week programs.
5. Lock the student UI to prescribed content and remove check-in/share/builder surfaces.
6. Build producer admin CRUD for programs/workouts/exercises.
7. Add the nutrition domain and student Diet UI from the supplied spreadsheet/protocol.
8. Connect Kiwify entitlement to the final student gate.
9. Harden/publish for production and revisit third-party exercise-media licensing.

## Canonical catalogue audit — 2026-10-13

Catalogue v2.0.0 is implemented in `api/summer-shredded/canonical-data.js` and consumed through the existing `programs.js` exports. See `api/summer-shredded/CATALOGUE_REVIEW.md` for every mapping and its review rationale.

- Audited the complete male/female PDF text layers: 65 A–E exercise slots plus abdomen/cardio, 828 weekly cells.
- Corrected 19 workout occurrences referencing IDs absent from the shipped 1,324-entry EXDB.
- 73 mapping occurrences including conditioning options: 24 exact, 33 equivalent, 16 custom occurrences backed by 14 unique media-less product exercises.
- Preserved 12 weeks, exceptional female prescriptions, rest-pause/dead-stop, inline/general notes and H/DSDN/TSD legends. No original video URLs or licensee details are included.
- Versioned source evidence includes PDF SHA-256 and independently extracted rows. Both renders contain a LIBERAÇÃO EM 7 DIAS overlay: obscured cells were verified against text extraction, not visually certified.
- All mappings await producer review; GIF/image visual validation remains pending. Custom exercise anatomy/equipment metadata stays unknown until reviewed instead of guessing it.
- Backend draft/publication validation now rejects dangling references, classification mismatches and EXDB/custom ID collisions, including abdomen/cardio.
- Saved publications/drafts now receive a three-way reconciliation against the previous seed, as described below. Execution history is not altered.

Validation executed: `node --test api/test/summer-shredded-*.test.js` (19 passing tests). Full application suite, browser end-to-end and Docker build were not run. Docker packaging now includes the required Summer Shredded module directory.

Reproduce PDF evidence with Python + PyMuPDF 1.28.2: `python scripts/summer-shredded/extract-source.py <directory-containing-original-pdfs>`. Rebuild the mapping report with `node scripts/summer-shredded/catalogue-report.mjs`.

## Student flow and safe catalogue upgrade — 2026-10-13

On the first read of an existing content file, the backend compares each layer with the previous seed and v2. Only unchanged seed fields are corrected; producer edits, ordering, additions and deletions are retained. The exact old file is preserved as `summer-shredded-content.json.pre-v2-backup`. `catalogueMigration` records conflicts and blocked layers. Migration is idempotent. Corrupt files cause an error instead of being overwritten. A blocked published layer returns 503 until the producer saves valid draft content and publishes. Saved student history and active sessions are never migrated.

Students choose Masculino/Feminino through authenticated onboarding. Enrollment is stored separately from editable profile data and shared across devices. Start date comes from the server's São Paulo calendar; week advances every seven days and is capped at 12. Client-supplied week/start-date values are ignored. Students cannot restart enrollment. The confirmed commercial model is one package, with selection on first access and subsequent switching in the student panel; switching preserves the original date/week, history, nutrition and an existing active workout. Kiwify access still authorizes each change. The real product ID is pending the producer's setup. Admin preview retains program/week selectors without modifying student enrollment.

The home/start screen serves workouts A–E, standalone abdomen and cardio sessions, weekly prescriptions, source notes and technique guidance. Recorded loads carry over within each week's rep range; cardio duration always follows the current week. Rest timers use 90–300 seconds, and rest-pause bursts use the producer's 10 seconds. An active session cannot be overwritten by starting another.

The product shell removes check-in, student plan editing/sharing, the generic exercise library/builder and Coach routes. Workout execution locks exercise order/count, swapping, removal and set count while retaining load/repetition logging, notes, layout choices, completion and history. Rest-pause bursts remain loggable where prescribed. Source names, prescriptions, notes, program/version/week and workout ID survive completion. Legacy unfinished sessions may be saved or discarded through the product shell, without exposing their builder controls. Existing routines, gym cards and custom exercises remain stored as legacy profile data, without student editing/execution entry points.

Validation performed on local fixtures: 27 backend migration/enrollment/catalogue tests and 120 frontend adapter, completion, execution-lock and existing workout/settings regression tests passed; production frontend build passed. Real browser: authenticated Feminino onboarding, start A, record 40 kg × 12, early finish, reload and confirm history plus server persistence; removed plan/check-in routes redirect home. Mobile layout checked at 390 × 844. The local media service was not running, so image/GIF requests failed and existing fallback behavior was observed; this run does not certify exercise media. No production deployment or Docker build was performed.

## Producer, nutrition and purchase gate — 2026-10-13

The producer now edits workout structure, catalog references, weekly prescriptions, techniques and notes through the authenticated admin panel. Draft saves are separate from publication and use revision checks to reject concurrent overwrites. The student Diet tab stores profile, meal quantities, substitutions and daily meal marks in the existing synchronized profile. A reproducible source importer versions 93 foods with original units and source-row evidence; incomplete nutrient entries remain explicit. The 12-week nutrition protocol preserves seven unspecified days as pending producer definitions, and requires a week-7 weight update.

The Kiwify receiver and buyer email-code binding enforce program-specific purchase rights and revocation. Missing configuration closes student access; administrative access is retained. Only local fixture events were exercised. Actual product IDs, HTTPS webhook registration, a verified email sender, real provider payload checks and external activation remain pending. Passkey authentication remains in use; Google OAuth/password login are not implemented. See `docs/SUMMER_SHREDDED_INTEGRATION.md` for configuration, source limitations and exact validation scope.

Executed: 38 backend Summer Shredded tests, 123 selected frontend tests and production frontend build. Browser fixtures confirmed nutrition persistence, draft/publication reaching the student and refund blocking access; mobile panels inspected at 390 × 844. No real email, production deployment or Docker build was executed.

## Single-package selection update — 2026-10-13

The buyer receives one package with both programs. The first access selects Masculino/Feminino, and the student home panel now allows subsequent changes. Switching updates only the selected program and never restarts the 12-week calendar or edits history, nutrition or active workout snapshots. Server purchase permissions remain authoritative, including refusal after revocation. The producer has not yet created a real Kiwify product ID.

Executed for this update: 39 backend Summer Shredded tests and frontend production build passed. In the browser, a fixture student changed Feminino to Masculino through the confirmation dialog and retained the selection after reload. Unit/integration tests also verified preservation of a week-3 start date, unchanged personal history/nutrition and refusal of unauthorized/revoked changes.
