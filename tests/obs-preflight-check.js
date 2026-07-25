'use strict';

// Dependency-free release check for the local-file OBS workflow.
var fs = require('node:fs');
var path = require('node:path');
var childProcess = require('node:child_process');

var root = path.resolve(__dirname, '..');
var appPath = path.join(root, 'app.js');
var displayPath = path.join(root, 'display.js');
var app = fs.readFileSync(appPath, 'utf8');
var display = fs.readFileSync(displayPath, 'utf8');

childProcess.execFileSync(process.execPath, ['--check', appPath], { stdio: 'inherit' });
childProcess.execFileSync(process.execPath, ['--check', displayPath], { stdio: 'inherit' });

var checks = [
  ['controller marks the selected announcement live', /function showAnnouncement\(id\)[\s\S]*?tally\.classList\.add\('live'\)/],
  ['controller clears the live marker', /function hideAnnouncement\(\)[\s\S]*?tally\.classList\.remove\('live'\)/],
  ['controller sanitizes formatted descriptions', /function sanitizeDescriptionHtml\(html\)/],
  ['display sanitizes formatted descriptions', /function sanitizeDescriptionHtml\(html\)/],
  ['controller limits processed image size', /var maxImageBytes = 1024 \* 1024/],
  ['controller includes description style defaults', /descFont:/],
  ['display includes description style defaults', /descFont:/],
  ['display reads the OBS hand-off payload', /localStorage\.getItem\(STORAGE_CURRENT\)/]
];

checks.forEach(function (check) {
  var source = check[0].indexOf('display') === 0 ? display : app;
  if (!check[1].test(source)) throw new Error('Preflight check failed: ' + check[0]);
});

console.log('OBS preflight check passed.');
