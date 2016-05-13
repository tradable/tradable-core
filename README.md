# Tradable Core
[![Build Status](https://travis-ci.org/tradable/tradable-core.svg?branch=master)](https://travis-ci.org/tradable/tradable-core) [![npm version](https://badge.fury.io/js/tradable-core.svg)](http://badge.fury.io/js/tradable-core) [![Dependency Status](https://david-dm.org/tradable/tradable-core.svg)](https://david-dm.org/tradable/tradable-core) [![Code Climate](https://codeclimate.com/github/tradable/tradable-core/badges/gpa.svg)](https://codeclimate.com/github/tradable/tradable-core)

Tradable lets users trade from any app by connecting multiple brokerages through one modern API. This project is a lightweight JavaScript wrapper of the Tradable API that will make the integration with it really easy.

[![NPM](https://nodei.co/npm/tradable-core.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/tradable-core/)

Documentation: https://tradable.github.io/js/docs/

## Getting Started

These instructions will help you understand how to get started with Tradable Core.

### Prerequisities

Tradable core requires jQuery 2.1.4 and it uses it in [noConflict](https://api.jquery.com/jquery.noconflict/) mode. Meaning that after Tradable core is executed, the jQuery variable is scoped in the global object '**trEmbJQ**'. 

**Tip!** If you want to reuse the same jQuery version, you can either assign the jQuery variable back to its original value (`$ = trEmbJQ;` or `jQuery = trEmbJQ;`) or just use it calling the mentioned global object.

### Integration

There are two ways of integrating Tradable core into your project:

##### Option 1 - Link our script directly

If you don't need to bundle Tradable core in your code base, then you can simply link jQuery and our script:

```html
<script src="//ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js" type="text/javascript" ></script>
<script src="//js-api.tradable.com/core/1.15.4/tradable.min.js" type="text/javascript" 
        id="tradable" data-app-id="{your_app_id}"></script>
```

##### Option 2 - Include our [npm module](https://www.npmjs.com/package/tradable-core)

```javascript
npm install jquery --save
npm install tradable-core --save
```

If you decide to go with this approach, you will need to specify the configuration before requiring core:

```javascript
jQuery = require("jquery");
tradableEmbedConfig = {"appId": your-app-id};
tradableEmbed = require("tradable-core");
//$ = trEmbJQ; // Uncomment if you want to use our jQuery version
```

### How to use

We have used our knowledge building trading applications to create a framework that will make it really easy to implement any trading application. We will start explaining how to use this framework. However, if our framework does not fit you, you can still use the [light integration](https://github.com/tradable/tradable-core#light-integration).

##### Authentication

The first thing you need to solve to trade enable your application is the authentication. The most common way to authenticate with the Tradable API is OAuth2 and there are 2 ways to initiate authentication:

You can open the authentication window in a small window the way Facebook does:
```javascript
tradableEmbed.authenticateWithWindow();
```

Or you can simply redirect to the authentication page:
```javascript
tradableEmbed.authenticate();
```

##### Tradable ready event

If the user authenticates successfully Tradable Core will notify you about it as follows:
```javascript
tradableEmbed.on("myEmbedReadyListener", "embedReady", function() {
        console.log("Trading is enabled: " + tradableEmbed.tradingEnabled);
});
```

The `embedReady` listener is notified every time that the status of `tradableEmbed.tradingEnabled` changes. As you might guess, if `tradableEmbed.tradingEnabled` is `true`, it means that the OAuth token was received and the user is successfully authenticated, i.e. you can now execute trades and orders.

Turning the listener off is as easy as:
```javascript
tradableEmbed.off("myEmbedReadyListener", "embedReady");
```

##### Selected account

If the authentication is successful, Tradable Core will initialize the users' broker account before calling `embedReady`. You can access the account just calling: `tradableEmbed.selectedAccount`.

Not only that, Tradable Core will also cache the list of Tradable instruments in `tradableEmbed.availableInstruments`. If you want to access a particular instrument you can use:
```javascript
var instrument = tradableEmbed.getInstrumentFromId("EURUSD"); //synchronous
```

*Note! Some brokers do not provide the full instrument list. In that case, instruments are gradually cached by Tradable Core for the requested prices (before prices are retrieved). All instruments related to to the open positions and pending orders are cached since the beginning.*

##### Account updates and Prices

In order to keep the UI updated with the changes that happen on the account, we provide a a listener that will request the account snapshot every certain time (700 milliseconds by default) and notify with it. The account snapshot is an object that contains everything you need to know about the user's portfolio: Metrics, Positions, Orders and Prices.
```javascript
tradableEmbed.on("myAccountUpdateListener", "accountUpdated", function(snapshot) {
     console.log("New snapshot received: " + JSON.stringify(snapshot));
});
```

If you want to subscribe to prices for an instrument you can simply add the instrument id to the updates:
```javascript
tradableEmbed.addInstrumentIdToUpdates("myPricesWidget", "EURUSD");
// Now the snapshot retrieved by the "accountUpdated" event will include prices for the specified instrument
// To unsubscribe the prices:
tradableEmbed.removeInstrumentIdFromUpdates("myPricesWidget", "EURUSD");
```

You can customize the account update frequency:
```javascript
tradableEmbed.setAccountUpdateFrequencyMillis(1000); // 1 second updates
```

And as always you can turn off the updates:
```javascript
tradableEmbed.off("myAccountUpdateListener", "accountUpdated");
```

##### More

You can read about the rest of the updates and API calls in our [documentation](https://tradable.github.io/js/docs/).

### Light integration

In order to initialize Tradable Core in light mode you just need to feed it with the Tradable token values:
```javascript
tradableEmbed.initializeWithToken(accessToken, endPoint, expiresIn).then(function() {
        console.log("You can now use the Tradable API calls");
});
```

Beware! The light integration has limitations: 
- It is only possible to make API calls that **require an accountId**. 
- on/off listeners can not be used
- There won't be any instrument caching

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details