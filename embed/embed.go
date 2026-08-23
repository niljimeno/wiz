package embed

import "embed"

//go:embed index.html style.css index.js main.scm transform.js gitignore
var FS embed.FS
