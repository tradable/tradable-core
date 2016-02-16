
// Save jQuery in custom variable
var trEmbJQ = jQuery.noConflict(true);

// Immediately invoked function expression (IIFE)
(function(global, $) {
    // It's good practice
    'use strict';

     /**
     * Welcome to the tradable-embed documentation. Tradable Embed is an open API to easily build financial trading features into any app, through any brokerage. This is the documentation for the tradable-embed javascript SDK, which offers 2 kits:
     * <ul><li><b>core</b>: Lightweight wrapper of the Tradable Embed API that will make the integration with Tradable Embed API really easy.</li><li><b>ui-kit</b>: See <a href='tradable-embed-ui.js.html'>here</a> (optional)</li></ul>
     *
     * In order to use the tradable-embed core, you need to include the following scripts in your site. We use jQuery in no coflict mode (<a href="https://api.jquery.com/jquery.noconflict/">what?</a>) and we assign it to the variable 'trEmbJQ':
     * <pre>&lt;script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js"&gt;&lt;/script&gt;
     * &lt;script type="text/javascript" id="tradable-embed" src="//js-api.tradable.com/core/trEmbDevVersionX/tradable-embed.min.js" data-app-id="{your_app_id}" <i>data-redirect-uri="optional-custom-redirect-uri"</i>&gt;&lt;/script&gt;</pre>
     * Alternatively, you can require our <a href="https://www.npmjs.com/package/tradable-embed-core">npm module</a>
     * <pre>npm install tradable-embed-core</pre>
     * If you do, you will have to define the tradableEmbedConfig object before requiring the module:
     * <pre>window.tradableEmbedConfig = {"appId": <i>your-app-id</i>, <i>"redirectURI": "optional-custom-redirect-uri"</i>};<br>require("tradable-embed-core")</pre>
     * <b>NOTE! The oauth flow doesn't work properly in this documentation site for the codepen examples, for the best experience please see the examples on Codepen.io, you can do that clicking on the "Edit on Codepen" link</b>
     *//**/


    if (typeof console === "undefined" || typeof console.log === "undefined") {
        global.console = { log: function() {} };
    }

    var jsVersion = "js-trEmbDevVersionX";
    var appId;
    var redirectUrl = location.href;
    var customOAuthUrl;
     if(typeof tradableEmbedConfig !== "undefined") {
        appId = tradableEmbedConfig.appId;
        customOAuthUrl = tradableEmbedConfig.customOAuthURL;
        if(!!tradableEmbedConfig.redirectURI) {
            redirectUrl = tradableEmbedConfig.redirectURI;
        }
    } else {
        var scriptId = "tradable-embed";
        if($('#' + scriptId).length === 0) { // Backwards compatibility
            scriptId = "tradable-api";
        }
        appId = $('#'+scriptId).attr("data-app-id");
        customOAuthUrl = $('#'+scriptId).attr("data-custom-oauth-url"); // Just for testing purposes
        var rURI = $('#'+scriptId).attr("data-redirect-uri");
        if(!!rURI) {
            redirectUrl = rURI;
        }
    }

    var oauthHost = "api.tradable.com";
    if(appId > 200000) { // Staging app-id
        oauthHost = "api-staging.tradable.com";
        console.log("Starting in staging mode...");
    }

    var token = localStorage.getItem("accessToken:"+appId);
    var authEndpoint = localStorage.getItem("authEndpoint:"+appId);
    var tradingEnabled = localStorage.getItem("tradingEnabled:"+appId);
    var expirationTimeUTC = localStorage.getItem("expirationTimeUTC:"+appId);

    if(tradingEnabled && (!authEndpoint || !token || !expirationTimeUTC)) {
        tradingEnabled = false;
        if(isLocalStorageSupported()) {
            localStorage.setItem("tradingEnabled:"+appId, tradingEnabled);
        }
    }
    var accountSwitchCallbacks = [];
    var accountUpdatedCallbacks = [];
    var accountUpdatedCallbackHashes = [];
    var tokenExpirationCallbacks = [];
    var tokenWillExpireCallbacks = [];
    var errorCallbacks = [];
    var processingUpdate = false;

    //Actual library obj
    var tradableEmbed = {
        app_id: appId,
        oauth_host: oauthHost,
        auth_loc: (!customOAuthUrl) ? 'https://'+oauthHost+'/oauth/authorize?client_id='+appId+'&scope=trade&response_type=token&redirect_uri='+redirectUrl
                                    : customOAuthUrl,
        add_broker_loc: 'https://'+oauthHost+'/addBroker?clientId='+appId+'&redirectURI='+redirectUrl,
        auth_window: null,
        authEndpoint : authEndpoint,
        accessToken : token,
        notifiedCallbacks : false,
        /**
         * Boolean that indicates if the user is authenticated
         */
        tradingEnabled : tradingEnabled,
        expirationTimeUTC : expirationTimeUTC,
        readyCallbacks : [],
        accounts : [],
        accountIdsToExclude : [],
        accountMap: {},
        selectedAccount : null,
        selectedAccountId : null,
        availableCategories : [],
        availableInstruments : [],
        availableSymbols : [],
        availableCurrencies : [],
        lastSnapshot: null,
        symbolKeysForAccountUpdates: [],
        accountUpdateInterval: null,
        accountUpdateMillis: 700,
        /**
         * Start oauth flow within the page
         * @param      {long} brokerId(optional) If the authentication flow needs to be opened for a certain broker, this is the id (v1/brokers)
         */
        authenticate: function (brokerId) {
            console.log("Starting oauth flow...");
            if (!tradableEmbed.tradingEnabled){
                location.href = getAuthUrl(brokerId);
            } else {
                validateToken();
            }
        },
        /**
         * @param      {long} brokerId(optional) If the authentication flow needs to be opened for a certain broker, this is the id (v1/brokers)
         */
        authenticateWithWindow: function (brokerId){
            if(ie()) {
                console.log('Window opener no supported in IE, redirecting to oauth...');
                return tradableEmbed.authenticate(brokerId);
            }
            console.log("Opening oauth window...");
            tradableEmbed.auth_window = popupwindow(getAuthUrl(brokerId), 'osLaunch', 450, 450);
        },
        /**
         * Opens the add broker account flow in a popup window(on IE versions below Edge the flow will happen on the same page)
         */
        openAddBrokerWindow: function (){
            if(ie()) {
                window.open('https://api.tradable.com');
            }
            tradableEmbed.auth_window = popupwindow(tradableEmbed.add_broker_loc, 'osAddBroker', 450, 450);
        },
        /**
         * Enables trading for the account corresponding to the given access token
         * @param      {String} access_token    The authentication token granting access to the account
         * @param      {String} end_point   The endpoint to send API requests to
         * @param      {String} expires_in  The expiry date (in milliseconds) of the access token.
         */
        enableWithAccessToken : function(access_token, end_point, expires_in){
            tradableEmbed.enableTrading(access_token, end_point, expires_in, true);
        },
        /**
         * Drops authentication token and notifies embed callbacks
         */
        signOut: function() {
            if(isLocalStorageSupported()) {
                localStorage.removeItem("accessToken:"+appId);
                localStorage.removeItem("authEndpoint:"+appId);
                localStorage.removeItem("tradingEnabled:"+appId);
                localStorage.removeItem("expirationTimeUTC:"+appId);
            }
            tradableEmbed.tradingEnabled = false;
            notifyReadyCallbacks();
        },
        /**
         * Main library state notifier, called every time the state of tradingEnabled changes
         * @param      {Function} callback Callback function to be notified
         * @jsFiddle http://codepen.io/tradableEmbed/embed/avPzgP/?height=268&theme-id=21042&default-tab=js
         */
        onEmbedReady : function (callback) {
            tradableEmbed.readyCallbacks.push(callback);
            if(tradableEmbed.notifiedCallbacks) {
                callback();
            }
        },
        /**
         * Gets notified with a new account snapshot every certain time (700 millis by default)
         * @param      {Function} callback Callback function to be notified
         * @jsFiddle http://codepen.io/tradableEmbed/embed/rObOqE/?height=268&theme-id=21042&default-tab=js
         */
        onAccountUpdated : function(callback) {
            if(!!callback) {
                if(accountUpdatedCallbacks.length === 0) {
                    tradableEmbed.accountUpdateInterval = setInterval(processAccountUpdate, tradableEmbed.accountUpdateMillis);
                }
                var callbackHash = hashCode(callback.toString());
                if($.inArray(callbackHash, accountUpdatedCallbackHashes) === -1) {
                    accountUpdatedCallbacks.push(callback);
                    accountUpdatedCallbackHashes.push(callbackHash);
                }
            }
        },
        /**
         * Customize the frequency for account snapshot updates (onAccountUpdated)
         * @param      {long} accUpdateMillis Frequency in milliseconds
         */
        setAccountUpdateFrequencyMillis: function(accUpdateMillis) {
            if(!!accUpdateMillis && accUpdateMillis > 0) {
                tradableEmbed.accountUpdateMillis = accUpdateMillis;
                if(!!tradableEmbed.accountUpdateInterval) {
                    clearInterval(tradableEmbed.accountUpdateInterval);
                    tradableEmbed.accountUpdateInterval = setInterval(processAccountUpdate, tradableEmbed.accountUpdateMillis);
                }
            } else {
                console.error("Please specify a valid update frequency");
            }
        },
        /**
         * Subscribe for the given instrument symbol's prices on the account snaphot updates (onAccountUpdated)
         * @param      {String} updateClientId Id for the element that is requesting the prices, only when no ids are subscribed to a symbol will the symbol be removed from the updates
         * @param      {String} symbolToAdd Instrument symbol for the prices
         */
        addSymbolToUpdates: function(updateClientId, symbolToAdd) {
            if(updateClientId.indexOf(":") !== -1) {
                console.error("It is not allowed to include a colon ':' in the updateClientId");
                return;
            }
            var symbolKey = symbolToAdd + ":" + updateClientId;
            if($.inArray(symbolKey, tradableEmbed.symbolKeysForAccountUpdates) === -1 &&
                $.inArray(symbolToAdd, tradableEmbed.availableSymbols) !== -1) {
                tradableEmbed.symbolKeysForAccountUpdates.push(symbolKey);
            }
        },
        /**
         * Unsubscribe for the given instrument symbol's prices on the account snaphot updates (onAccountUpdated)
         * @param      {String} updateClientId Id for the element that is requesting the prices, only when no ids are subscribed to a symbol will the symbol be removed from the updates
         * @param      {String} symbolToAdd Instrument symbol for the prices
         */
        removeSymbolFromUpdates: function(updateClientId, symbolToRemove) {
            var symbolKey = symbolToRemove + ":" + updateClientId;
            tradableEmbed.symbolKeysForAccountUpdates = $.grep(tradableEmbed.symbolKeysForAccountUpdates, function(value) {
                return value != symbolKey;
            });
        },
        /**
         * Gets notified every time the selectedAccount is changed (through the setSelectedAccount method)
         * @param      {Function} callback Callback function to be notified
         */
        onAccountSwitch : function(callback) {
            if(!!callback) {
                 if($.inArray(callback, accountSwitchCallbacks) === -1) {
                    accountSwitchCallbacks.push(callback);
                }
            }
        },
        /**
         * Gets called back when the token expires
         * @param      {Function} callback Callback function to be notified
         */
        onTokenExpired: function(callback) {
            if(!!callback) {
                if($.inArray(callback, tokenExpirationCallbacks) === -1) {
                    tokenExpirationCallbacks.push(callback);
                }
            }
        },
        /**
         * Gets called when a general error occurs, for example an account initialization error due to a password change
         * @param      {Function} callback Callback function to be notified
         */
        onError: function(callback) {
            if($.inArray(callback, errorCallbacks) === -1) {
                errorCallbacks.push(callback);
            }
        },
        /**
         * Gets called back every 5 minutes when the remaining token time is less than 30 minutes
         * @param      {Function} callback Callback function to be notified
         */
        onTokenWillExpire: function(callback) {
            if(tokenWillExpireCallbacks.length === 0) {
                setInterval(processTokenWillExpire, 300000); // 5 minutes
            }
            if($.inArray(callback, tokenWillExpireCallbacks) === -1) {
                tokenWillExpireCallbacks.push(callback);
            }
            function processTokenWillExpire() {
                var remainingMillis = tradableEmbed.getRemainingTokenMillis();
                if(!!remainingMillis && remainingMillis > 0 && remainingMillis < 1800000) { // 30 minutes
                    $(tokenWillExpireCallbacks).each(function(index, callback){
                        callback(remainingMillis);
                    });
                }
            }
        },
        /**
         * Returns the remaining milliseconds for the token to expire
         * @return     {long} remainingMillis Remaining milliseconds for the token to expire
         */
        getRemainingTokenMillis : function() {
            if(!tradableEmbed.expirationTimeUTC) {
                console.log("You need to authenticate before calling this method");
            }
            return (tradableEmbed.expirationTimeUTC - new Date().getTime());
        },
        makeOsRequest : function (reqType, type, accountId, method, postData, resolve, reject){
            var endpoint;
            if(reqType === "apps" || reqType === "brokers") {
                endpoint = 'https://'+oauthHost;
            } else if(accountId !== undefined && accountId !== null && accountId.length === 0) {
                endpoint = tradableEmbed.authEndpoint;
            } else if(!!tradableEmbed.accountMap[accountId]) {
                endpoint = tradableEmbed.accountMap[accountId].endpointURL;
            } else {
                console.info("Please specify a valid accountId or method");
            }
            var ajaxPromise = $.ajax({
                type: type,
                beforeSend: function (request) {
                    request.setRequestHeader("Authorization", "Bearer " + tradableEmbed.accessToken);
                    request.setRequestHeader("x-tr-embed-sdk", jsVersion);
                },
                crossDomain: true,
                url: (!!accountId && accountId.length > 0) ? (endpoint+"/v1/"+reqType+"/"+accountId+"/"+method)
                                                           : (endpoint+"/v1/"+reqType+"/"+method),
                contentType: "application/json; charset=utf-8",
                data: (!!postData) ? JSON.stringify(postData) : undefined,
                dataType: 'json'
            });

            ajaxPromise.then(function(){},
                function(jqXHR, message, error){
                    if(!!jqXHR.responseJSON && (jqXHR.responseJSON.httpStatus === 403 || jqXHR.responseJSON.httpStatus === 502)) {
                        notifyTokenExpired();
                        notifyErrorCallbacks(jqXHR.responseJSON);
                    }
                });

            if(!!resolve || !!reject){
                return ajaxPromise.then(function(data){
                    if(typeof resolve === "function")
                        return resolve(data);
                }, function(jqXHR, message, error){
                    if(typeof reject === "function")
                        return reject(jqXHR, message, error);
                });
            } else {
                if(typeof Promise !== "undefined" && Promise.toString().indexOf("[native code]") !== -1){
                    return Promise.resolve(ajaxPromise);
                } else {
                    return ajaxPromise;
                }
            }
        },
        makeAccountRequest : function (type, accountId, method, postData, resolve, reject){
            return tradableEmbed.makeOsRequest("accounts", type, accountId, method, postData, resolve, reject);
        },
        /**
         * Sets the account unique id that will be used for account related API calls
         * @param      {String}   uniqueId Account uniqueId
         * @param      {Function} resolve Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject Error callback for the API call
         */
        setSelectedAccount : function (accountId, resolve, reject){
            if(!!tradableEmbed.accountMap[accountId]) {
                tradableEmbed.selectedAccount = tradableEmbed.accountMap[accountId];
                tradableEmbed.selectedAccountId = accountId;
                console.log('accountId is set to: ' + accountId);
                return initializeValuesForCurrentAccount(function() {
                    if(isLocalStorageSupported()) {
                        localStorage.setItem("selectedAccount:"+appId, accountId);
                    }
                    if(!!resolve) {
                        resolve();
                    }
                },
                function(err) {
                    if(err.status === 502 || err.status === 403) {
                        tradableEmbed.excludeCurrentAccount();
                        if(tradableEmbed.accounts.length > 0) {
                            validateToken();
                        }
                    }
                    if(!!reject) {
                        reject(err);
                    }
                });
            } else {
                console.error("Can't set account id to: " + accountId);
            }
        },
        excludeCurrentAccount : function() {
            var accountId = tradableEmbed.selectedAccountId;
            var index = tradableEmbed.accounts.indexOf(tradableEmbed.selectedAccount);
            if (index > -1) {
                tradableEmbed.accounts.splice(index, 1);
            }
            delete tradableEmbed.accountMap[accountId];
            tradableEmbed.accountIdsToExclude.push(accountId);
        },
        /**
         * Returns the correspondent instrument obj to the symbol if it's in the current account
         * @param      {String}   symbol Instrument symbol
         * @return      {Object} Correspondent instrument obj to the symbol or null if not found
         */
        getInstrumentFromSymbol : function(symbol) {
            if(!symbol) {
                return null;
            }
            var instrument = null;
            $(tradableEmbed.availableInstruments).each(function(index, ins){
                if(ins.symbol.toUpperCase() === symbol.toUpperCase()) {
                    instrument = ins;
                    return false;
                }
            });
            return instrument;
        },
        /**
         * Returns the correspondent instrument obj to the brokerageAccountSymbol if it's in the current account
         * @param      {String}   symbol Instrument symbol
         * @return      {Object} Correspondent instrument obj to the symbol or null if not found
         */
        getInstrumentFromBrokerageAccountSymbol : function(brokerageAccountSymbol) {
            var instrument = null;
            $(tradableEmbed.availableInstruments).each(function(index, ins){
                if(ins.brokerageAccountSymbol.toUpperCase() === brokerageAccountSymbol.toUpperCase()) {
                    instrument = ins;
                    return false;
                }
            });
            return instrument;
        },
        /**
         * Returns the account object for the given account uniqueId
         * @param      {String}   uniqueId Account uniqueId
         * @return      {Object} Account object for the given account uniqueId or undefined if not found
         */
        getAccountById: function(accountId) {
            return tradableEmbed.accountMap[accountId];
        },
        //v1/user
        /**
         * Provides information about the end-user
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getUser : function (resolve, reject) {
            return tradableEmbed.makeOsRequest("user", "GET", "", "", null, resolve, reject);
        },
        //v1/apps
        /**
         * Provides app information
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getAppInfo : function (resolve, reject) {
            return tradableEmbed.makeOsRequest("apps", "GET", "", tradableEmbed.app_id, null, resolve, reject);
        },
        //v1/brokers
        /**
         * Provides account id and tokens granting access to the requested account
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getBrokers : function (resolve, reject) {
            return tradableEmbed.makeOsRequest("brokers", "GET", "", "", null, resolve, reject);
        },
        //v1/accounts
        /**
         * Initializes the tradableEmbed.accountsMap and the tradableEmbed.accounts list
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @jsFiddle http://codepen.io/tradableEmbed/embed/ZbZWbe/?height=268&theme-id=21042&default-tab=js
         */
        getAccounts : function (resolve, reject){
            var accountsPromise = tradableEmbed.makeAccountRequest("GET", "", "", null).then(function(data){
                tradableEmbed.accounts.splice(0, tradableEmbed.accounts.length);
                tradableEmbed.accountMap = {};
                $(data.accounts).each(function(index, account){
                   if (!!account.uniqueId && account.uniqueId !== "NA" &&
                        tradableEmbed.accountIdsToExclude.indexOf(account.uniqueId) <= -1){
                       tradableEmbed.accounts.push(account);
                       tradableEmbed.accountMap[account.uniqueId] = account;
                   }
                });
            });

            if(!!resolve || !!reject){
                return accountsPromise.then(function(data){
                    if(typeof resolve === "function")
                        return resolve(data);
                }, function(jqXHR, message, error){
                    if(typeof reject === "function")
                        return reject(jqXHR, message, error);
                });
            } else {
                return accountsPromise;
            }
        },
        //v1/accounts/{accountId}/candles
        /**
         * Provides candles for the selectedAccount, given symbol, aggregation and range (from-to)
         * @param      {String} symbol The symbol to get candles for
         * @param      {long} from The start of the candle range. In milliseconds since epoch
         * @param      {long} to The end of the candle range. In milliseconds since epoch
         * @param      {int} aggregation The aggregation interval in minutes. Allowed values: 1,5,15,30,60,1440,21600,40320
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getCandles : function (symbol, from, to, aggregation, resolve, reject) {
            return tradableEmbed.getCandlesForAccount(tradableEmbed.selectedAccountId, symbol, from, to, aggregation, resolve, reject);
        },
        /**
         * Provides candles for a specific account, the given symbol, aggregation and range (from-to)
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} symbol The symbol to get candles for
         * @param      {long} from The start of the candle range. In milliseconds since epoch
         * @param      {long} to The end of the candle range. In milliseconds since epoch
         * @param      {int} aggregation The aggregation interval in minutes. Allowed values: 1,5,15,30,60,1440,21600,40320
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getCandlesForAccount : function (accountId, symbol, from, to, aggregation, resolve, reject) {
            var candleRequest = {"symbol": symbol, "from": from, "to": to, "aggregation": aggregation};
            return tradableEmbed.makeAccountRequest("POST", accountId, "candles/", candleRequest, resolve, reject);
        },
        //v1/accounts/{accountId}
        /**
         * Provides the account snapshot for the selectedAccount - a full snapshot of all orders, positions, account metrics and prices for the symbols given as input
         * @param      {Array} symbols Array of symbols for the wanted prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getSnapshot : function (symbols, resolve, reject){
            return tradableEmbed.getSnapshotForAccount(tradableEmbed.selectedAccountId, symbols, resolve, reject);
        },
        /**
         * Provides the account snapshot for a specific account - a full snapshot of all orders, positions, account metrics and prices for the symbols given as input
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Array} symbols Array of symbols for the wanted prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getSnapshotForAccount : function (accountId, symbols, resolve, reject){
            var symbolsObj = {"symbols": symbols};
            return tradableEmbed.makeAccountRequest("POST", accountId, "", symbolsObj, resolve, reject);
        },
        //v1/accounts/{accountId}/instruments
         /**
         * Returns a list of instruments available for the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getInstruments : function (resolve, reject){
            return tradableEmbed.getInstrumentsForAccount(tradableEmbed.selectedAccountId, resolve, reject);
        },
         /**
         * Returns a list of instruments available for a specific accountId
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getInstrumentsForAccount : function (accountId, resolve, reject){
            return tradableEmbed.makeAccountRequest("GET", accountId, "instruments/", null, resolve, reject);
        },
        //v1/accounts/{accountId}/metrics
         /**
         * The users balance and other account metrics for the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getMetrics : function (resolve, reject){
            return tradableEmbed.getMetricsForAccount(tradableEmbed.selectedAccountId, resolve, reject);
        },
         /**
         * The users balance and other account metrics for a specific accountId
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getMetricsForAccount : function (accountId, resolve, reject){
            return tradableEmbed.makeAccountRequest("GET", accountId, "metrics/", null, resolve, reject);
        },
        //v1/accounts/{accountId}/orders
         /**
         * Returns a list of all the orders divided in pending, recentlyCancelled and recentlyExecuted for the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getOrders : function (resolve, reject){
            return tradableEmbed.getOrdersForAccount(tradableEmbed.selectedAccountId, resolve, reject);
        },
         /**
         * Returns a list of all the orders divided in pending, recentlyCancelled and recentlyExecuted for a specific accountId
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getOrdersForAccount : function (accountId, resolve, reject){
            return tradableEmbed.makeAccountRequest("GET", accountId, "orders/", null, resolve, reject);
        },
         /**
         * Place a MARKET order on the selectedAccount
         * @param      {double} amount The order amount
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} symbol The instrument symbol for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        placeMarketOrder : function (amount, side, symbol, resolve, reject){
            return tradableEmbed.placeOrder(amount, 0, side, symbol, "MARKET", resolve, reject);
        },
         /**
         * Place a MARKET order on a specific account
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {double} amount The order amount
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} symbol The instrument symbol for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        placeMarketOrderForAccount : function (accountId, amount, side, symbol, resolve, reject){
            return tradableEmbed.placeOrderForAccount(accountId, amount, 0, side, symbol, "MARKET", resolve, reject);
        },
         /**
         * Place a LIMIT order on the selectedAccount
         * @param      {double} amount The order amount
         * @param      {double} price The trigger price for the order
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} symbol The instrument symbol for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        placeLimitOrder : function (amount, price, side, symbol, resolve, reject){
            return tradableEmbed.placeOrder(amount, price, side, symbol, "LIMIT", resolve, reject);
        },
         /**
         * Place a LIMIT order on a specific account
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {double} amount The order amount
         * @param      {double} price The trigger price for the order.
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} symbol The instrument symbol for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        placeLimitOrderForAccount : function (accountId, amount, price, side, symbol, resolve, reject){
            return tradableEmbed.placeOrderForAccount(accountId, amount, price, side, symbol, "LIMIT", resolve, reject);
        },
         /**
         * Place a STOP order on the selectedAccount
         * @param      {double} amount The order amount
         * @param      {double} price The trigger price for the order
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} symbol The instrument symbol for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        placeStopOrder : function (amount, price, side, symbol, resolve, reject){
            return tradableEmbed.placeOrder(amount, price, side, symbol, "STOP", resolve, reject);
        },
         /**
         * Place a STOP order on a specific account
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {double} amount The order amount
         * @param      {double} price The trigger price for the order.
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} symbol The instrument symbol for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        placeStopOrderForAccount : function (accountId, amount, price, side, symbol, resolve, reject){
            return tradableEmbed.placeOrderForAccount(accountId, amount, price, side, symbol, "STOP", resolve, reject);
        },
        placeOrder : function (amount, price, side, symbol, type, resolve, reject){
            return tradableEmbed.placeOrderForAccount(tradableEmbed.selectedAccountId, amount, price, side, symbol, type, resolve, reject);
        },
        placeOrderForAccount : function (accountId, amount, price, side, symbol, type, resolve, reject){
            var order = {"amount": amount, "price": price, "side": side, "symbol": symbol, "type": type};
            return tradableEmbed.makeAccountRequest("POST", accountId, "orders/", order, resolve, reject);
        },
        //v1/accounts/{accountId}/orders/pending
         /**
         * Returns a list of all the pending orders the selectedAccount - This will typically be limit orders but in a market without liquidity it can also contain market orders
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getPendingOrders : function (resolve, reject){
            return tradableEmbed.getPendingOrdersForAccount(tradableEmbed.selectedAccountId, resolve, reject);
        },
         /**
         * Returns a list of all the pending orders for a specific account - This will typically be limit orders but in a market without liquidity it can also contain market orders
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getPendingOrdersForAccount : function (accountId, resolve, reject){
            return tradableEmbed.makeAccountRequest("GET", accountId, "orders/pending", null, resolve, reject);
        },
        //v1/accounts/{accountId}/orders/{orderId}
         /**
         * Returns an order for the provided id and the selectedAccount, without the up-to-date price
         * @param      {String} orderId Id of order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getOrderById : function (orderId, resolve, reject){
            return tradableEmbed.getOrderByIdForAccount(tradableEmbed.selectedAccountId, orderId, resolve, reject);
        },
         /**
         * Returns an order for the provided id and a specific account, without the up-to-date price
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} orderId Id of order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getOrderByIdForAccount : function (accountId, orderId, resolve, reject){
            return tradableEmbed.makeAccountRequest("GET", accountId, "orders/"+orderId, null, resolve, reject);
        },
        /**
         * Modifies the price for the order identified with the given id on the selectedAccount
         * @param      {String} orderId Id of order to modify
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        modifyOrderPrice : function (orderId, newPrice, resolve, reject){
            return tradableEmbed.modifyOrderPriceForAccount(tradableEmbed.selectedAccountId, orderId, newPrice, resolve, reject);
        },
        /**
         * Modifies the price for the order identified with the given id on a specific account
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} orderId Id of order to modify
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        modifyOrderPriceForAccount : function (accountId, orderId, newPrice, resolve, reject){
            var orderModification = {"price": newPrice};
            return tradableEmbed.makeAccountRequest("PUT", accountId, "orders/"+orderId, orderModification, resolve, reject);
        },
        /**
         * Cancels the order with the given id on the selectedAccount
         * @param      {String} orderId Id of order to cancel
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelOrder : function (orderId, resolve, reject){
            return tradableEmbed.cancelOrderForAccount(tradableEmbed.selectedAccountId, orderId, resolve, reject);
        },
        /**
         * Cancels the order with the given id on a specific account
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} orderId Id of order to cancel
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelOrderForAccount : function (accountId, orderId, resolve, reject){
            return tradableEmbed.makeAccountRequest("DELETE", accountId, "orders/"+orderId, null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions
        /**
         * Returns a list of all the positions on the selectedAccount. Will return open and recently closed positions
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getPositions : function (resolve, reject){
            return tradableEmbed.getPositionsForAccount(tradableEmbed.selectedAccountId, resolve, reject);
        },
        /**
         * Returns a list of all the positions on a specific account. Will return open and recently closed positions
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getPositionsForAccount : function (accountId, resolve, reject){
            return tradableEmbed.makeAccountRequest("GET", accountId, "positions/", null, resolve, reject);
        },
        /**
         * Closes all positions on the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        closeAllPositions : function (resolve, reject){
            return tradableEmbed.closeAllPositionsForAccount(tradableEmbed.selectedAccountId, resolve, reject);
        },
        /**
         * Closes all positions on a specific account
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        closeAllPositionsForAccount : function (accountId, resolve, reject){
            return tradableEmbed.makeAccountRequest("DELETE", accountId, "positions/", null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions/open
        /**
         * Returns a list of all the open positions on the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getOpenPositions : function (resolve, reject){
            return tradableEmbed.getOpenPositionsForAccount(tradableEmbed.selectedAccountId, resolve, reject);
        },
        /**
         * Returns a list of all the open positions on a specific account
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getOpenPositionsForAccount : function (accountId, resolve, reject){
            return tradableEmbed.makeAccountRequest("GET", accountId, "positions/open", null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions/{positionId}
        /**
         * Returns a position for the provided id, without the up-to-date price and metrics on the selectedAccount
         * @param      {String} positionId Id of position to retrieve
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getPositionById : function (positionId, resolve, reject){
            return tradableEmbed.getPositionByIdForAccount(tradableEmbed.selectedAccountId, positionId, resolve, reject);
        },
        /**
         * Returns a position for the provided id, without the up-to-date price and metrics on a specific account
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to retrieve
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getPositionByIdForAccount : function (accountId, positionId, resolve, reject){
            return tradableEmbed.makeAccountRequest("GET", accountId, "positions/"+positionId, null, resolve, reject);
        },
        /**
         * Reduces the position (on the selectedAccount) size, by setting a new quantity
         * @param      {String} positionId Id of position to reduce
         * @param      {String} newAmount the new amount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        reducePositionToAmount : function (positionId, newAmount, resolve, reject){
            return tradableEmbed.reducePositionToAmountForAccount(tradableEmbed.selectedAccountId, positionId, newAmount, resolve, reject);
        },
        /**
         * Reduces the position (on a specific account) size, by setting a new quantity
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to reduce
         * @param      {String} newAmount the new amount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        reducePositionToAmountForAccount : function (accountId, positionId, newAmount, resolve, reject){
            var amount = {"amount": newAmount};
            return tradableEmbed.makeAccountRequest("PUT", accountId, "positions/"+positionId, amount, resolve, reject);
        },
        /**
         * Closes the position (on the selectedAccount) with the given id
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        closePosition : function (positionId, resolve, reject){
            return tradableEmbed.closePositionForAccount(tradableEmbed.selectedAccountId, positionId, resolve, reject);
        },
        /**
         * Closes the position (on a specific account) with the given id
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        closePositionForAccount : function (accountId, positionId, resolve, reject){
            return tradableEmbed.makeAccountRequest("DELETE", accountId, "positions/"+positionId, null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions/{positionId}/protections
        /**
         * Adds or modifies stoploss AND takeprofit on a position (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {double} stoploss Stop Loss price
         * @param      {double} takeprofit Take Profit price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyProtections : function (positionId, takeProfit, stopLoss, resolve, reject) {
            return tradableEmbed.addOrModifyProtectionsForAccount(tradableEmbed.selectedAccountId, positionId, takeProfit, stopLoss, resolve, reject);
        },
        /**
         * Adds or modifies stoploss AND takeprofit on a position (on a specific account)
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {double} stoploss Stop Loss price
         * @param      {double} takeprofit Take Profit price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyProtectionsForAccount : function (accountId, positionId, takeProfit, stopLoss, resolve, reject) {
            var protection = {"takeprofit": takeProfit, "stoploss": stopLoss};
            return tradableEmbed.makeAccountRequest("PUT", accountId, "positions/"+positionId+"/protections/", protection, resolve, reject);
        },
        /**
         * Cancel stoploss and takeprofit protections on a position (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelProtections : function (positionId, resolve, reject) {
            return tradableEmbed.cancelProtectionsForAccount(tradableEmbed.selectedAccountId, positionId, resolve, reject);
        },
        /**
         * Cancel stoploss and takeprofit protections on a position (on a specific account)
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelProtectionsForAccount : function (accountId, positionId, resolve, reject) {
            return tradableEmbed.makeAccountRequest("DELETE", accountId, "positions/"+positionId+"/protections/", null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions/{positionId}/protections/{sltp}
        /**
         * Adds or modifies the take profit order on a position. (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyTakeProfit : function (positionId, newPrice, resolve, reject) {
            return tradableEmbed.makeProtectionRequest("PUT", positionId, newPrice, "TAKEPROFIT", resolve, reject);
        },
        /**
         * Adds or modifies the take profit order on a position. (on a specific account)
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyTakeProfitForAccount : function (accountId, positionId, newPrice, resolve, reject) {
            return tradableEmbed.makeProtectionRequestForAccount("PUT", accountId, positionId, newPrice, "TAKEPROFIT", resolve, reject);
        },
        /**
         * Adds or modifies the stop loss order on a position. (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyStopLoss : function (positionId, newPrice, resolve, reject) {
            return tradableEmbed.makeProtectionRequest("PUT", positionId, newPrice, "STOPLOSS", resolve, reject);
        },
        /**
         * Adds or modifies the stop loss order on a position. (on a specific account)
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyStopLossForAccount : function (accountId, positionId, newPrice, resolve, reject) {
            return tradableEmbed.makeProtectionRequestForAccount("PUT", accountId, positionId, newPrice, "STOPLOSS", resolve, reject);
        },
        /**
         * Cancel the take profit order on a position. (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelTakeProfit : function (positionId, resolve, reject) {
            return tradableEmbed.makeProtectionRequest("DELETE", positionId, 0, "TAKEPROFIT", resolve, reject);
        },
        /**
         * Cancel the take profit order on a position. (on a specific account)
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelTakeProfitForAccount : function (accountId, positionId, resolve, reject) {
            return tradableEmbed.makeProtectionRequestForAccount("DELETE", accountId, positionId, 0, "TAKEPROFIT", resolve, reject);
        },
        /**
         * Cancel the stop loss order on a position. (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelStopLoss : function (positionId, resolve, reject) {
            return tradableEmbed.makeProtectionRequest("DELETE", positionId, 0, "STOPLOSS", resolve, reject);
        },
        /**
         * Cancel the stop loss order on a position. (on a specific account)
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelStopLossForAccount : function (accountId, positionId, resolve, reject) {
            return tradableEmbed.makeProtectionRequestForAccount("DELETE", accountId, positionId, 0, "STOPLOSS", resolve, reject);
        },
        makeProtectionRequest : function (method, positionId, newPrice, type, resolve, reject) {
            return tradableEmbed.makeProtectionRequestForAccount(method, tradableEmbed.selectedAccountId, positionId, newPrice, type, resolve, reject);
        },
        makeProtectionRequestForAccount : function (method, accountId, positionId, newPrice, type, resolve, reject) {
            var orderModification = {"price": newPrice};
            if(method === "DELETE") {
                orderModification = null;
            }
            return tradableEmbed.makeAccountRequest(method, accountId, "positions/"+positionId+"/protections/"+type, orderModification, resolve, reject);
        },
        //v1/accounts/{accountId}/prices
        /**
         * A list of prices for certain symbols (on the selectedAccount)
         * @param      {Array} symbols Array of symbols for the wanted prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getPrices : function (symbols, resolve, reject) {
            return tradableEmbed.getPricesForAccount(tradableEmbed.selectedAccountId, symbols, resolve, reject);
        },
        /**
         * A list of prices for certain symbols (on a specific account)
         * @param      {String} uniqueId The unique id for the account the request goes to
         * @param      {Array} symbols Array of symbols for the wanted prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getPricesForAccount : function (accountId, symbols, resolve, reject) {
            var symbolsObj = {"symbols": symbols};
            return tradableEmbed.makeAccountRequest("POST", accountId, "prices/", symbolsObj, resolve, reject);
        },
        makeCandleRequest : function (method, symbolsArray, resolve, reject, postObject) {
            var symbolsObj = {symbols: symbolsArray};
            if(!!postObject) {
                symbolsObj = postObject;
            }
            var ajaxPromise = $.ajax({
                type: "POST",
                crossDomain: true,
                url: "https://candles-api.tradable.com/" + method,
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify(symbolsObj),
                dataType: 'json'
            });

            if(!!resolve || !!reject){
                return ajaxPromise.then(function(data){
                    if(typeof resolve === "function") {
                        if(!!data.dailyClose) {
                            return resolve(data.dailyClose);
                        } else {
                            return resolve(data);
                        }
                    }
                }, function(jqXHR, message, error){
                    if(typeof reject === "function")
                        return reject(jqXHR, message, error);
                });
            } else {
                var d = new $.Deferred();
                ajaxPromise.then(function(data) {
                    if(!!data.dailyClose) {
                        return d.resolve(data.dailyClose);
                    } else {
                        return d.resolve(data);
                    }
                }, function(jqXHR, message, error) {
                    return d.reject(jqXHR, message, error);
                });
                if(typeof Promise !== "undefined" && Promise.toString().indexOf("[native code]") !== -1){
                    return Promise.resolve(d.promise());
                } else {
                    return d.promise();
                }
            }
        },
        /**
         * A list of close prices for the previous day for certain symbols (on a specific account)
         * @param      {Array} symbols Array of symbols for the wanted daily close prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getLastDailyClose : function (symbolsArray, resolve, reject) {
            return tradableEmbed.makeCandleRequest("dailyClose", symbolsArray, resolve, reject);
        },
        enableTrading : function(access_token, end_point, expires_in, set_latest_account){
            console.log("Activating TradableEmbed...");

            if(!!access_token && !!end_point) {
                tradableEmbed.accessToken = access_token;
                tradableEmbed.authEndpoint = end_point;
                tradableEmbed.tradingEnabled = true;

                if(isLocalStorageSupported()) {
                    localStorage.setItem("accessToken:"+appId, tradableEmbed.accessToken);
                    localStorage.setItem("authEndpoint:"+appId, tradableEmbed.authEndpoint);
                    localStorage.setItem("tradingEnabled:"+appId, tradableEmbed.tradingEnabled);

                    if(!!expires_in) {
                        tradableEmbed.expirationTimeUTC = new Date().getTime() + (parseInt(expires_in) * 1000); //expires conversion
                        localStorage.setItem("expirationTimeUTC:"+appId, tradableEmbed.expirationTimeUTC);
                    }
                }
            }

            var accountQty = tradableEmbed.accounts.length;
            tradableEmbed.getAccounts().then(function(accounts) {
                setSelectedAccountAndNotify(set_latest_account, accountQty);
            });
        }
    };

    initializeLibrary();

    function initializeLibrary(){
        var success = false;
        var opener = window.opener;
        if(!!opener && window.name === "osAddBroker") {
            try {
                opener.tradableEmbed.enableTrading(undefined, undefined, undefined, true);
            } catch(err) {}
            window.close(); // execution stops
        } else if(!!opener && window.name === "osLaunch"){
            var hashFragment = window.location.hash;
            if(hashFragment) {
                try {
                    opener.postMessage('replace your location', '*');
                    success = processHashFragment(hashFragment, opener.tradableEmbed);
                } catch(err) {
                    success = false;
                }
                if(!success) {
                    success = processHashFragment(hashFragment, tradableEmbed);
                }
            }
        } else if(window.location.hash &&
                    window.location.hash.indexOf("access_token") !== -1 &&
                    window.location.hash.indexOf("endpointURL") !== -1 &&
                    window.location.hash.indexOf("expires_in") !== -1) {
            success = processHashFragment(window.location.hash, tradableEmbed);
        } else if(tradableEmbed.tradingEnabled) {
            validateToken();
            success = true;
        }

        if(!success) {
           console.log('Initiating without authentication...');
           $(document).ready(function() {
               notifyReadyCallbacks();
           });
        }

        function processHashFragment(hashFragment, tradableEmbed){
            var accessToken;
            var endPoint;
            var expiresIn;

            tradableEmbed.tradingEnabled = false;
            if(isLocalStorageSupported()) {
                localStorage.setItem("tradingEnabled:"+appId, false);
            }

            var keyValues = hashFragment.replace('#', '').split('&');
            $(keyValues).each(function(index, keyValuePair){
                var kvPair = keyValuePair.split('=');
                var key = kvPair[0];
                var value = kvPair[1];
                if(key === 'access_token') {
                    accessToken = value;
                } else if(key === 'endpointURL') {
                    endPoint = value;
                } else if(key === 'expires_in') {
                    expiresIn = value;
                }
            });
            if(!!accessToken && !!endPoint) {
                tradableEmbed.enableTrading(accessToken, endPoint, expiresIn);
                if(window.name === "osLaunch") {
                    window.close();
                }
                return true;
            } else {
                return false;
            }
        }
    }

    function isLocalStorageSupported() {
        var testKey = 'test';
        try {
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    function popupwindow(url, windowName, w, h){
        var wLeft = window.screenLeft ? window.screenLeft : window.screenX;
        var wTop = window.screenTop ? window.screenTop : window.screenY;
        var left = wLeft + (window.innerWidth / 2) - (w / 2);
        var top = wTop + (window.innerHeight / 2) - (h / 2);
        return window.open(url, windowName, 'toolbar=no, titlebar=no, directories=no, status=no, menubar=no, ' +
            'scrollbars=no, resizable=no, copyhistory=no, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);
    }

    function notifyReadyCallbacks() {
        $(tradableEmbed.readyCallbacks).each(function(index, callback){
            callback();
        });
        tradableEmbed.notifiedCallbacks = true;
    }

    function notifyTokenExpired() {
        tradableEmbed.tradingEnabled = false;
        if(isLocalStorageSupported()) {
            localStorage.setItem("tradingEnabled:"+appId, false);
        }
        $(tokenExpirationCallbacks).each(function(index, callback){
            callback();
        });
        notifyReadyCallbacks();
    }

    function notifyErrorCallbacks(error) {
        $(errorCallbacks).each(function(index, callback){
            callback(error);
        });
    }

    function notifyAccountSwitchCallbacks() {
        $(accountSwitchCallbacks).each(function(index, callback){
            callback();
        });
    }

    function initializeValuesForCurrentAccount(resolve, reject) {
        console.log('Initializing values for current account');
        var reset = false;
        if(tradableEmbed.tradingEnabled) {
            tradableEmbed.tradingEnabled = false;
            reset = true;
        }
        return tradableEmbed.getInstruments().then(function(acctInstruments){
            tradableEmbed.availableCategories.splice(0, tradableEmbed.availableCategories.length);
            tradableEmbed.availableInstruments.splice(0, tradableEmbed.availableInstruments.length);
            tradableEmbed.availableSymbols.splice(0, tradableEmbed.availableSymbols.length);
            tradableEmbed.availableCurrencies.splice(0, tradableEmbed.availableCurrencies.length);

            var nonValidCurrencies = ["100", "200", "225", "spx", "h33", "nas", "u30", "e50", "f40", "d30", "e35", "i40", "z30", "s30", "uso", "uko"];
            $(acctInstruments).each(function(index, instrument){
                 tradableEmbed.availableInstruments.push(instrument);
                 tradableEmbed.availableSymbols.push(instrument.symbol);

                 if(instrument.type === "FOREX" && instrument.symbol.length === 6) {
                     var ccy1 = instrument.symbol.toLowerCase().substring(0, 3);
                     var ccy2 = instrument.symbol.toLowerCase().substring(3, 6);
                     if ($.inArray(ccy1, tradableEmbed.availableCurrencies) === -1 &&
                            $.inArray(ccy1, nonValidCurrencies) === -1){ // doesn't exist
                         tradableEmbed.availableCurrencies.push(ccy1);
                     }
                     if ($.inArray(ccy2, tradableEmbed.availableCurrencies) === -1 &&
                            $.inArray(ccy1, nonValidCurrencies) === -1){
                         tradableEmbed.availableCurrencies.push(ccy2);
                     }
                 }

                 if ($.inArray(instrument.type, tradableEmbed.availableCategories) === -1){
                     tradableEmbed.availableCategories.push(instrument.type);
                 }
            });
            if(reset) {
                tradableEmbed.tradingEnabled = true;
            }
            notifyAccountSwitchCallbacks();
            if(!!resolve && typeof resolve === "function") {
                return resolve(tradableEmbed.accounts);
            } else {
                return this;
            }
            //return
        }, function(error) {
            if(!!reject && typeof reject === "function") {
                return reject(error);
            } else {
                return this;
            }
        });
    }

    function validateToken() {
        console.log("Validating token...");
        // Check token validity
        tradableEmbed.getAccounts().then(
            function(accounts) {
                tradableEmbed.enableTrading(tradableEmbed.accessToken, tradableEmbed.authEndpoint);
            },
            function() {
                tradableEmbed.tradingEnabled = false;
                if(isLocalStorageSupported()) {
                    localStorage.setItem("tradingEnabled:"+appId, tradableEmbed.tradingEnabled);
                }
                notifyReadyCallbacks();
            }
        );
    }

    function setSelectedAccountAndNotify(set_latest_account, account_qty) {
        console.log('Accounts initialized');
        var accountId;
        var savedAccId = localStorage.getItem("selectedAccount:"+appId);
        var accIdxToSelect = tradableEmbed.accounts.length - 1;
        if(!!set_latest_account && tradableEmbed.accounts.length > account_qty) {
            accountId = tradableEmbed.accounts[accIdxToSelect].uniqueId;
        } else if(!!savedAccId && !!tradableEmbed.accountMap[savedAccId]) {
            accountId = savedAccId;
        } else {
            accountId = tradableEmbed.accounts[accIdxToSelect].uniqueId;
        }
        tradableEmbed.setSelectedAccount(accountId, function() {
            notifyReadyCallbacks();
        });
    }

    function processAccountUpdate() {
        if(tradableEmbed.tradingEnabled && !processingUpdate) {
            processingUpdate = true;
            var symbolArray = [];
            $(tradableEmbed.symbolKeysForAccountUpdates).each(function(idx, elem) {
                var symbol = elem.substring(0, elem.indexOf(":"));
                if($.inArray(symbol, symbolArray) === -1) {
                    symbolArray.push(symbol);
                }
            });
            tradableEmbed.getSnapshot(symbolArray).then(function(account) {
                tradableEmbed.lastSnapshot = account;
                $.each(accountUpdatedCallbacks, function(idx, call) {
                    call(account);
                });
                processingUpdate = false;
            }, function() {
                processingUpdate = false;
            });
        }
    }

    function getAuthUrl(brokerId) {
        var url;
        if(!!brokerId) {
            url = tradableEmbed.auth_loc + "&broker_id=" + brokerId;
        } else {
            url = tradableEmbed.auth_loc;
        }
        return url;
    }

    function hashCode(str){
        var i;
        var char;
        var hash = 0;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    function ie() {
        return ((navigator.userAgent.indexOf("MSIE") != -1) || (/rv:11.0/i.test(navigator.userAgent)));
    }


    /* CommonJS */
    if (typeof require === "function" && typeof module === "object" && module && module.exports) {
        module.exports = tradableEmbed;
    }
    /* Global */
    else {
        global.tradableEmbed = tradableEmbed;
        global.trEmbJQ = trEmbJQ;
    }

})(this, trEmbJQ);
