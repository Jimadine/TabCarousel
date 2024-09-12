# TabCarousel Chrome extension
This branch contains an unminified yet minimal copy of the extension. No need to run `npm gulp` to test changes.

This a bit of a frankenstein between a `dist/` build of the extension and the original source code from the `mv3` branch. There were a few changes made to put this into a working state, notably:

1. `service_worker.js` and `options.js`:

Three `Import` lines added from the original source code:
```
import { LS } from './shared.js';
import { defaults } from './shared.js';
import { constants } from './shared.js';
```

2. `service_worker.js`:

In the `#setTitle` private method, the path to the `images` subfolder was changed by prepending `..` to the `images` subfolder reference. This reflects the fact that `service_worker.js` exists in a subfolder in this branch, so the relative location of `images` differs.

3. `options.html`:

The `<script></script>` line adds `type="module"` to prevent an `Uncaught SyntaxError: Cannot use import statement outside a module` error. The `javascripts/` subfolder is also prepended to the path and `options.min.js` changed to `options.js`

```
<script type="module" src="javascripts/options.js">
```

4. `manifest.json`

Again this prepends the `javascripts/` subfolder to the path, and `service_worker.min.js` changed to `service_worker.js`.
```
"service_worker": "javascripts/service_worker.js",
```
