# Tradable Core

> Tradable lets users trade from any app by connecting multiple brokerages through one modern API. This project is a lightweight JavaScript wrapper of the Tradable API that will make the integration with it really easy.

[![Build Status](https://travis-ci.org/tradable/tradable-core.svg?branch=master)](https://travis-ci.org/tradable/tradable-core) [![npm version](https://badge.fury.io/js/tradable-core.svg)](http://badge.fury.io/js/tradable-core) [![Dependency Status](https://david-dm.org/tradable/tradable-core.svg)](https://david-dm.org/tradable/tradable-core) [![Code Climate](https://codeclimate.com/github/tradable/tradable-core/badges/gpa.svg)](https://codeclimate.com/github/tradable/tradable-core) [![codecov](https://codecov.io/gh/tradable/tradable-core/branch/master/graph/badge.svg)](https://codecov.io/gh/tradable/tradable-core)

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
<script src="//js-api.tradable.com/core/1.20.1/tradable.min.js" type="text/javascript" 
        id="tradable" data-app-id="{your_app_id}" data-app-key="{your_app_key}"></script>
```

##### Option 2 - Include our [npm module](https://www.npmjs.com/package/tradable-core)

```javascript
npm install jquery --save
npm install tradable-core --save
```

If you decide to go with this approach, you will need to specify the configuration before requiring core:

```javascript
jQuery = require("jquery");
tradableConfig = {"appId": your-app-id, "appKey": your-app-key};
tradable = require("tradable-core");
//$ = trEmbJQ; // Uncomment if you want to use our jQuery version
```

### How to use

We have used our knowledge building trading applications to create a framework that will make it really easy to implement any trading application. We will start explaining how to use this framework. However, if our framework does not fit you, you can still use the [light integration](https://github.com/tradable/tradable-core#light-integration).

##### Authentication

The first thing you need to solve to trade enable your application is the authentication. The most common way to authenticate with the Tradable API is OAuth2 and there are 2 ways to initiate authentication:

You can open the authentication window in a small window the way Facebook does:
```javascript
tradable.authenticateWithWindow();
```

Or you can simply redirect to the authentication page:
```javascript
tradable.authenticate();
```

##### Tradable ready event

If the user authenticates successfully Tradable Core will notify you about it as follows:
```javascript
tradable.on("myEmbedReadyListener", "embedReady", function() {
        console.log("Trading is enabled: " + tradable.tradingEnabled);
});
```

The `embedReady` listener is notified every time that the status of `tradable.tradingEnabled` changes. As you might guess, if `tradable.tradingEnabled` is `true`, it means that the OAuth token was received and the user is successfully authenticated, i.e. you can now execute trades and orders.

Turning the listener off is as easy as:
```javascript
tradable.off("myEmbedReadyListener", "embedReady");
```

##### Selected account

If the authentication is successful, Tradable Core will initialize the users' broker account before calling `embedReady`. You can access the account just calling: `tradable.selectedAccount`.

Not only that, Tradable Core will also cache the list of Tradable instruments in `tradable.availableInstruments`. If you want to access a particular instrument you can use:
```javascript
var instrument = tradable.getInstrumentFromId("EURUSD"); //synchronous
```

*Note! Some brokers do not provide the full instrument list. In that case, instruments are gradually cached by Tradable Core for the requested prices (before prices are retrieved). All instruments related to to the open positions and pending orders are cached since the beginning.*

##### Trading

Placing trades is really simple, let's say that you want to place a ``MARKET`` order to ``BUY 10.000 EURUSD``. This is how it's done:
```javascript
tradable.placeMarketOrder(10000, "BUY", "EURUSD").then(function(order) {
     // Success
}, function(jqXHR) {
     // Error
});
```

Tradable Core provides a bunch of additional helper methods to place orders, here are some examples:

- Limit order: [placeLimitOrder(amount, price, side, instrumentId)](https://tradable.github.io/js/docs/index.html#tradable.placeLimitOrder)
- Stop order: [placeStopOrder(amount, price, side, instrumentId)](https://tradable.github.io/js/docs/index.html#tradable.placeStopOrder)
- Order with protections: [placeProtectedOrder(amount, price, side, instrumentId, type, takeProfitPrice, stopLossPrice, currentBidOrAskPrice)](https://tradable.github.io/js/docs/index.html#tradable.placeProtectedOrder)
- Cancel order: [cancelOrder(orderId)](https://tradable.github.io/js/docs/index.html#tradable.cancelOrder)
- [Many more...](https://tradable.github.io/js/docs/)

Note that not all accounts support all order types, the account object (``tradable.selectedAccount``) provides information about what is supported: ``[account.takeProfitSupported, account.stopLossSupported, account.marketOrdersSupport, account.limitOrdersSupport, account.stopOrdersSupport]``

##### Portfolio: Account updates and Prices

In order to keep the UI updated with the changes that happen on the account, we provide a a listener that will request the account snapshot every certain time (700 milliseconds by default) and notify with it. The account snapshot is an object that contains everything you need to know about the user's portfolio: Metrics (``snapshot.metrics``), Positions (``snapshot.positions``), Orders (``snapshot.orders``) and Prices (``snapshot.prices``).

Here's how you subscribe to it:
```javascript
tradable.on("myAccountUpdateListener", "accountUpdated", function(snapshot) {
     console.log("New snapshot received: " + JSON.stringify(snapshot));
});
```

If you want to subscribe to prices for an instrument you can simply add the instrument id to the updates:
```javascript
tradable.addInstrumentIdToUpdates("myPricesWidget", "EURUSD");
// Now the snapshot retrieved by the "accountUpdated" event will include prices for the specified instrument
// To unsubscribe the prices:
tradable.removeInstrumentIdFromUpdates("myPricesWidget", "EURUSD");
```

You can customize the account update frequency:
```javascript
tradable.setAccountUpdateFrequencyMillis(1000); // 1 second updates
```

And as always you can turn off the updates:
```javascript
tradable.off("myAccountUpdateListener", "accountUpdated");
```

##### Additional events

In addition to the mentioned events, these are the rest of the events that should be handled by the UI to deliver a nice experience:

###### Starting

The `embedStarting` event is fired when tradable core receives a token either from the OAuth flow or direct authentication and before the account is initialized. This is useful if you want to have a loading indication that trading is being enabled, this loading indication should start when this listener is called and stopped with the `embedReady` event.

```javascript
tradable.on("myStartListener", "embedStarting", function() {});
```

###### Executions

The `execution` listener provides an easy way to listen for new positions, changes in positions (amount or side), new orders, closed positions and cancelled orders. Every time that any of those happens, the listener will be called with an object that provides the new executions.

```javascript
tradable.on("myNotificationService", "execution", function(execution) {});
```

The `execution` object looks like this:

```javascript
{
    orders: [...],
    cancelledOrders: [...],
    positions: [...],
    closedPositions: [...]
}
```

###### Token expiration

This listener gets called when the token expires. Before it's called ``tradable.tradingEnabled`` will be set to ``false`` and going through the authentication process will be required.

```javascript
tradable.on("myTokenExpiredListener", "tokenExpired", function() {});
```

###### Re-login

Sometimes, when the user connects an account from multiple clients at a time, a re-login might be required to continue trading. When this event is fired, ``tradable.tradingEnabled`` will be set to ``false`` and the UI should ask the user whether a re-login is desired or not. If a re-login is desired, either ``tradable.reLogin()`` or ``tradable.reLoginForAccount(accountId)`` should be called to resume trading.

```javascript
tradable.on("myReloginListener", "reLoginRequired", function() {});
```

###### Errors

Gets called when a general error occurs, for example an account initialization error due to a password change. 

```javascript
tradable.on("myErrorListener", "error", function(error) {});
```

###### Account switch

Gets notified every time the selectedAccount is changed (through the setSelectedAccount method). This is only applicable for apps that support multi-accounts.

```javascript
tradable.on("myAccountSwitchListener", "accountSwitch", function() {});
```

###### Token about to expire

Gets called back every 5 minutes when the remaining token time is less than 30 minutes.

```javascript
tradable.on("myTokenWillExpireListener", "tokenWillExpire", function(remainingMillis) {});
```

##### Calculation utilities

Tradable Core provides a few helper methods to perform different calculations:

- [calculatePipDistance](https://tradable.github.io/js/docs/index.html#tradable.calculatePipDistance): Calculates the distance in Pips/Points between prices.
- [calculatePositionSizeForRiskAmount](https://tradable.github.io/js/docs/index.html#tradable.calculatePositionSizeForRiskAmount): Calculates a position size for an instrument out of a given amount willing to risk.
- [calculatePositionSizeForRiskPercentage](https://tradable.github.io/js/docs/index.html#tradable.calculatePositionSizeForRiskPercentage): Calculates a position size for an instrument out of a given equity percentage willing to risk.
- [calculateExpectedProfitOrLoss](https://tradable.github.io/js/docs/index.html#tradable.calculateExpectedProfitOrLoss): Calculates the resulting equity profit or loss for a position size if a take profit or stop loss at a Pips/Points distance is hit.
- [calculatePipSize](https://tradable.github.io/js/docs/index.html#tradable.calculatePipSize): Calculates the pip size for an instrument.

### Light integration

In order to initialize Tradable Core in light mode you just need to feed it with the Tradable token values:
```javascript
tradable.initializeWithToken(accessToken, endPoint, expiresIn).then(function() {
        console.log("You can now use the Tradable API calls");
});
```

Beware! The light integration has limitations: 
- It is only possible to make API calls that **require an accountId**. 
- on/off listeners can not be used
- There won't be any instrument caching

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
