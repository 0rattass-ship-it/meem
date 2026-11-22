<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store-wide customer-facing editable copy belongs in a singleton public settings table protected by admin-only writes, because content must persist and remain manageable without code changes.
- Product card schedule stripes use constrained database-backed color roles, because each product must stay independently editable without allowing unsafe free-form styling.
- Bank-transfer receipts use private storage with customer-owned upload paths, admin-only reads, and atomic order validation/linking in the payment RPC, so failed or missing uploads cannot confirm bank-transfer orders or expose financial images.
