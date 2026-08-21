# Acknowledgements

This project includes or is inspired by work from the following open-source projects.

## delphitools (Background Remover)

- **Source:** https://github.com/1612elphi/delphitools
- **Live app:** https://delphi.tools/tools/background-remover
- **License:** MIT
- **Used in:** `components/tools/background-remover.tsx`, `hooks/use-file-paste.ts`

The Background Remover tool is an adapted port of delphitools' `background-remover.tsx`
component (and its `use-file-paste` hook), modified to match the avixia-tools design
system and code conventions. It uses `@huggingface/transformers` (Apache-2.0) with the
`briaai/RMBG-1.4` model — note the model weights carry BRIA's non-commercial license.

### MIT License

```
MIT License

Copyright (c) 1612elphi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## delphitools (QR Generator)

- **Source:** https://github.com/1612elphi/delphitools
- **Live app:** https://delphi.tools/tools/qr-genny
- **License:** MIT
- **Used in:** `components/tools/qr-generator.tsx`

The QR Generator tool is an adapted port of delphitools' `qr-generator.tsx` component
(including the WiFi and vCard form helpers), modified to match the avixia-tools
design system and code conventions.

### MIT License

```
MIT License

Copyright (c) 1612elphi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## delphitools (Barcode Generator)

- **Source:** https://github.com/1612elphi/delphitools
- **Live app:** https://delphi.tools/tools/code-genny
- **License:** MIT
- **Used in:** `components/tools/barcode-generator.tsx`, `lib/logic/barcode.ts`

The Barcode Generator tool is an adapted port of delphitools' `code-generator.tsx`
component, modified to match the avixia-tools design system and code conventions.
It renders via `bwip-js` (MIT) and adds SVG export alongside PNG/copy/batch ZIP.

### MIT License

```
MIT License

Copyright (c) 1612elphi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```