# Generation records shared by GetChecked and HumorAdmin

Both applications use the same Supabase project. Database changes alone cannot
observe Gemini or Ark HTTP traffic: deploy the updated GetChecked callers and
HumorAdmin readers/writers to start collecting new calls on the websites.

## Tables used by the admin screens

| Screen | Table | Behavior |
| --- | --- | --- |
| Users | `profiles`, `auth.users` through the existing protected RPC | Reads registered users, including accounts without completed profiles. |
| Prompt chains | `prompt_chains` | Four deployed workflows, identified by `workflow_key`. |
| Prompt chain steps | `prompt_chain_steps` | Five ordered steps, including the optional Factory revision. Linked to the configured model. |
| Prompt chain mix | `prompt_chain_mix` | Editable catalog weights and enabled flags; their values are snapshotted per call. |
| Terms | `terms` | Existing CRUD catalog. |
| Generated media / Images | `images`, Supabase Storage | Existing protected read, upload, edit, delete, preview, and publish paths. |
| Generation requests | `generation_requests` | Every dispatched model call, including GetChecked live roasts and images, Factory captions/revisions, and admin generation. |
| AI generation examples | `ai_generation_examples` | Existing CRUD catalog, optionally linked to a chain or image. |
| LLM models | `llm_models` | Actual configured Gemini model and Seedream identifier; additional observed model identifiers are registered when used. |
| LLM providers | `llm_providers` | Google Gemini and ByteDance Ark. Credentials stay in server environment variables. |
| LLM responses | `llm_responses` | Successful provider outputs and failed/cancelled attempts, linked through `request_id`. |
| Allowed signup domains | `allowed_signup_domains` | Existing CRUD catalog. |
| Whitelisted emails | `whitelisted_email_addresses` | Existing CRUD catalog. |

Terms, examples, and signup catalogs are user-managed content. The migration does
not invent entries in them or change current authentication rules. Model and mix
catalog edits retain their existing metadata behavior; execution continues to use
the deployed workflow and server model configuration. `mix_snapshot.selection`
explicitly records `deployed_workflow`, so it does not imply weighted routing.

## Recording a call

`lib/ai/audit.ts` wraps all production model adapters. Callers must pass the
verified server-side user ID and source. `record_generation_start(jsonb)` registers
the observed provider/model and saves the actual prompt payload, settings,
workflow/step, mix snapshot, timestamp, and available request/session/batch IDs
before the provider is called. A logging failure at this point prevents inference.

`record_generation_finish(uuid,jsonb)` atomically writes the response and marks
the request succeeded, failed, or cancelled. Responses include HTTP status,
duration, token/image usage when supplied, and a bounded error code. Non-JSON
provider error bodies are retained as `raw_text`. Retrying this database completion
is idempotent and does not call a provider again. Factory's second caption attempt
gets its own request ID and links to the same batch and revision step.

If a worker stops or completion logging fails, the persisted request stays
`running`; the app does not report a logged success. The records describe model
calls. Later image downloads, rendering, publication, and cleanup continue to use
their existing media/batch states.

Prompts, settings, and public provider output are retained. Inline image bytes are
replaced by MIME type, byte length, and SHA-256. Existing Factory originals remain
in private Storage. Headers, credentials, signed roast receipts, and model thought
parts are excluded. Audit records are service-role-only; existing authenticated
admin endpoints enforce administrator access before serving them to the UI.

## Compatibility and rollout

The original `llm_responses.generation_request_id` still references Factory batches
for compatibility with older deployments. New `request_id` references the
canonical `generation_requests` record for every workflow. HumorAdmin's request
screen now reads that table, and its response links filter by `request_id`.

The migration preserves any legacy batches and raw responses as `historical`
records. Missing historical prompts cannot be reconstructed. No example traffic
is inserted into production history.

Install or refresh using the existing ignored local environment:

```sh
node --env-file=.env.local --import tsx scripts/generation-audit-migrate.mjs --apply
```

The tool checks the existing catalog, applies only the additive audit migration,
seeds the actual deployed prompts/model identifiers, and preserves edited mix
weights and enabled flags. The original admin catalog migration is included for
new installations; it is not replayed over an installed catalog.

Validation includes the PGlite audit integration suite (`npm run
test:generation-audit`), existing admin/Factory/roast/provider regressions, lint,
TypeScript, and production builds. The live database write check uses a rolled
back transaction and makes no paid AI request.
