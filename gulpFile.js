var versionNumber = '1.14.1';

var gulp = require('gulp'),
    rename = require('gulp-rename'),
    uglify = require('gulp-uglify'),
    gutil = require("gulp-util"),
    license = require('gulp-header-license');
    replace = require('gulp-replace'),
    gulpDoxx = require('gulp-doxx'),
    clean = require('gulp-clean');

/***** Build  *****/

gulp.task('cleanDist', function () {
    return gulp.src('dist', {read: false}).pipe(clean());
});

gulp.task('copy-files', ['cleanDist'], function() {
  return gulp.src(['src/tradable-embed.js'])
    .pipe(gulp.dest('dist'));
});

gulp.task('license-embed', ['copy-files'], function () {
    var year = (new Date()).getFullYear();
    return gulp.src('dist/tradable-embed.js')
            .pipe(license("/******  Copyright " + year + " Tradable ApS; @license MIT; v" + versionNumber + "  ******/"))
            .pipe(gulp.dest('./dist/'));
});

gulp.task('minify-js', ['license-embed'], function() {
  return gulp.src('dist/tradable-embed.js')
    .pipe(uglify({preserveComments: 'some'})) // keeps comments with @license
	  .pipe(rename(function (path) {
            if(path.extname === '.js') {
                path.basename += '.min';
            }
        }))
    .pipe(gulp.dest('dist'));
});

gulp.task('compress-copy', ['cleanDist', 'license-embed', 'minify-js', 'copy-files']);

/***** Docs generation  *****/

gulp.task('docs', ['compress-copy'], function() {
	return gulp.src(['src/tradable-embed.js'], {base: '.'})
    .pipe(gulpDoxx({
      title: 'tradable-embed-core ' + versionNumber,
    urlPrefix: ''
    }))
    .pipe(gulp.dest('docs'));
});

gulp.task('replaceDocsCss', ['docs'], function(){
	  return gulp.src(['docs/**'])
		.pipe(replace('</style>', '.language-javascript {display: none;} .bs-docs-sidenav > li > a {font-size: 12px;}</style>'))
		.pipe(replace('</style>', '.bs-docs-sidenav > li > a > span {width: 100%;display: inline-block;text-overflow: ellipsis;overflow: hidden;vertical-align: middle;}</style>'))
		.pipe(replace('</style>', '.alert-success {vertical-align: middle;} .smthingForAccount {display: none !important;} .bs-docs-sidenav > li > a {padding: 0px 15px !important;} .bs-docs-sidenav {margin: 15px 0 0 !important;}</style>'))
		.pipe(replace('</style>', '#overview {background: #2B3641; }</style>'))
		.pipe(replace('</style>', '.bs-docs-sidenav > li > a{border: 0; border-bottom: 1px solid #e5e5e5} li {line-height: 17px;}.bs-docs-sidenav i {width: 3px; height:3px}</style>'))
		.pipe(replace('break-word', 'normal; white-space: nowrap;'))
		.pipe(replace('table-striped', 'table-striped table-condensed'))
        .pipe(replace('src/', ''))
		.pipe(replace(new RegExp(/(#)\w+(ForAccount")/g), '#smthingForAccount" class="smthingForAccount"'))
		.pipe(replace('jsFiddle', 'Example'))
		.pipe(replace('http:', ''))
		.pipe(gulp.dest('docs'));
});

gulp.task('copy-docs', ['replaceDocsCss'], function() {
  return gulp.src(['docs/src/**'])
    .pipe(gulp.dest('docs'));
});

gulp.task('replace-version', ['copy-docs'], function(){
  return gulp.src(['dist/**'])
    .pipe(replace('trEmbDevVersionX', versionNumber))
    .pipe(gulp.dest('dist'));
});

gulp.task('replace-docs-version', ['replace-version'], function(){
  return gulp.src(['docs/**'])
    .pipe(replace('trEmbDevVersionX', versionNumber))
    .pipe(gulp.dest('docs'));
});

gulp.task('clean-docs', ['replace-docs-version'], function () {
    return gulp.src('docs/src', {read: false}).pipe(clean());
});

gulp.task('generateDocs', ['docs', 'replaceDocsCss', 'copy-docs', 'clean-docs']);

gulp.task('buildSDK', ['compress-copy', 'replace-version', 'generateDocs', 'replace-docs-version']);

