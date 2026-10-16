import test from 'node:test';import assert from 'node:assert/strict';import {projectScores} from './sports.js';
test('equal teams have home advantage',()=>{const g=[{date:Date.now()-86400000,for:100,against:100}];const x=projectScores({sport:'NBA',awayGames:g,homeGames:g,eventDate:Date.now(),fallback:100,homeAdv:2});assert.ok(x.homeExpected>x.awayExpected);});
test('missing data yields finite projections without implied validation',()=>{const x=projectScores({sport:'NHL',awayGames:[],homeGames:[],eventDate:Date.now(),fallback:3,homeAdv:.15});assert.ok(Number.isFinite(x.homeExpected));});
