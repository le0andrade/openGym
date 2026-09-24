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
8. Connect Kiwify/Supabase entitlement to the final student gate.
9. Harden/publish for production and revisit third-party exercise-media licensing.
