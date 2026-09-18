# Workbook source parts

`workbook.service.ts` is reconstituted from zero-padded `part00.txt` … `partNN.txt` by:

```bash
npm run assemble
# or automatically via prebuild / pretest / prestart
```

Do not add unpadded names like `part4.txt` — they are ignored by the assembler.
