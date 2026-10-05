import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_ARTICLES, ROLES, visibleArticles, searchArticles } from '../src/guide/articles.js';

test('all articles have complete sections, unique IDs, and valid related links', () => {
  const ids = new Set(GUIDE_ARTICLES.map((a) => a.id));
  assert.equal(ids.size, GUIDE_ARTICLES.length);
  for (const a of GUIDE_ARTICLES) {
    for (const key of ['category', 'title', 'summary', 'when', 'seen', 'important']) assert.ok(a[key]?.trim(), `${a.id}: ${key}`);
    assert.ok(a.steps.length >= 3);
    assert.ok(a.roles.length && a.roles.every((r) => ROLES.includes(r)));
    assert.ok(a.related.every((id) => ids.has(id)), a.id);
  }
});
test('role restrictions apply to browsing and full-text search', () => {
  for (const role of ROLES) {
    assert.ok(visibleArticles(role).length > 0);
    assert.ok(searchArticles(role, '').every((a) => a.roles.includes(role)));
  }
  for (const role of ['Inspection', 'Emcee', 'Judge Advisor', 'Referee']) {
    assert.ok(!visibleArticles(role).some((a) => a.id === 'clear'));
    assert.ok(!searchArticles(role, 'Delete Selected').some((a) => a.id === 'clear'));
  }
  assert.ok(!visibleArticles('Emcee').some((a) => a.id === 'violation'));
  assert.ok(!visibleArticles('Inspection').some((a) => a.id === 'judging'));
  assert.deepEqual(visibleArticles('Unknown'), []);
});
test('search covers titles, section labels, content, keywords, and category', () => {
  assert.ok(searchArticles('Admin', 'violation').some((a) => a.id === 'violation-export'));
  assert.ok(searchArticles('Admin', 'league').some((a) => a.id === 'conversion'));
  assert.ok(searchArticles('Referee', 'offline').some((a) => a.id === 'offline'));
  assert.ok(searchArticles('Admin', '  APPLY changes ').some((a) => a.id === 'tm'));
  assert.ok(searchArticles('Admin', 'How to use it').length > 0);
  assert.ok(searchArticles('Referee', 'disciplinary').some((a) => a.id === 'violation'));
  assert.ok(searchArticles('Admin', '', 'League Events').every((a) => a.category === 'League Events'));
  assert.deepEqual(searchArticles('Admin', 'no-such-guide-phrase'), []);
});
test('guide does not embed credentials, UUIDs, or remote HTML', () => {
  const text = JSON.stringify(GUIDE_ARTICLES);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text));
  assert.ok(!/eyJ[a-zA-Z0-9_-]{20}|supabase\.co|service_role|test-admin|1A23|<script/i.test(text));
});
