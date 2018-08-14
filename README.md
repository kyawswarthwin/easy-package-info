# easy-package-info

## Installation

    npm i easy-package-info

## Usage

```js
'use strict';

const packageInfo = require('easy-package-info');

packageInfo('android-debug.apk')
  .then(console.log)
  .catch(console.error);
```
