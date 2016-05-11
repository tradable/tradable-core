# tradable-embed-core
[![npm version](https://badge.fury.io/js/tradable-embed-core.svg)](http://badge.fury.io/js/tradable-embed-core) [![Dependency Status](https://david-dm.org/tradable/tradable-embed-core.svg)](https://david-dm.org/tradable/tradable-embed-core) [![Code Climate](https://codeclimate.com/github/tradable/tradable-embed-core/badges/gpa.svg)](https://codeclimate.com/github/tradable/tradable-embed-core)

Tradable lets users trade from any app by connecting multiple brokerages through one modern API. This project is a lightweight JavaScript wrapper of the Tradable API that will make the integration with it really easy.

[![NPM](https://nodei.co/npm/tradable-embed-core.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/tradable-embed-core/)

Documentation: https://tradable.github.io/js/docs/

## Getting Started

These instructions will help you understand how to get started with Tradable Core.

### Prerequisities

Tradable core requires jQuery 2.1.4 and it uses it in [noConflict](https://api.jquery.com/jquery.noconflict/) mode. Meaning that after Tradable core is executed, the jQuery variable is scoped in the global object '**trEmbJQ**'. 

**Tip!** If you want to reuse the same jQuery version, you can either assign the jQuery variable back to its original value (`$ = trEmbJQ;` or `jQuery = trEmbJQ;`) or just use it calling the mentioned global object.

### Integration

There are two ways of integrating Tradable core into your project:

##### 1. Link our script directly

If you don't need to bundle Tradable core in your code base, then you can simply link jQuery and our script:

```html
<script src="//ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js" type="text/javascript" ></script>
<script src="//js-api.tradable.com/core/1.15.4/tradable-embed.min.js" type="text/javascript" 
        id="tradable-embed" data-app-id="{your_app_id}"></script>
```

##### 2. Include our [npm module] (https://www.npmjs.com/package/tradable-embed-core)

```javascript
npm install jquery --save
npm install tradable-embed-core --save
```

If you decide to go with this approach, you will need to specify the configuration before requiring core:

```javascript
jQuery = require("jquery");
tradableEmbedConfig = {"appId": your-app-id};
tradableEmbed = require("tradable-embed-core");
//$ = trEmbJQ; // Uncomment if you want to use our jQuery version
```
