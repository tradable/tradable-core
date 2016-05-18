
QUnit.test( "test qunit framework", function( assert ) {
  assert.ok( "1" === "1", "Passed!" );
});

var minJQueryVersion = '2.1.4';
var validVersions = ['2.2.2', '2.2.1', '2.2.0', '2.1.4'];
var invalidVersions = ['2.1.3', '2.1.1', '2.1.0', '2.0.3', '2.0.2', '2.0.1', '2.0.0', '1.12.2', '1.12.1', '1.12.0', '1.11.3', '1.11.2', '1.11.1', '1.11.0', '1.10.2', '1.10.1', '1.10.0', '1.9.1', '1.9.0', '1.8.3', '1.8.2', '1.8.1', '1.8.0', '1.7.2', '1.7.1', '1.7.0', '1.6.4', '1.6.3', '1.6.2', '1.6.1', '1.6.0', '1.5.2', '1.5.1', '1.5.0', '1.4.4', '1.4.3', '1.4.2', '1.4.1', '1.4.0', '1.3.2', '1.3.1', '1.3.0', '1.2.6', '1.2.3'];

QUnit.test( "jQuery min version check", function( assert ) {
  for(i = 0 ; i < validVersions.length ; i++) {
  	assert.ok( isGreaterOrEqualMinVersion(validVersions[i], minJQueryVersion) === true, validVersions[i] + " isGreaterOrEqualMinVersion " + minJQueryVersion );
  }
  for(i = 0 ; i < invalidVersions.length ; i++) {
  	assert.ok( isGreaterOrEqualMinVersion(invalidVersions[i], minJQueryVersion) === false, invalidVersions[i] + " isGreaterOrEqualMinVersion " + minJQueryVersion );
  }
});

QUnit.test( "Test tradableConfig object initialization", function( assert ) {
  assert.ok( tradable.testhook, "Tradable test hook is available" );
  var appId = "100010";
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

  window.tradableEmbedConfig = { 'appId': appId, 'redirectURI': redirectURI, 'customOAuthHost': customOAuthHost, 'customOAuthURL': customOAuthURL};
  testConfig("tradableEmbedConfig object");

  resetConfig(scriptId);

  window.tradableConfig = { 'appId': appId, 'redirectURI': redirectURI, 'customOAuthHost': customOAuthHost, 'customOAuthURL': customOAuthURL};
  testConfig("tradableConfig object");


  function initializeConfig(scriptId, redirectURI, customOAuthURL, customOAuthHost) {
      trEmbJQ(scriptId).attr("data-redirect-uri", redirectURI);
      trEmbJQ(scriptId).attr("data-custom-oauth-url", customOAuthHost);
      trEmbJQ(scriptId).attr("data-custom-oauth-host", customOAuthURL);
  }
  function testConfig(text) {
      var config = tradable.testhook.initializeTradableConfig();
      assert.ok( config.appId === appId, text + ": Tradable App Id correctly initialized" );
      assert.ok( config.customOAuthURL === customOAuthURL, text + ": customOAuthURL correctly initialized" );
      assert.ok( config.customOAuthHost === customOAuthHost, text + ": customOAuthHost correctly initialized" );
      assert.ok( config.redirectURI === redirectURI, text + ": redirectURI correctly initialized" );
  }
  function resetConfig(scriptId) {
    window.tradableConfig = undefined;
    window.tradableEmbedConfig = undefined;

    if(scriptId) {
      trEmbJQ(scriptId).attr("data-app-id", "");
      trEmbJQ(scriptId).attr("data-redirect-uri", "");
      trEmbJQ(scriptId).attr("data-custom-oauth-url", "");
      trEmbJQ(scriptId).attr("data-custom-oauth-host", "");
    }

    assert.ok( !tradableConfig, "Tradable Config is reset" );
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
  		done();
  	}, function(error) {
  		QUnit.pushFailure( JSON.stringify(error.responseJSON) );
  	});
});

QUnit.test( "Search and Get Instruments", function( assert ) {
    var done = assert.async();
    var accountId = tradable.accounts[0].uniqueId;
    tradable.searchInstrumentsForAccount(accountId, "EUR").then(function(instrumentResults) {
  		assert.ok( instrumentResults.length > 0 , " Got " + instrumentResults.length + " Instrument Search Results " );
  		assert.ok( Object.keys(instrumentResults[0]).length === 6, "Received instrument results with 6 fields");
  		var insIds = [];
  		trEmbJQ(instrumentResults).each(function(idx, res) {
  			insIds.push(res.instrumentId);
  		});
  		assert.ok(instrumentResults.length === insIds.length, "All results have IDs");
  		return tradable.getInstrumentsFromIdsForAccount(accountId, insIds);
  	}).then(function(instruments) {
  		assert.ok( instruments.instruments.length > 0 , " Got " + instruments.instruments.length + "Instruments " );
  		assert.ok( Object.keys(instruments.instruments[0]).length > 6, "Received instruments");
  		done();
  	}, function(error) {
  		QUnit.pushFailure( JSON.stringify(error.responseJSON) );
  	});
});

QUnit.test( "Enable trading with token", function( assert ) {
    var done = assert.async();
    tradable.enableWithAccessToken(apiToken.apiTokenValue, apiToken.apiEndpoint, apiToken.expires).then(function() {
      assert.ok( tradable.tradingEnabled === true, "Trading is enabled" );
      assert.ok( !!tradable.selectedAccount && tradable.selectedAccount.uniqueId !== undefined, "Account selected: " + tradable.selectedAccount.uniqueId );
      done();
    }, function(error) {
      QUnit.pushFailure( JSON.stringify(error.responseJSON) );
    });
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
QUnit.test( "Get Metrics with tradableEmbed", function( assert ) {
     var done = assert.async();

     tradableEmbed.getMetrics().then(function(metrics){
        assert.ok(!!metrics, "Account metrics received");
        return tradableEmbed.getMetricsForAccount(tradableEmbed.selectedAccount.uniqueId);
     }).then(function(metrics){
       assert.ok(!!metrics, "Account metrics For Account received");
       done();
     }, function(error) {
       QUnit.pushFailure( JSON.stringify(error.responseJSON) );
     });
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
     });
});

QUnit.test( "Place, Get and Modify order", function( assert ) {
    var done = assert.async();

    var amt = 1000;
    var price = 1.05;
    var newPrice = 1.04;
    var side = "BUY";
    var insId = "EURUSD";
    var type = "LIMIT";
    var id;
    tradable.placeOrder(amt, price, side, insId, type).then(function(order){
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
      console.log('Error trying to decrement: ' + JSON.stringify(error.responseJSON));
    });
});

QUnit.test( "Start and stop candle updates", function( assert ) {
    var done = assert.async();
    var from = Date.now() - (1000 * 60 * 60 * 3); //3h
    var callbacks = 0;
    var candle;
    tradable.startCandleUpdates("EURUSD", from, 30, function(data) {
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
        assert.ok(data.length > 5, "30 min candles since 3h ago. More than 5 candles received: " + JSON.stringify(data));
      }
      callbacks++;
    });
});

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
        var demoAPIAuthenticationRequest = {"appId": tradable.app_id, "type": type, "userIdentification": anonId};
        tradable.makeOsRequest("createDemoAccount", "POST", "", "", demoAPIAuthenticationRequest).then(function(token) {
            deferred.resolve(token);
        }, function(err) {
            deferred.reject(err);
        });
    });

    return deferred;
}

function getAnonymousId() {    
    var ajaxPromise = trEmbJQ.ajax({
        type: "GET",
        crossDomain: true,
        xhrFields: {
      withCredentials: true
    },
        url: 'https://' + tradable.oauth_host + '/analyticsId?'+window.location.host,
        contentType: "application/json; charset=utf-8",
        dataType: 'json'
    });

    return ajaxPromise;
}