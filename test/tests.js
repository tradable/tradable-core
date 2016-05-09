
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

QUnit.test( "Create Demo Account", function( assert ) {
    var done = assert.async();
    createDemoAccountWithIdentification("FOREX").then(function() {
  		assert.ok( tradableEmbed.tradingEnabled === true, "Trading is enabled" );
  		assert.ok( !!tradableEmbed.selectedAccount && tradableEmbed.selectedAccount.uniqueId !== undefined, "Account selected: " + tradableEmbed.selectedAccount.uniqueId );
  		assert.ok( !!tradableEmbed.accessToken , "Access Token saved: " + tradableEmbed.accessToken );
  		assert.ok( tradableEmbed.accounts.length > 0 , "Accounts cached" );
  		done();
  	}, function(error) {
  		QUnit.pushFailure( JSON.stringify(error.responseJSON) );
  	});
});

QUnit.test( "Search and Get Instruments", function( assert ) {
    var done = assert.async();
    tradableEmbed.searchInstruments("EUR").then(function(instrumentResults) {
  		assert.ok( instrumentResults.length > 0 , " Got " + instrumentResults.length + "Instrument Search Results " );
  		assert.ok( Object.keys(instrumentResults[0]).length === 6, "Received instrument results with 6 fields");
  		var insIds = [];
  		trEmbJQ(instrumentResults).each(function(idx, res) {
  			insIds.push(res.instrumentId);
  		});
  		assert.ok(instrumentResults.length === insIds.length, "All results have IDs");
  		return tradableEmbed.getInstrumentsFromIds(insIds);
  	}).then(function(instruments) {
  		assert.ok( instruments.instruments.length > 0 , " Got " + instruments.instruments.length + "Instruments " );
  		assert.ok( Object.keys(instruments.instruments[0]).length > 6, "Received instruments");
  		done();
  	}, function(error) {
  		QUnit.pushFailure( JSON.stringify(error.responseJSON) );
  	});
});

QUnit.test( "Start and stop candle updates", function( assert ) {
    var done = assert.async();
    var from = Date.now() - (1000 * 60 * 60 * 3); //3h
    var callbacks = 0;
    var candle;
    tradableEmbed.startCandleUpdates("EURUSD", from, 30, function(data) {
      if(callbacks > 0) {
        if(!!candle) {
          assert.ok(JSON.stringify(data[0]) !== JSON.stringify(candle), "Second update is different from previous: " + JSON.stringify(data));
          tradableEmbed.stopCandleUpdates();
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

function createDemoAccountWithIdentification(type) {
    var deferred = new trEmbJQ.Deferred();

    getAnonymousId().then(function(data) {
        var anonId = data.id;
        var demoAPIAuthenticationRequest = {"appId": tradableEmbed.app_id, "type": type, "userIdentification": anonId};
        var apiAuthentication;
        tradableEmbed.makeOsRequest("createDemoAccount", "POST", "", "", demoAPIAuthenticationRequest).then(function(auth) {
            apiAuthentication = auth;
            return tradableEmbed.enableTrading(auth.apiTokenValue, auth.apiEndpoint, auth.expires);
        }).then(function() {
            deferred.resolve(apiAuthentication);
        }, function(err) {
            deferred.reject(err);
        });
    });

    return deferred;
}

function getAnonymousId() 
{    var ajaxPromise = trEmbJQ.ajax({
        type: "GET",
        crossDomain: true,
        xhrFields: {
      withCredentials: true
    },
        url: 'https://' + tradableEmbed.oauth_host + '/analyticsId?'+window.location.host,
        contentType: "application/json; charset=utf-8",
        dataType: 'json'
    });

    return ajaxPromise;
}