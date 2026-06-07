## Summary

<!-- What changed and why -->

## Cloud deploy checklist

Cloud/production UI comes from **`main`** only. Feature-branch pushes do not update the live site.

- [ ] PR targets **`main`**
- [ ] `npm run build` passes locally (frontend assets match CI)
- [ ] After merge: production host redeploys from **`main`** (Docker rebuild or equivalent)
- [ ] Verified cloud branch: `git log -1 origin/main` matches expected merge commit

## Test plan

- [ ] <!-- e.g. Supply chain → Workspace → Inventory Items list rows render -->
- [ ] <!-- e.g. Lazy-loaded workspace tabs open without console errors -->
