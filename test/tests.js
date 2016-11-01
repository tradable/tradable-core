
QUnit.test( "test qunit framework", function( assert ) {
  assert.ok( "1" === "1", "Passed!" );
});

var minJQueryVersion = '2.1.4';
var validVersions = ['2.2.2', '2.2.1', '2.2.0', '2.1.4'];
var invalidVersions = ['2.1.3', '2.1.1', '2.1.0', '2.0.3', '2.0.2', '2.0.1', '2.0.0', '1.12.2', '1.12.1', '1.12.0', '1.11.3', '1.11.2', '1.11.1', '1.11.0', '1.10.2', '1.10.1', '1.10.0', '1.9.1', '1.9.0', '1.8.3', '1.8.2', '1.8.1', '1.8.0', '1.7.2', '1.7.1', '1.7.0', '1.6.4', '1.6.3', '1.6.2', '1.6.1', '1.6.0', '1.5.2', '1.5.1', '1.5.0', '1.4.4', '1.4.3', '1.4.2', '1.4.1', '1.4.0', '1.3.2', '1.3.1', '1.3.0', '1.2.6', '1.2.3'];

QUnit.test( "jQuery min version check", function( assert ) {
  for(var i = 0 ; i < validVersions.length ; i++) {
  	assert.ok( isGreaterOrEqualMinVersion(validVersions[i], minJQueryVersion) === true, validVersions[i] + " isGreaterOrEqualMinVersion " + minJQueryVersion );
  }
  for(i = 0 ; i < invalidVersions.length ; i++) {
  	assert.ok( isGreaterOrEqualMinVersion(invalidVersions[i], minJQueryVersion) === false, invalidVersions[i] + " isGreaterOrEqualMinVersion " + minJQueryVersion );
  }
});

QUnit.test( "Test tradableConfig object initialization", function( assert ) {
    assert.ok( tradable.testhook, "Tradable test hook is available" );
    var appId = "100010";
    var appKey = "ykuNlWoQRC";
    var configId = "OANDA";
    var scriptId = "#tradable";
    var redirectURI = "redirectURI";
    var customOAuthHost = "customOAuthHost";
    var customOAuthURL = "customOAuthURL";

    resetConfig();
    initializeConfig(scriptId, redirectURI, customOAuthHost, customOAuthURL);
    testConfig("Script ID " + scriptId);

    resetConfig();
    trEmbJQ(scriptId).attr("id", "tradable-embed");
    scriptId = "#tradable-embed";
    testConfig("Script ID " + scriptId);

    resetConfig();
    trEmbJQ("#tradable-embed").attr("id", "tradable-api");
    scriptId = "#tradable-api";
    testConfig("Script ID " + scriptId);

    resetConfig(scriptId);

    window.tradableEmbedConfig = { 'appId': appId, 'appKey': appKey, 'configId': configId, 'redirectURI': redirectURI, 'customOAuthHost': customOAuthHost, 'customOAuthURL': customOAuthURL};
    testConfig("tradableEmbedConfig object");

    resetConfig(scriptId);

    window.tradableConfig = { 'appId': appId, 'appKey': appKey, 'configId': configId, 'redirectURI': redirectURI, 'customOAuthHost': customOAuthHost, 'customOAuthURL': customOAuthURL};
    testConfig("tradableConfig object");


    function initializeConfig(scriptId, redirectURI, customOAuthURL, customOAuthHost) {
        trEmbJQ(scriptId).attr("data-redirect-uri", redirectURI);
        trEmbJQ(scriptId).attr("data-custom-oauth-url", customOAuthHost);
        trEmbJQ(scriptId).attr("data-custom-oauth-host", customOAuthURL);
    }
    function testConfig(text) {
        var config = tradable.testhook.initializeTradableConfig();
        assert.ok( config.appId === appId, text + ": Tradable App Id correctly initialized" );
        assert.ok( config.appKey === appKey, text + ": Tradable App Key correctly initialized" );
        assert.ok( config.configId === configId, text + ": Tradable Config ID correctly initialized" );
        assert.ok( config.customOAuthURL === customOAuthURL, text + ": customOAuthURL correctly initialized" );
        assert.ok( config.customOAuthHost === customOAuthHost, text + ": customOAuthHost correctly initialized" );
        assert.ok( config.redirectURI === redirectURI, text + ": redirectURI correctly initialized" );
    }
    function resetConfig(scriptId) {
      window.tradableConfig = undefined;
      window.tradableEmbedConfig = undefined;

      if(scriptId) {
        trEmbJQ(scriptId).attr("data-app-id", "");
        trEmbJQ(scriptId).attr("data-app-key", "");
        trEmbJQ(scriptId).attr("data-config-id", "");
        trEmbJQ(scriptId).attr("data-redirect-uri", "");
        trEmbJQ(scriptId).attr("data-custom-oauth-url", "");
        trEmbJQ(scriptId).attr("data-custom-oauth-host", "");
      }

      assert.ok( !tradableConfig, "Tradable Config is reset" );
    }
});

QUnit.test( "Test localStorage utilities", function( assert ) {
    var configId = "OANDA";

    testLocalStorage();

    function testLocalStorage() {
        tradable.testhook.setInLocalStorage("test", "TESTVALUE");
        assert.ok(tradable.testhook.getItemKey("test") === (configId + "test"), "Item key correctly generated");
        assert.ok(localStorage.getItem(configId + "test") === "TESTVALUE", "Config id is correctly added on the local storage");
        assert.ok(tradable.testhook.getFromLocalStorage("test") === "TESTVALUE", "item value is correctly added on the local storage");
        tradable.testhook.removeFromLocalStorage("test");
        assert.ok(!tradable.testhook.getFromLocalStorage("test"), "Local storage item is correctly removed");
    }
});

var apiToken;
QUnit.test( "Initialize with token", function( assert ) {
    var done = assert.async();

    getIdentificationToken("FOREX").then(function(token) {
      apiToken = token;
      return tradable.initializeWithToken(token.apiTokenValue, token.apiEndpoint, token.expires);
    }).then(function() {
  		assert.ok( !!tradable.accessToken , "Access Token saved: " + tradable.accessToken );
  		assert.ok( tradable.accounts.length > 0 , "Accounts cached" );
        assert.ok(tradable.getRemainingTokenMillis() > 0, "Remaining token millis available");
  		done();
  	}, function(error) {
  		QUnit.pushFailure( JSON.stringify(error.responseJSON) );
        done();
  	});
});

QUnit.test( "Refresh token", function( assert ) {
    var done = assert.async();
    tradable.refreshAuthentication(apiToken.apiRefreshTokenValue).then(function () {
        assert.ok(true, "Token refreshed");
        done();
    }, function(error) {
        QUnit.pushFailure( JSON.stringify(error.responseJSON) );
        done();
    });
});

QUnit.test( "Search and Get Instruments", function( assert ) {
    var done = assert.async();
    searchAndGetIntruments(assert, done);
});

function searchAndGetIntruments(assert, done) {
    var accountId = tradable.accounts[0].uniqueId;
    tradable.searchInstrumentsForAccount(accountId, "EUR").then(function (instrumentResults) {
        assert.ok(instrumentResults.length > 0, " Got " + instrumentResults.length + " Instrument Search Results ");
        assert.ok(Object.keys(instrumentResults[0]).length === 6, "Received instrument results with 6 fields");
        var insIds = [];
        trEmbJQ(instrumentResults).each(function (idx, res) {
            if(insIds.length < 21) {
                insIds.push(res.instrumentId);
            }
        });
        return tradable.getInstrumentsFromIdsForAccount(accountId, insIds);
    }).then(function (instruments) {
        assert.ok(instruments.instruments.length > 0, " Got " + instruments.instruments.length + " Instruments ");
        assert.ok(Object.keys(instruments.instruments[0]).length > 6, "Received instruments");
        done();
    }, function (error) {
        QUnit.pushFailure(JSON.stringify(error.responseJSON));
        done();
    });
}

QUnit.test( "Enable trading with token", function( assert ) {
    var done = assert.async();
    tradable.enableWithAccessToken(apiToken.apiTokenValue, apiToken.apiEndpoint, apiToken.expires).then(function() {
      assert.ok( tradable.tradingEnabled === true, "Trading is enabled" );
      assert.ok( !!tradable.selectedAccount && tradable.selectedAccount.uniqueId !== undefined, "Account selected: " + tradable.selectedAccount.uniqueId );
      assert.ok( !!tradable.getAccountById(tradable.selectedAccount.uniqueId) , "getAccountById" );
      done();
    }, function(error) {
      QUnit.pushFailure( JSON.stringify(error.responseJSON) );
        done();
    });
});

QUnit.test( "Authenticate with test account and an externalId", function( assert ) {
    var done = assert.async();
    authenticateWithCredentials(done, assert, "unittestjscore3@tradable.com", "tradable", 1, "myExternalUnitTestId");
});

QUnit.test( "User, AppInfo and Brokers", function( assert ) {
    var done = assert.async();
    tradable.getUser().then(function () {
        QUnit.pushFailure( "User should have failed" );
        done();
    }, function () {
        assert.ok(true, "getUser");
        return tradable.getAppInfo();
    }).then(function (appInfo) {
        assert.ok(!!appInfo && !!appInfo.name, "getAppInfo");
        return tradable.getBrokers();
    }).then(function (brokers) {
        assert.ok(!!brokers && !!brokers.length, "getBrokers");
        done();
    }, function (error) {
        QUnit.pushFailure( JSON.stringify(error.responseJSON) );
        done();
    });
});

QUnit.test( "Get Instruments From Symbol, Brokerage Accoount Symbol and From Id", function( assert ) {
    var symbol = "EURUSD";
    var instrument = tradable.getInstrumentFromSymbol(symbol);
    assert.ok(symbol === instrument.symbol, "getInstrumentFromSymbol");

    instrument = tradable.getInstrumentFromSymbol(null);
    assert.ok(!instrument, "getInstrumentFromSymbol retrieves null when symbol not valid");

    instrument = tradable.getInstrumentFromId(symbol);
    assert.ok(symbol === instrument.symbol, "getInstrumentFromId");

    instrument = tradable.getInstrumentFromId(null);
    assert.ok(!instrument, "getInstrumentFromId retrieves null when symbol not valid");

    instrument = tradable.getInstrumentFromBrokerageAccountSymbol(symbol);
    assert.ok(symbol === instrument.brokerageAccountSymbol, "getInstrumentFromId");
});

QUnit.test( "Get Account Snapshot updates", function( assert ) {
    var done = assert.async();

    var instrumentId = "USDJPY";
    tradable.addInstrumentIdToUpdates("accountSnapshoTest", instrumentId);
    tradable.on("accountSnapshotTest", "accountUpdated", function(snapshot) {
        tradable.off("accountSnapshotTest");
        var priceFound = findPrices(instrumentId, snapshot.prices);
        assert.ok(priceFound === true, "Instrument id prices received and account snapshot received");
        done();
    });
});

// Using tradableEmbed for backwards compatibility testing
QUnit.test( "Get Metrics with tradableEmbed with resolve reject callbacks", function( assert ) {
     var done = assert.async();

     tradableEmbed.getMetrics(function(metrics){
        assert.ok(!!metrics, "Account metrics received");
        tradableEmbed.getMetricsForAccount(tradableEmbed.selectedAccount.uniqueId, function(metrics){
            assert.ok(!!metrics, "Account metrics For Account received");
            done();
        }, error);
     }, error);

    function error(error) {
        QUnit.pushFailure( JSON.stringify(error.responseJSON) );
        done();
    }
});

QUnit.test( "Get Prices", function( assert ) {
     var done = assert.async();

     var instrumentIds = ["EURUSD", "USDJPY"];
     tradable.getPrices(instrumentIds).then(function(prices){
        assert.ok(!!prices, "Prices received");

        trEmbJQ(instrumentIds).each(function(idx, insId) {
           var priceFound = findPrices(insId, prices);
           assert.ok(priceFound === true, "Price received for instrument Id: " + insId);
        });

        return tradable.getPricesForAccount(tradable.selectedAccount.uniqueId, instrumentIds);
     }).then(function(prices){
        assert.ok(!!prices, "Prices For Account received");

        trEmbJQ(instrumentIds).each(function(idx, insId) {
           var priceFound = findPrices(insId, prices);
           assert.ok(priceFound === true, "Price For Account received for instrument Id: " + insId);
        });

        done();
     }, function(error) {
         QUnit.pushFailure( JSON.stringify(error.responseJSON) );
         done();
     });
});

QUnit.test( "Place, Get and Modify LIMIT order", function( assert ) {
    var done = assert.async();

    var price = 1.05;
    var newPrice = 1.04;

    placeOrder("LIMIT", 1000, price, "BUY", "EURUSD", newPrice, assert, done);
});

QUnit.test( "Place, Get and Modify STOP order", function( assert ) {
    var done = assert.async();

    var price = 1.20;
    var newPrice = 1.25;

    placeOrder("STOP", 1000, price, "BUY", "EURUSD", newPrice, assert, done);
});

function placeOrder(type, amt, price, side, insId, newPrice, assert, done) {
    var id;
    var deferred = (type === "LIMIT") ? tradable.placeLimitOrder(amt, price, side, insId) :
                                        tradable.placeStopOrder(amt, price, side, insId);
    deferred.then(function(order){
        assert.ok(order.side === side, "Order placed with side");
        assert.ok(order.amount === amt, "Order placed with amount");
        assert.ok(order.price === price, "Order placed with price");
        assert.ok(order.type === type, "Order placed with type");

        return tradable.getOrderById(order.id);
    }).then(function(order){
        assert.ok(order.side === side, "Order received with side");
        assert.ok(order.amount === amt, "Order received with amount");
        assert.ok(order.price === price, "Order received with price");
        assert.ok(order.type === type, "Order placed with type");

        id = order.id;
        return tradable.modifyOrderPrice(id, newPrice);
    }).then(function(){
        return tradable.getOrderById(id);
    }).then(function(order) {
        assert.ok(order.price === newPrice, "Order modified with price");

        return tradable.cancelOrder(id);
    }).then(function() {
        assert.ok(true, "Order cancelled successfully");
        done();
    }, function(error) {
        QUnit.pushFailure( JSON.stringify(error) );
        done();
    });
}

QUnit.test( "Place wrong order promise and get error", function( assert ) {
    var done = assert.async();

    tradable.placeMarketOrder(0, "BUY", "EURUSD").then(function(order){
        QUnit.pushFailure( "0 amount market order should have failed" );
        done();
    }, function(error) {
        assert.ok(error, "Market order failed");
        done();
    });
});

QUnit.test( "Place wrong order with reject callback and get error", function( assert ) {
    var done = assert.async();

    tradable.placeMarketOrder(0, "BUY", "EURUSD", function(order){
        QUnit.pushFailure( "0 amount market order should have failed" );
        done();
    }, function(error) {
        assert.ok(error, "Market order failed");
        done();
    });
});

QUnit.test( "Close All, Place Market Order, Reduce Amount and Close", function( assert ) {
    var done = assert.async();
    var position;
    var side = "SELL";
    var amt = 10000;
    tradable.closeAllPositions().then(function() {
      assert.ok(true, "Closed All Positions");
      return tradable.getPositions();
    }).then(function(positionsObj) {
      assert.ok(positionsObj.open.length === 0, "No Positions before starting test");
      return tradable.placeMarketOrder(amt, side, "EURUSD");
    }).then(function(order){
      assert.ok(order.side === side, "Order received with side");
      assert.ok(order.amount === amt, "Order received with amount");
      assert.ok(order.type === "MARKET", "Order placed with type");
      return tradable.getPositions();
    }).then(function(positionsObj){
      assert.ok(positionsObj.open.length > 0, "Order placed with type");
      return tradable.getPositionById(positionsObj.open[0].id);
    }).then(function(pos){
      position = pos;
      assert.ok(!!pos, 'Position with id: ' + pos.id + ' received');
      assert.ok(pos.side === side, "Position with side");
      assert.ok(pos.amount === amt, "Position with amount");
      return tradable.reducePositionToAmount(pos.id, pos.amount/2);
    }).then(function(){
      return tradable.getPositionById(position.id);
    }).then(function(position){
      assert.ok(position.amount === (amt/2), 'Position amount reduced');
      return tradable.closePosition(position.id);
    }).then(function(){
      assert.ok(true, "Position closed");
      done();
    }, function(error) {
      console.log('Error trying to decrement: ' + JSON.stringify(error.responseJSON));
    });
});

QUnit.test( "Attach TP & SL", function( assert ) {
     var done = assert.async();
     var pos;
     var instrumentId = "EURUSD";
     var side = "BUY";
     var amt = 2000;
     var tp;
     var sl;
     tradable.placeOrder(amt, 0, side, instrumentId, "MARKET").then(function(order){
        assert.ok(!!order, 'Order with id: ' + order.id + ' received');
        assert.ok(order.side === side, "Position with side");
        assert.ok(order.amount === amt, "Position with amount");

        return tradable.getOpenPositions();
     }).then(function(positions){
        pos = positions[0];
        assert.ok(pos.instrumentId === instrumentId, "Position with instrumentId");
        return tradable.getPrices([pos.symbol]);
     }).then(function(prices){
        assert.ok(!!prices[0], "Prices received");

        tp = prices[0].ask + 0.0025;
        sl = prices[0].bid - 0.0025;

        return tradable.addOrModifyProtections(pos.id, tp, sl);
    }).then(function(){
        return tradable.getPositionById(pos.id);
    }).then(function(position){
        assert.ok(position.takeprofit === tp, "TP placed: " + position.takeprofit);
        assert.ok(position.stoploss === sl, "SL placed: " + position.stoploss);
        return tradable.cancelProtections(pos.id);
    }).then(function(){
        assert.ok(true, "TP and SL cancelled");
        return tradable.closePosition(pos.id);
    }).then(function(){
      assert.ok(true, "Position closed");
      done();
    }, function(error) {
         QUnit.pushFailure(JSON.stringify(error.responseJSON));
         done();
    });
});

function placeProtectedOrder(assert, instrumentId, checkTPSL) {
    var done = assert.async();
    var pos;
    var side = "SELL";
    var amt = 1000;

    assert.throws(function () { tradable.placeProtectedOrder(amt, null, side, instrumentId, "MARKET", null, null, null); }, "Null price with Market order throws exception");
    assert.throws(function () { tradable.placeProtectedOrder(amt, 1.12, side, instrumentId, "MARKET", null, null, null); }, "Invalid price with Market order throws exception");
    assert.throws(function () { tradable.placeProtectedOrder(amt, 0, side, instrumentId, "MARKET", 1.15, 1.12, undefined); }, "Invalid bid ask with Market order throws exception");
    assert.throws(function () { tradable.placeProtectedOrder(amt, null, side, instrumentId, "LIMIT", null, null, undefined); }, "Invalid price for Limit order throws exception");

    tradable.getPrices([instrumentId]).then(function (prices) {
        var bidPrice = prices[0].bid;
        return tradable.placeProtectedOrder(amt, 0, side, instrumentId, "MARKET", bidPrice - 0.0025, bidPrice + 0.0025, bidPrice);
    }).then(function (order) {
        assert.ok(!!order, 'Order with id: ' + order.id + ' received');
        assert.ok(order.side === side, "Order with side");
        assert.ok(order.amount === amt, "Order with amount");
        assert.ok(!!order.takeProfit, "Order with Take Profit");
        assert.ok(!!order.stopLoss, "Order with Stop Loss");

        return tradable.getOpenPositions();
    }).then(function (positions) {
        pos = positions[0];
        assert.ok(pos.takeprofit, "Position with takeprofit");
        assert.ok(pos.stoploss, "Position with stoploss");
        assert.ok(pos.instrumentId === instrumentId, "Position with instrumentId");

        return tradable.cancelTakeProfit(pos.id);
    }).then(function () {
        return tradable.getPositionById(pos.id);
    }).then(function (position) {
        assert.ok(!!position && (!checkTPSL || !position.takeprofit), "cancelTakeProfitForAccount succeeded");
        return tradable.cancelStopLoss(pos.id);
    }).then(function () {
        return tradable.getPositionById(pos.id);
    }).then(function (position) {
        assert.ok(!!position && (!checkTPSL || !position.stoploss), "cancelStopLossForAccount succeeded");
        return tradable.closePosition(pos.id);
    }).then(function () {
        assert.ok(true, "Position closed");
        done();
    }, function (error) {
        QUnit.pushFailure(JSON.stringify(error.responseJSON));
        done();
    });
}

function modifyProtectedOrder(assert, instrumentId, checkTPSL) {
    var done = assert.async();
    var side = "BUY";
    var amt = 1000;
    var ord;

    tradable.getPrices([instrumentId]).then(function (prices) {
        var askPrice = prices[0].ask;
        return tradable.placeProtectedOrder(amt, askPrice - 0.1150, side, instrumentId, "LIMIT", null, null);
    }).then(function (order) {
        ord = order;
        assert.ok(!!order, 'Order with id: ' + order.id + ' received');
        assert.ok(order.side === side, "Order with side");
        assert.ok(order.amount === amt, "Order with amount");
        assert.ok(!order.takeProfit, "Order without Take Profit");
        assert.ok(!order.stopLoss, "Order without Stop Loss");

        return tradable.modifyProtectedOrder(ord, ord.price, ord.price + 0.0025, ord.price - 0.0025);
    }).then(function () {
        assert.ok(true, "Order modified success");
        return tradable.getOrderById(ord.id);
    }).then(function (order) {
        assert.ok(!!order.takeProfit, "Order modified and has Take Profit");
        assert.ok(!!order.stopLoss, "Order modified and has Stop Loss");
        return tradable.modifyProtectedOrder(ord, ord.price - 0.002, undefined, undefined);
    }).then(function () {
        assert.ok(true, "Order modified success");
        return tradable.getOrderById(ord.id);
    }).then(function (order) {
        assert.ok(!!order.takeProfit, "Order modified passing undefined and still has Take Profit");
        assert.ok(!!order.stopLoss, "Order modified passing undefined and still has Stop Loss");
        return tradable.cancelTakeProfitOnOrder(ord.id);
    }).then(function () {
        assert.ok(true, "TP cancelled success");
        return tradable.getOrderById(ord.id);
    }).then(function (order) {
        assert.ok((!checkTPSL || !order.takeProfit), "Take Profit on order cancelled");
        return tradable.cancelStopLossOnOrder(ord.id);
    }).then(function () {
        assert.ok(true, "SL cancelled success");
        return tradable.getOrderById(ord.id);
    }).then(function (order) {
        assert.ok((!checkTPSL || !order.stopLoss), "Stop Loss on order cancelled");
        return tradable.getPrices([instrumentId]);
    }).then(function (prices) {
        var askPrice = prices[0].ask;
        return tradable.modifyProtectedOrder(ord, null,  ord.price + 0.0025, ord.price - 0.0025, askPrice);
    }).then(function () {
        assert.ok(true, "2- Order modified success for protections cancellation with null");
        return tradable.getOrderById(ord.id);
    }).then(function (order) {
        assert.ok(!!order.takeProfit, "2- Order modified and has Take Profit for protections cancellation with null");
        assert.ok(!!order.stopLoss, "2- Order modified and has Stop Loss for protections cancellation with null");
        return tradable.modifyProtectedOrder(order, ord.price, null, null);
    }).then(function () {
        assert.ok(true, "Protections cancelled with null success");
        return tradable.getOrderById(ord.id);
    }).then(function (order) {
        assert.ok(!order.takeProfit, "Take Profit cancelled with null");
        assert.ok(!order.stopLoss, "Stop Loss cancelled with null");
        return tradable.cancelOrder(order.id);
    }).then(function () {
        assert.ok(true, "Order Successfully cancelled");
        done();
    }, function (error) {
        QUnit.pushFailure(JSON.stringify(error.responseJSON));
        done();
    });
}

QUnit.test( "Place Protected Order DISTANCE", function( assert ) {
    var instrumentId = "EURUSD";
    placeProtectedOrder(assert, instrumentId, true);
});

QUnit.test( "Place, Modify Protected Order, Cancel TP and Cancel SL DISTANCE", function( assert ) {
    var instrumentId = "EURUSD";
    modifyProtectedOrder(assert, instrumentId, true);
});

QUnit.test("Test Execution listener", function ( assert ) {
    assert.ok(tradable.accountUpdateInterval === null, "Account updates not started..");
    tradable.on("testListener", "execution", function() {});
    assert.ok(tradable.accountUpdateInterval !== null, "Account updates started after adding execution listener");
    tradable.off("testListener", "execution");
    assert.ok(tradable.accountUpdateInterval === null, "Account updates stopped after removing execution listener");

    assert.ok(!tradable.testhook.notifiedExecutions, "Notified executions undefined");

    assert.ok(tradable.testhook.getItemId(fakeOrder("orderId", "LIMIT", 1000)) === "orderId", "Order id for executions caching is correct");
    assert.ok(tradable.testhook.getItemId(fakePosition("positionId", 1000, "today", "BUY")) === "positionIdBUY1000", "Position id for executions caching is correct");
    assert.ok(tradable.testhook.getItemId(fakePosition("positionId", 0, "lastModified", "BUY")) === "positionIdlastModified", "Closed position id for executions caching is correct");

    // Test initialization
    var snapshot = fakeSnapshot(
        [fakePosition("EURUSD-2", 1000, "today", "BUY"), fakePosition("EURUSD-3", 2000, "today", "BUY")],
        [fakePosition("EURUSD-1", 0, "today", "BUY")],
        [fakeOrder("10002131", "LIMIT", 1000), fakeOrder("24562131", "MARKET", 1000)], []
    );

    var foundExecutions = tradable.testhook.findAndNotifyExecutions(snapshot);
    assert.ok(trEmbJQ.inArray("EURUSD-2BUY1000", tradable.testhook.notifiedExecutions.positions) >= 0, "Snapshot position 1 cached");
    assert.ok(trEmbJQ.inArray("EURUSD-3BUY2000", tradable.testhook.notifiedExecutions.positions) >= 0, "Snapshot position 2 cached");
    assert.ok(trEmbJQ.inArray("EURUSD-1today", tradable.testhook.notifiedExecutions.closedPositions) >= 0, "Snapshot closed position cached");
    assert.ok(trEmbJQ.inArray("10002131", tradable.testhook.notifiedExecutions.orders) >= 0, "Snapshot valid order cached");
    assert.ok(trEmbJQ.inArray("24562131", tradable.testhook.notifiedExecutions.orders) < 0, "Snapshot MARKET order not cached");

    assert.ok(!foundExecutions.positions.length, "No new positions on initialization");
    assert.ok(!foundExecutions.orders.length, "No new orders on initialization");
    assert.ok(!foundExecutions.closedPositions.length, "No new closedPositions on initialization");
    assert.ok(!foundExecutions.cancelledOrders.length, "No new cancelledOrders on initialization");

    snapshot.positions.open = trEmbJQ.grep(snapshot.positions.open, function(n) {
        return n.id !== "EURUSD-3";
    });
    snapshot.positions.open.push(fakePosition("EURUSD-3", 1000, "today", "BUY"));
    snapshot.positions.open.push(fakePosition("EURUSD-4", 1000, "today", "BUY"));
    foundExecutions = tradable.testhook.findAndNotifyExecutions(snapshot);

    assert.ok(trEmbJQ.inArray("EURUSD-3BUY2000", tradable.testhook.notifiedExecutions.positions) < 0, "Old positions are properly cleared");
    assert.ok(foundExecutions.positions.length === 2, "New positions found");

    foundExecutions = tradable.testhook.findAndNotifyExecutions(snapshot);
    assert.ok(!foundExecutions.positions.length, "No new positions on new identical snapshot");
    assert.ok(!foundExecutions.orders.length, "No new orders on new identical snapshot");
    assert.ok(!foundExecutions.closedPositions.length, "No new closedPositions on new identical snapshot");
    assert.ok(!foundExecutions.cancelledOrders.length, "No new cancelledOrders on new identical snapshot");

    tradable.testhook.resetNotifiedExecutions();
    assert.ok(!tradable.testhook.notifiedExecutions, "Notified executions correctly reset");

    function fakeSnapshot(open, recentlyClosed, pending, recentlyCancelled) {
        return {
            positions: { open: open, recentlyClosed: recentlyClosed },
            orders : { pending: pending, recentlyCancelled: recentlyCancelled }
        };
    }
    function fakePosition(id, amount, lastModified, side) {
        return {
            id: id,
            amount: amount,
            lastModified: lastModified,
            side: side
        };
    }
    function fakeOrder(id, type, amount) {
        return {
            id: id,
            type: type,
            amount: amount
        };
    }
});

QUnit.test("Test On Off listener", function ( assert ) {
    assert.throws(function () {
        tradable.on("test", "invalidEvent", function () {});
    }, "Invalid event throws exception");

    assert.throws(function () {
        tradable.on(1000, "embedReady", function () {});
    }, "Numeric namespace throws error");

    assert.throws(function () {
        tradable.on("testNullCallback", "embedReady", null);
    }, "Invalid callback throws error");

    addRemoveListener("test", "embedStarting");
    addRemoveListener("test", "embedReady");
    addRemoveListener("test", "accountUpdated");
    addRemoveListener("test", "tokenWillExpire");
    addRemoveListener("test", "reLoginRequired");
    addRemoveListener("test", "execution");
    addRemoveListener("test", "twoFactorAuthentication");

    function addRemoveListener(namespace, listener) {
        // Add listener
        var callback = function () {};
        tradable.on(namespace, listener, callback);
        assert.ok(tradable.testhook.callbackHolder[listener][namespace] === callback, "Callback was saved for " + listener);

        assert.throws(function () {
            tradable.on(namespace, listener, function () {});
        }, "Repeated listener throws error");

        // Add second listener
        var namespace2 = namespace + "2";
        tradable.on(namespace2, listener, callback);

        // Remove first listener
        tradable.off(namespace, listener);
        assert.ok(!tradable.testhook.callbackHolder[listener][namespace], "Callback is successfully turned off for " + listener);

        // Remove second listener
        tradable.off(namespace2, listener);
        assert.ok(!tradable.testhook.callbackHolder[listener], "Listener was removed after no namespaces left for " + listener);

        // Add faulty callback and make sure it does not crash the notifier
        tradable.on("someNamespace", listener, function() {
            throw "Some exception";
        });
        var executed = 0;
        tradable.on("someNamespace2", listener, function() {
            executed = 1;
        });
        tradable.testhook.notifyNamespaceCallbacks(listener);

        assert.ok(executed === 1, listener + " callback that throws exception does not crash the notifier");
    }
});

QUnit.test("Test onEmbedReady", function ( assert ) {
    var callback = function () {};
    tradable.onEmbedReady(callback);
    var found = false;
    for(var i = 0; i < tradable.readyCallbacks.length; i++) {
        if(tradable.readyCallbacks[i] === callback) {
            found = true; break;
        }
    }
    assert.ok(found, "Embed ready callback added.");
    assert.throws(function () {
        tradable.onEmbedReady(null);
    }, "Invalid callback breaks");
});

QUnit.test("Test onAccountUpdated", function ( assert ) {
    var callback = function () {};
    tradable.onAccountUpdated(callback);
    tradable.onAccountUpdated(callback);
    var found = 0;
    for (var i = 0; i < tradable.testhook.accountUpdatedCallbacks.length; i++) {
        if(tradable.testhook.accountUpdatedCallbacks[i] === callback)
            found++;
    }
    assert.ok(found > 0, "Account updated callback added.");
    assert.ok(found === 1, "Account updated callback added only once.");
    assert.throws(function () {
        tradable.onAccountUpdated(null);
    }, "Invalid callback breaks");
    tradable.setAccountUpdateFrequencyMillis(100000000);
});

QUnit.test("Test calculatePipSize, calculatePositionSize, calculatePositionSizeForRiskPercentage and calculatePositionSizeForRiskAmount", function ( assert ) {
    assert.throws(function () {
        tradable.calculatePipSize("adfasdfasdf");
    }, "Invalid instrument to calculatePipSize throws error.");
    assert.ok(tradable.calculatePipSize("EURUSD") === 0.0001, "Pip size correctly calculated for EURUSD");
    assert.ok(tradable.calculatePipSize("USOil") === 0.01, "Pip size correctly calculated for USOil");
    assert.ok(tradable.calculatePipSize("GER30") === 1, "Pip size correctly calculated for GER30");

    assert.throws(function () {
        tradable.calculatePositionSize(1000, false, 25, 1.15);
    }, "Invalid risk and riskIsMoney combination fails.");

    var moneyToRisk = 15000;
    var stopLossPips = 25;
    var pipValue = 0.0001;
    var posSizeMoney = tradable.calculatePositionSize("EURUSD", moneyToRisk, true, stopLossPips, pipValue, 100000);
    var posSizePerc = tradable.calculatePositionSize("EURUSD", 15, false, stopLossPips, pipValue, 100000);
    assert.ok(posSizeMoney === posSizePerc, "Both ways of calculatePositionSize coincide " + posSizeMoney + ", " + posSizePerc);

    var result = (moneyToRisk / stopLossPips) / pipValue;
    assert.ok(posSizeMoney === result, "Result is correct: " + posSizeMoney + ", " + result);

    pipValue = 1.15;
    posSizeMoney = tradable.calculatePositionSize("EURUSD", moneyToRisk, true, stopLossPips, pipValue);
    var perc = moneyToRisk * 100 / tradable.lastSnapshot.metrics.equity;
    posSizePerc = tradable.calculatePositionSize("EURUSD", perc, false, stopLossPips, pipValue);
    assert.ok(posSizeMoney === posSizePerc, "Both ways of calculatePositionSize coincide no equity provided " + posSizeMoney + ", " + posSizePerc);

    var posSizeMoneySpecific = tradable.calculatePositionSizeForRiskAmount("EURUSD", moneyToRisk, stopLossPips, pipValue);
    var posSizePercSpecific = tradable.calculatePositionSizeForRiskPercentage("EURUSD", perc, stopLossPips, pipValue);

    assert.ok(posSizeMoney === posSizeMoneySpecific, "calculatePositionSizeForRiskAmount same as calculatePositionSize " + posSizeMoney + ", " + posSizeMoneySpecific);
    assert.ok(posSizePercSpecific === posSizePerc, "calculatePositionSizeForRiskPercentage same as calculatePositionSize " + posSizePercSpecific + ", " + posSizePerc);
    assert.ok(posSizeMoneySpecific === posSizePercSpecific, "calculatePositionSizeForRiskAmount and calculatePositionSizeForRiskPercentage coincide too: " + posSizeMoneySpecific + ", " + posSizePercSpecific);

    // GER30 requires multipleOfMinAcount and the position size should be multiple
    var insId = "GER30";
    pipValue = 0.234123;
    posSizeMoney = tradable.calculatePositionSize(insId, moneyToRisk, true, stopLossPips, pipValue);
    var instrument = tradable.getInstrumentFromId(insId);
    assert.ok((posSizeMoney % instrument.minAmount) === 0, "Position size is multiple of minAmount " + posSizeMoney + ", miAmt: " + instrument.minAmount);
});

QUnit.test("Test getDecimalQty(amount)", function ( assert ) {
    assert.ok(tradable.testhook.getDecimalQty("10") === 0, "Invalid number returns 0 decimals");
    assert.ok(tradable.testhook.getDecimalQty(10) === 0, "Number returns 0 decimals");
    assert.ok(tradable.testhook.getDecimalQty(0.1) === 1, "10.1 returns 1 decimal");
    assert.ok(tradable.testhook.getDecimalQty(10.36) === 2, "10.21 returns 2 decimals");
    assert.ok(tradable.testhook.getDecimalQty(100000.213) === 3, "100000.213 returns 3 decimals");
    assert.ok(tradable.testhook.getDecimalQty(NaN) === 0, "Number returns 0 decimals");
    assert.ok(tradable.testhook.getDecimalQty(null) === 0, "Number returns 0 decimals");
});

QUnit.test("Test roundPrice & findBandForValue", function ( assert ) {
    assert.ok(String(tradable.roundPrice("EURUSD", 1.123451121212121)) === "1.12345", "Correct rounding for EURUSD 1.123451121212121");
    assert.ok(String(tradable.roundPrice("EURUSD", 1.123451000000002)) === "1.12345", "Correct rounding for EURUSD 1.123451000000002");
    assert.ok(String(tradable.roundPrice("EURUSD", 1.123459999999991)) === "1.12346", "Correct rounding for EURUSD 1.123451999999999");
    assert.ok(String(tradable.roundPrice("EURUSD", 10023.11111999999)) === "10023.11112", "Correct rounding for EURUSD 10023.11111999999");

    assert.ok(String(tradable.roundAmount("EURUSD", 10023.11111999999)) === "10023", "Correct rounding for EURUSD 10023.11111999999");

    assert.ok(String(tradable.roundPrice("GoldUSD", 1324.7501)) === "1324.75", "Correct rounding for GoldUSD 1324.7501");
    assert.ok(String(tradable.roundPrice("GoldUSD", 1324.7508)) === "1324.751", "Correct rounding for GoldUSD 1324.7501");
    assert.ok(String(tradable.roundPrice("GoldUSD", 1324.7520000000001)) === "1324.752", "Correct rounding for GoldUSD 1324.7520000000001");
    assert.ok(String(tradable.roundPrice("GoldUSD", 1324.7)) === "1324.7", "Correct rounding for GoldUSD 1324.7");

    assert.ok(tradable.roundPrice("EUSD", 1.11111) === null, "Invalid instrument returns null");
    assert.ok(tradable.roundPrice("EURUSD", "10023.111") === null, "Invalid number returns null");
    assert.ok(tradable.roundPrice("EURUSD", function() {}) === null, "Invalid number returns null");

    var bound1 = { "lowerBound": 0, "increment": 0.00001, "decimals": 5 };
    var bound2 = { "lowerBound": 1, "increment": 0.00010, "decimals": 5 };
    var bound3 = { "lowerBound": 2, "increment": 0.00025, "decimals": 5 };
    var priceIncrements = { "priceIncrementBands": [bound1, bound2, bound3] };
    var instrument = {"priceIncrements": priceIncrements};

    assert.ok(tradable.findBandForValue(priceIncrements.priceIncrementBands, 0.12345) === bound1, "Finds correct price info from 0");
    assert.ok(tradable.findBandForValue(priceIncrements.priceIncrementBands, 1.00000) === bound2, "Finds correct price info from 1");
    assert.ok(tradable.findBandForValue(priceIncrements.priceIncrementBands, 2.54321) === bound3, "Finds correct price info from 2");
    assert.ok(tradable.findBandForValue(priceIncrements.priceIncrementBands, -1.12345) === null, "Returns null below first price bound");

    assert.ok(tradable.getPriceBand(instrument, 0.12345) === bound1, "Finds correct price info from 0");
    assert.ok(tradable.getPriceBand(instrument, 1.00000) === bound2, "Finds correct price info from 1");
    assert.ok(tradable.getPriceBand(instrument, 2.54321) === bound3, "Finds correct price info from 2");
    assert.ok(tradable.getPriceBand(instrument, -1.12345) === null, "Returns null below first price bound");

    var eurusd = tradable.getInstrumentFromSymbol("EURUSD");
    eurusd["priceIncrements"] = priceIncrements;
    assert.ok(String(tradable.roundNumber("EURUSD", 0.123451121212121, "price", true)) === "0.12345", "Correct rounding for EURUSD 0.123451121212121 using price increments");
    assert.ok(String(tradable.roundNumber("EURUSD", 1.123451000000002, "price", true)) === "1.1235", "Correct rounding for EURUSD 1.123451000000002 using price increments");
    assert.ok(String(tradable.roundNumber("EURUSD", 2.1233459999999991, "price", true)) === "2.12325", "Correct rounding for EURUSD 2.1233459999999991 using price increments");
    assert.ok(String(tradable.roundNumber("EURUSD", 0.123451121212121, "price", true)) === String(tradable.roundPriceWithIncrement("EURUSD", 0.123451121212121)), "Same result with price increment");
    assert.ok(String(tradable.roundNumber("EURUSD", 1.123451000000002, "price", true)) === String(tradable.roundPriceWithIncrement("EURUSD", 1.123451000000002)), "Same result with price increment");
    assert.ok(String(tradable.roundNumber("EURUSD", 2.1233459999999991, "price", true)) === String(tradable.roundPriceWithIncrement("EURUSD", 2.1233459999999991)), "Same result with price increment");

    bound1 = { "lowerBound": 1, "increment": 0.1, "decimals": 1 };
    bound2 = { "lowerBound": 100, "increment": 1, "decimals": 0 };
    bound3 = { "lowerBound": 1000, "increment": 100, "decimals": 0 };
    var orderSizeIncrements = { "orderSizeIncrementBands": [bound1, bound2, bound3] };
    instrument = {"priceIncrements": priceIncrements, "orderSizeIncrements": orderSizeIncrements};
    eurusd["orderSizeIncrements"] = orderSizeIncrements;
    assert.ok(tradable.getSizeBand(instrument, 3) === bound1, "Finds correct price info from 0");
    assert.ok(tradable.getSizeBand(instrument, 333) === bound2, "Finds correct price info from 1");
    assert.ok(tradable.getSizeBand(instrument, 4444) === bound3, "Finds correct price info from 2");
    assert.ok(tradable.getSizeBand(instrument, -4) === null, "Returns null below first price bound");

    assert.ok(String(tradable.roundNumber("EURUSD", 10.321, "amount", true)) === "10.3", "Correct rounding for EURUSD 10.3 using amount increments " + tradable.roundNumber("EURUSD", 10.321, "amount", true));
    assert.ok(String(tradable.roundNumber("EURUSD", 255.2, "amount", true)) === "255", "Correct rounding for EURUSD 255.2 using amount increments " + tradable.roundNumber("EURUSD", 255.2, "amount", true));
    assert.ok(String(tradable.roundNumber("EURUSD", 20055, "amount", true)) === "20100", "Correct rounding for EURUSD 20055 using amount increments");
    assert.ok(String(tradable.roundNumber("EURUSD", 10.321, "amount", true)) === String(tradable.roundAmountWithIncrement("EURUSD", 10.321)), "Same result with amount increment");
    assert.ok(String(tradable.roundNumber("EURUSD", 255.2, "amount", true)) === String(tradable.roundAmountWithIncrement("EURUSD", 255.2)), "Same result with amount increment");
    assert.ok(String(tradable.roundNumber("EURUSD", 20055, "amount", true)) === String(tradable.roundAmountWithIncrement("EURUSD", 20055)), "Same result with amount increment");
});

QUnit.test("Test calculatePipDistance", function ( assert ) {
    assert.throws(function () {
        tradable.calculatePipDistance("asdasdasd", 1.123, 1.12312);
    }, "Invalid instrumentId throws exception.");

    var pipDistance = tradable.calculatePipDistance("EURUSD", 1.13571, 1.13881);
    assert.ok(pipDistance === 31, "Pips calculated correctly for EURUSD: " + pipDistance);

    pipDistance = tradable.calculatePipDistance("EURUSD", 1.13883, 1.13571);
    assert.ok(pipDistance === -31.2, "Pips calculated correctly for EURUSD from to reversed: " + pipDistance);

    pipDistance = tradable.calculatePipDistance("GER30", 1026.16, 1028.24);
    assert.ok(pipDistance === 2.1, "Pips calculated correctly for GER30 0 precision: " + pipDistance);
});

QUnit.test("Test calculateExpectedProfitOrLoss", function ( assert ) {
    var expectedProfit = tradable.calculateExpectedProfitOrLoss(10000, 25, 0.0001);
    assert.ok(expectedProfit === 25, "Expected profit should be 25: " + expectedProfit);

    // Some pipValues are a bit more funky like USDCAD 0.00007832540288629111 - let's see if rounding works
    expectedProfit = tradable.calculateExpectedProfitOrLoss(-10000, -25, 0.00007832540288629111);
    assert.ok(expectedProfit === 19.58, "Expected profit should be 19.58: " + expectedProfit);
});

QUnit.test("Test addSymboToUpdates removeSymbolFromUpdates", function ( assert ) {
    var updateClientId = "myClientId";
    var symbol = "EURUSD";
    assert.throws(function () {
        tradable.addSymbolToUpdates("myClientId:ass", symbol);
    }, "Invalid clientId breaks");

    tradable.addSymbolToUpdates(updateClientId, symbol);
    tradable.addSymbolToUpdates(updateClientId, symbol);

    var found = findSymbolForUpdates(updateClientId);
    assert.ok(found > 0, "Symbol added to id updates");
    assert.ok(found === 1, "Symbol added to id updates only once");
    
    tradable.removeSymbolFromUpdates(updateClientId, symbol);
    found = findSymbolForUpdates(updateClientId);
    assert.ok(found === 0, "Symbol successfully removed from updates");

    function findSymbolForUpdates(cliendId) {
        var found = 0;
        for (var i = 0; i < tradable.instrumentKeysForAccountUpdates.length; i++) {
            if (tradable.instrumentKeysForAccountUpdates[i] === symbol+':'+cliendId)
                found++;
        }
        return found;
    }
});

QUnit.test("Setting Account Frequency Millis", function ( assert ) {
    assert.throws(function () {
        tradable.setAccountUpdateFrequencyMillis("invalidMillis");
    }, "Millis need to be a number");

    var millis = 1500;
    tradable.setAccountUpdateFrequencyMillis(millis);
    assert.ok(tradable.accountUpdateMillis === millis, "Account frequency millis are properly set");
});

QUnit.test("Open OAuth, getOAuthURL & set external id", function ( assert ) {
    assert.ok(tradable.auth_loc === tradable.getOAuthUrl("AUTHENTICATE"), "Correct authentication Url");
    assert.ok(tradable.login_loc === tradable.getOAuthUrl("LOGIN"), "Correct force login Url");
    assert.ok(tradable.approval_page_loc === tradable.getOAuthUrl("APPROVAL"), "Correct approval Url");
    assert.ok(tradable.broker_signup_loc === tradable.getOAuthUrl("BROKER_SIGNUP"), "Correct broker signup Url");
    assert.ok(tradable.getOAuthUrl("AUTHENTICATE", 12).indexOf(tradable.auth_loc) > -1 && tradable.getOAuthUrl("AUTHENTICATE", 12).indexOf("&broker_id="+12) > -1, "Correct authentication for specific broker Url");

    assert.ok(!tradable.external_id, "External id not set");
    var externalId = "MyCustomID";
    tradable.setExternalId(externalId);
    assert.ok(tradable.external_id === externalId, "External id is set");

    assert.ok(tradable.getOAuthUrl("AUTHENTICATE").indexOf("&external_id="+externalId), "Correct authentication Url with external id");
    assert.ok(tradable.getOAuthUrl("LOGIN").indexOf("&external_id="+externalId), "Correct authentication Url with external id");

    assert.throws(function () {
        tradable.getOAuthUrl("Wrong type");
    }, "Invalid OAuth type for URL breaks");

    assert.throws(function () {
        tradable.openOAuthPage("Wrong type", false);
    }, "Invalid OAuth endpoint type breaks");
});

QUnit.test("Test hash fragment processing", function ( assert ) {
    var accessToken = 'myToken';
    var endPoint = 'myUrl';
    var expiresIn = 'myExpiresIn';

    var hashFragment = "#access_token="+accessToken+"&endpointURL="+endPoint+"&expires_in="+expiresIn;
    var token = tradable.testhook.getTokenValuesFromHashFragment(hashFragment);

    assert.ok(token.accessToken === accessToken, "accessToken correctly extracted");
    assert.ok(token.endPoint === endPoint, "endPoint correctly extracted");
    assert.ok(token.expiresIn === expiresIn, "expiresIn correctly extracted");
});

QUnit.test( "Test getDailyClose", function( assert ) {
    var done = assert.async();
    var symbols = ["EURUSD", "USDCAD"];
    tradable.getLastDailyClose(symbols).then(function (data) {
        checkData(data, "deferred");
        tradable.getLastDailyClose(symbols, function (data) {
            checkData(data, "resolve, reject");
            done();
        }, err);
    }, err);

    function checkData(data, text) {
        assert.ok(data.length === symbols.length, text+": Received daily close for all symbols");
        assert.ok(typeof data[0].close === "number", text+": Received close price");
        assert.ok(typeof data[0].timestamp === "number", text+": Timestamp received");
        assert.ok(typeof data[0].symbol === "string", text+": Received symbol");
    }
    function err(error) {
        QUnit.pushFailure( JSON.stringify(error.responseJSON) );
        done();
    }
});

QUnit.test( "Start and stop candle updates", function( assert ) {
    var done = assert.async();
    var from = Date.now() - (1000 * 60 * 60 * 3); //3h
    var callbacks = 0;
    var candle;
    tradable.startCandleUpdates("GBPUSD", from, 30, function(data) {
        if(callbacks > 0) {
            if(!!candle) {
                assert.ok(JSON.stringify(data[0]) !== JSON.stringify(candle), "Second update is different from previous: " + JSON.stringify(data));
                tradable.stopCandleUpdates();
                done();
            } else {
                assert.ok(data.length === 1, "First update received: " + JSON.stringify(data));
                candle = trEmbJQ.extend({}, data[0]);
                assert.ok(candle.high >= candle.close, "Candle high higher or equal");
                assert.ok(candle.low <= candle.close, "Candle low lower or equal");
            }
        } else {
            assert.ok(data.length > 4, "30 min candles since 3h ago. More than 5 candles received: " + JSON.stringify(data));
        }
        callbacks++;
    });
});

QUnit.test( "Reset instrument cache clears the lists", function( assert ) {
    assert.ok(tradable.availableCategories.length, "availableCategories has length");
    assert.ok(tradable.availableInstruments.length, "availableInstruments has length");
    assert.ok(tradable.availableSymbols.length, "availableSymbols has length");
    assert.ok(tradable.availableCurrencies.length, "availableCurrencies has length");
    assert.ok(tradable.instrumentKeysForAccountUpdates.length, "instrumentKeysForAccountUpdates has length");

    tradable.testhook.resetInstrumentCache();

    assert.ok(!tradable.availableCategories.length, "availableCategories cleared");
    assert.ok(!tradable.availableInstruments.length, "availableInstruments cleared");
    assert.ok(!tradable.availableSymbols.length, "availableSymbols cleared");
    assert.ok(!tradable.availableCurrencies.length, "availableCurrencies cleared");
    assert.ok(!tradable.instrumentKeysForAccountUpdates.length, "instrumentKeysForAccountUpdates cleared");
});

QUnit.test( "Create demo account without appKey throws error", function( assert ) {
    var appKey = tradable.app_key;
    tradable.app_key = undefined;

    assert.throws(function () {
        tradable.createForexDemoAccount();
    }, "createForexDemoAccount without appKey breaks");

    assert.throws(function () {
        tradable.createStocksDemoAccount();
    }, "createStocksDemoAccount without appKey breaks");

    tradable.app_key = appKey;
});

QUnit.test( "Authenticate with City Index test account", function( assert ) {
    var done = assert.async();
    authenticateWithCredentials(done, assert, "DM806405", "trade123", 12);
});

QUnit.test( "Search and Get Instruments with City Index test account", function( assert ) {
    var done = assert.async();
    searchAndGetIntruments(assert, done);
});

QUnit.test( "Place Protected Order ABSOLUTE", function( assert ) {
    var instrumentId = tradable.getInstrumentFromSymbol("EURUSD").instrumentId;
    placeProtectedOrder(assert, instrumentId, false);
});

QUnit.test( "Place, Modify Protected Order, Cancel TP and Cancel SL ABSOLUTE", function( assert ) {
    var instrumentId = tradable.getInstrumentFromSymbol("EURUSD").instrumentId;
    modifyProtectedOrder(assert, instrumentId, false);
});

QUnit.test( "Exclude Account and validate token", function( assert ) {
    var accountId = tradable.selectedAccount.uniqueId;
    tradable.excludeCurrentAccount();
    var found = false;
    for (var i = 0; i < tradable.accounts.length; i++) {
        if(accountId === tradable.accounts[i].uniqueId) {
            found = true;
        }
    }
    assert.ok(!found, "Account excluded");
    tradable.testhook.validateToken();
});

QUnit.test("isReLoginRequired", function ( assert ) {
    assert.ok(!tradable.isReLoginRequired(undefined), "isReLoginRequired: undefined");
    assert.ok(!tradable.isReLoginRequired({'responseJSON': {'httpStatus': 403 }}), "isReLoginRequired no code");
    assert.ok(!tradable.isReLoginRequired({'responseJSON': {'code': 1005}}), "isReLoginRequired no status");
    assert.ok(!tradable.isReLoginRequired({'responseJSON': {'httpStatus': 403, 'code': 105}}), "isReLoginRequired wrong code");
    assert.ok(!tradable.isReLoginRequired({'responseJSON': {'httpStatus': 43, 'code': 1005}}), "isReLoginRequired wrong status");
    assert.ok(tradable.isReLoginRequired({'responseJSON': {'httpStatus': 403, 'code': 1005}}), "isReLoginRequired");
});

QUnit.test("isTokenExpiredCode", function ( assert ) {
    assert.ok(!tradable.isTokenExpiredCode(undefined), "isTokenExpiredCode: undefined");
    assert.ok(!tradable.isTokenExpiredCode({'responseJSON': {'httpStatus': 403 }}), "isTokenExpiredCode no code");
    assert.ok(!tradable.isTokenExpiredCode({'responseJSON': {'code': 1007}}), "isTokenExpiredCode no status");
    assert.ok(!tradable.isTokenExpiredCode({'responseJSON': {'httpStatus': 403, 'code': 107}}), "isTokenExpiredCode wrong code");
    assert.ok(!tradable.isTokenExpiredCode({'responseJSON': {'httpStatus': 43, 'code': 1007}}), "isTokenExpiredCode wrong status");
    assert.ok(tradable.isTokenExpiredCode({'responseJSON': {'httpStatus': 403, 'code': 1007}}), "isTokenExpiredCode");
});

QUnit.test("isTwoFactorAuthenticationRequired", function ( assert ) {
    assert.ok(!tradable.isTwoFactorAuthenticationRequired(undefined), "isTwoFactorAuthenticationRequired: undefined");
    assert.ok(!tradable.isTwoFactorAuthenticationRequired({'responseJSON': {'httpStatus': 403 }}), "isTwoFactorAuthenticationRequired no code");
    assert.ok(!tradable.isTwoFactorAuthenticationRequired({'responseJSON': {'code': 2701}}), "isTwoFactorAuthenticationRequired no status");
    assert.ok(!tradable.isTwoFactorAuthenticationRequired({'responseJSON': {'httpStatus': 403, 'code': 207}}), "isTwoFactorAuthenticationRequired wrong code");
    assert.ok(!tradable.isTwoFactorAuthenticationRequired({'responseJSON': {'httpStatus': 43, 'code': 2701}}), "isTwoFactorAuthenticationRequired wrong status");
    assert.ok(tradable.isTwoFactorAuthenticationRequired({'responseJSON': {'httpStatus': 403, 'code': 2701}}), "isTwoFactorAuthenticationRequired");
});

QUnit.test("Tradable logging", function ( assert ) {
    tradable.log("test");
    tradable.warn("test");
    tradable.error("test");
    assert.ok(true, "Tradable logging does not break");
});

QUnit.test("Sign Out", function ( assert ) {
    signOut(assert);
});

function authenticateWithCredentials(done, assert, login, pass, brokerId, externalId) {
    var resolve = function () {
        assert.ok( tradable.tradingEnabled === true, "Trading is enabled" );
        assert.ok( !!tradable.selectedAccount && tradable.selectedAccount.uniqueId !== undefined, "Account selected: " + tradable.selectedAccount.uniqueId );
        assert.ok( !!tradable.selectedAccount && tradable.selectedAccount.brokerId === brokerId, "Correct account selected" );
        done();
    };
    var reject = function (err) {
        QUnit.pushFailure(JSON.stringify((err.responseJSON) ? err.responseJSON : err));
        done();
    };

    var appKey = tradable.app_key;
    tradable.app_key = undefined;
    assert.throws(function () {
        tradable.authenticateWithCredentials(brokerId, login, pass, resolve, reject);
    }, "Authentication without appKey breaks");
    tradable.app_key = appKey;

    if(externalId) {
        tradable.authenticateWithCredentials(brokerId, login, pass, externalId, resolve, reject);
    } else {
        tradable.authenticateWithCredentials(brokerId, login, pass, resolve, reject);
    }

}

function signOut(assert) {
    tradable.signOut();
    assert.ok(tradable.tradingEnabled === false, "Trading disabled");

    assert.ok(!tradable.testhook.getFromLocalStorage('accessToken'+tradable.app_id), "accessToken removed from storage"+tradable.testhook.getFromLocalStorage('accessToken'+tradable.app_id));
    assert.ok(!tradable.testhook.getFromLocalStorage('authEndpoint'+tradable.app_id), "authEndpoint removed from storage");
    assert.ok(!tradable.testhook.getFromLocalStorage('tradingEnabled'+tradable.app_id), "tradingEnabled removed from storage");
    assert.ok(!tradable.testhook.getFromLocalStorage('expirationTimeUTC'+tradable.app_id), "expirationTimeUTC removed from storage");
}

function findPrices(instrumentId, prices) {
    var priceFound = false;
    trEmbJQ(prices).each(function(idx, price) {
        if(price.instrumentId === instrumentId) {
          priceFound = true;
        }
    });
    return priceFound;
}

function getIdentificationToken(type) {
    var deferred = new trEmbJQ.Deferred();

    getAnonymousId().then(function(data) {
        var anonId = data.id;
        var demoAPIAuthenticationRequest = {"appId": tradable.app_id, "appKey": tradable.app_key, "type": type, "userIdentification": anonId};

        tradable.makeOsRequest("createDemoAccount", "POST", "", "", demoAPIAuthenticationRequest).then(function(token) {
            deferred.resolve(token);
        }, function(err) {
            deferred.reject(err);
        });
    });

    return deferred;
}

function getAnonymousId() {
    return trEmbJQ.ajax({
        type: "GET",
        crossDomain: true,
        xhrFields: {
      withCredentials: true
    },
        url: 'https://' + tradable.oauth_host + '/analyticsId?'+window.location.host,
        contentType: "application/json; charset=utf-8",
        dataType: 'json'
    });
}