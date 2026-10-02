# Workbook source parts

`_wb_parts/part00.txt` … `partNN.txt` are the only edit source. `workbook.service.ts` is generated and **tracked** so CI can detect drift.

```bash
npm run assemble          # rewrite workbook.service.ts from parts
# then commit BOTH parts and workbook.service.ts
npm test                  # pretest assembles, then tests
node scripts/check-assemble.cjs   # fail if service drifted from parts
```

Do not hand-edit `workbook.service.ts`. Do not add unpadded names like `part4.txt` (ignored). A PLACEHOLDER in a part fails the check. Version bumps: set `package.json` `version` and `src/app/version.ts` `APP_VERSION` to the same value.
