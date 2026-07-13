# Workflow Cross-Validation Report (Issue #46)

## Source workflow (from issue)

1. Raw transcription (external tool)
2. Artifact created (`gobi-cli`)
3. Artifact refined (multi-turn Claude Code convo)
4. Language edited (external skills: dumbify, anti-ai-writing)
5. Templatized final artifact stored as local `.md`
6. Final artifact manually reviewed and posted in app
7. Context pulled from personal vault notes (meeting notes, GTM strategy, etc.)

## Cross-validation against current `gobi-cli` capabilities

| Workflow step | Codebase support | Evidence | Notes |
|---|---|---|---|
| Raw transcription ingestion | ✅ Supported (via Sense conversations/activity reads) | `gobi <scope> conversations list/transcript` in `README.md` | CLI can read captured conversation transcripts/summaries from Gobi Sense data. |
| Create versioned artifact | ✅ Supported | `gobi <scope> artifact create --kind meeting_summary \| markdown` in `README.md` and `skills/gobi-artifact/SKILL.md` | `meeting_summary` is a first-class artifact kind. |
| Multi-turn refinement | ✅ Supported | `gobi <scope> artifact revise`, `history`, `publish` in `README.md` and `skills/gobi-artifact/SKILL.md` | Revision tree supports iterative drafting and publishing. |
| Language editing with external skills | ⚠️ External to this repo | No built-in CLI language-style transform command | This is currently a user/agent layer concern, not a `gobi-cli` command. |
| Store templatized `.md` artifact locally | ✅ Supported | `--file`, `--content`, stdin support in artifact commands (`README.md`) | You can author locally, then create/revise artifacts from files. |
| Manual final posting in app | ✅ (and automatable) | `gobi <scope> create-post ... --artifact <artifactId>` in `README.md` | CLI can attach artifacts to posts directly; manual app posting remains optional. |
| Pull context from notes/knowledge base | ✅ Partially supported natively | Vault + Sense commands in `README.md` (`vault sync`, `conversations transcript`, etc.) | Team context should come from configured Gobi vault/space data; personal external vault use bypasses shared team context. |

## Gap analysis

- No built-in `gobi-cli` command for prose simplification/stylistic rewriting (external skills remain valid).
- Workflow is compatible with current artifact and posting model, but context sourcing is strongest when done from Gobi-managed vault/space/sense surfaces instead of a private external vault.

## Recommended `gobi-cli`-first workflow

1. Ensure project/team context is available locally:
   - `gobi vault sync`
   - `gobi space warp <slug>` (or use `--space-slug`)
2. Pull recent context:
   - `gobi --json space conversations list --limit <N>`
   - `gobi --json space conversations transcript <conversationId>`
3. Create draft artifact:
   - `gobi --json space artifact create --kind meeting_summary --file draft.md --title "<title>"`
4. Iterate:
   - `gobi --json space artifact revise <artifactId> --file draft-v2.md --change-note "<what changed>"`
5. Publish chosen revision:
   - `gobi --json space artifact publish <artifactId> --revision <revisionId>`
6. Post with artifact attached:
   - `gobi --json space create-post --title "<title>" --content "<summary>" --artifact <artifactId>`

## Conclusion

The reported workflow is mostly aligned with the existing `gobi-cli` design. The main mismatch was context retrieval from a private external vault instead of Gobi-managed team context sources. For future runs, using `vault`, `space`, and `sense` command families keeps context shared, auditable, and reproducible in team workflows.
