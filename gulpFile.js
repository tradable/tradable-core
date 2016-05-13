var versionNumber = '1.16';

var gulp = require('gulp'),
    rename = require('gulp-rename'),
    uglify = require('gulp-uglify'),
    gutil = require("gulp-util"),
    license = require('gulp-header-license'),
    replace = require('gulp-replace'),
    removeCode = require('gulp-remove-code'),
    clean = require('gulp-clean'),
    documentation = require('gulp-documentation'),
    fs = require("fs"),
    request = require("request"),
    open = require('gulp-open');
    //qunit = require('node-qunit-phantomjs');
    //qunit = require('gulp-qunit');

/***** Test *****/

/*gulp.task('test', function() {
    return qunit('./test/test-runner.html');
});

gulp.task('test', function() {
    return gulp.src('./test/test-runner.html')
        .pipe(qunit({'phantomjs-options': ["--ssl-protocol=any", "--web-security=false"], 'timeout': 20}));//'binPath': require('phantomjs2').path, 'timeout': 15, , '--ssl-protocol=any', '--ignore-ssl-errors=yes'
});*/

gulp.task('test', function(){
  gulp.src('./test/test-runner.html')
  .pipe(open({ uri: './test/test-runner.html'}));
});

/***** Build  *****/

gulp.task('cleanDist', ['test'], function () {
    return gulp.src('dist', {read: false}).pipe(clean());
});

gulp.task('copy-files', ['cleanDist'], function() {
  return gulp.src(['src/tradable.js'])
    .pipe(gulp.dest('dist'));
});

gulp.task('license', ['copy-files'], function () {
    var year = (new Date()).getFullYear();
    return gulp.src('dist/tradable.js')
            .pipe(license("/******  Copyright " + year + " Tradable ApS; @license MIT; v" + versionNumber + "  ******/"))
            .pipe(gulp.dest('./dist/'));
});

// Removes from the production file the test hook that allows unit testing the anonymous funtions
gulp.task('remove-test-hook', ['license'], function () {
    return gulp.src('./dist/tradable.js')
      .pipe(removeCode({ production: true }))
      .pipe(gulp.dest('./dist'))
});

gulp.task('minify-js', ['remove-test-hook'], function() {
  return gulp.src('dist/tradable.js')
    .pipe(uglify({preserveComments: 'some'})) // keeps comments with @license
	  .pipe(rename(function (path) {
            if(path.extname === '.js') {
                path.basename += '.min';
            }
        }))
    .pipe(gulp.dest('dist'));
});

gulp.task('compress-copy', ['test', 'cleanDist', 'license', 'remove-test-hook', 'minify-js', 'copy-files']);

/***** Docs generation  *****/

gulp.task('documentation', ['compress-copy'], function () {
  return gulp.src('src/tradable.js')
    .pipe(documentation({ format: 'html' }))
    .pipe(gulp.dest('docs'));
});

var apiJsonArray;
gulp.task('loadJSONTemplates', ['documentation'], function() {
    var url = 'https://docs.tradable.com/json';
    return request({
        url: url,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            apiJsonArray = body.objects[""];
            console.log("Objects template loaded..");
        } else {
            throw new gutil.PluginError({
              plugin: 'Error trying to load object template from endpoint',
              message: "Can't reach " +  url
            });
        }
    });
});

function getJSONTemplateForObject(objName, list) {
    for(i = 0 ; i < apiJsonArray.length ; i++) {
        if(apiJsonArray[i].name === objName) {
            var jsonObj = apiJsonArray[i].jsondocTemplate;
            if(typeof list !== "undefined" && list) {
              return [jsonObj];
            }
            return jsonObj; // Print the json response
        }
    }
    throw new gutil.PluginError({
      plugin: 'Error trying to load object template',
      message: "CAUTION!!!! '" + objName + "' not in JSON template!"
    });
}

gulp.task('buildDocs', ['loadJSONTemplates'], function(){
   var customStyle = fs.readFileSync("docs/template/style.html", "utf8");
   var introContent = fs.readFileSync("docs/template/intro.html", "utf8");
   return gulp.src(['docs/index.html'])
     .pipe(replace("<div class='px2'>", customStyle + "<div class='px2'>")) // Insert custom style inline-css for the documentation
     .pipe(replace("<div class='px2'>", introContent + "<div class='px2'>")) // Insert HTML intro before the rest of the documentation
     .pipe(replace("trEmbDevVersionX", versionNumber))
     .pipe(replace("<h3 class='mb0 no-anchor'></h3>", "<h3 class='mb0 no-anchor'>tradable-core</h3>")) // set title
     .pipe(replace("<div class='mb1'><code></code></div>", "<div class='mb1'><code>" + versionNumber + "</code></div>")) // set version
     .pipe(replace('[exampleiframe-begin]', '<iframe width="100%" height="300" allowfullscreen="allowfullscreen" frameborder="0" src="')) // prepare example iframes
     .pipe(replace('[exampleiframe-end]', '"></iframe>')) // prepare example iframes
     .pipe(replace(new RegExp(/(_object-begin_)(\w+)(_object-end_)/g), replacerSync)) // replace the example objects
     .pipe(replace(new RegExp(/(_object-callback-begin_)(\w+)(_object-callback-end_)/g), replacerAsync)) // replace the example objects
     .pipe(replace(new RegExp(/(_list-callback-begin_)(\w+)(_list-callback-end_)/g), replacerListAsync)) // replace the example objects
     .pipe(replace("            ", '')) // Removes unnecessary spaces introduced by the replacement
     .pipe(gulp.dest('docs'));
});

function replacerSync(match, p1, p2, p3, offset, string) {
  return "<p class='example-intro'>This is an example object returned by this method:</p>" + JSON.stringify(getJSONTemplateForObject(p2), null, 2);
}

function replacerAsync(match, p1, p2, p3, offset, string) {
  return "<p class='example-intro'>This is an example object returned by the callback from this method:</p>" + JSON.stringify(getJSONTemplateForObject(p2), null, 2);
}

function replacerListAsync(match, p1, p2, p3, offset, string) {
  return "<p class='example-intro'>This is an example object returned by the callback from this method:</p>" + JSON.stringify(getJSONTemplateForObject(p2, true), null, 2);
}

gulp.task('replace-version', ['documentation'], function(){//copy-docs
  return gulp.src(['dist/**'])
    .pipe(replace('trEmbDevVersionX', versionNumber))
    .pipe(gulp.dest('dist'));
});

gulp.task('generateDocs', ['documentation', 'loadJSONTemplates', 'buildDocs']);

gulp.task('buildSDK', ['compress-copy', 'replace-version', 'generateDocs']);

