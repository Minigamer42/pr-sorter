import assert from 'node:assert/strict';
import { test } from 'node:test';
import { libraryFilterFromUrl, libraryHref, libraryOverviewHref } from '../src/app/libraryRouting';

test('the library is a dedicated route under the main site and selects its own playlist', () => {
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/library/'), 'liked');
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/library/liked/'), 'liked');
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/library/rated/'), 'above-threshold');
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/library/rated'), 'above-threshold');
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/library/unknown/'), null);
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/test/'), null);
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/'), null);
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/?library=liked'), null);
    assert.equal(libraryFilterFromUrl('https://example.com/pr-sorter/library/liked/?filter=above-threshold'), 'liked');
});

test('overview, local, and external sorter links lead to the main library', () => {
    assert.equal(libraryHref('./', 'https://example.com/pr-sorter/'), 'https://example.com/pr-sorter/library/liked/');
    assert.equal(libraryHref('../', 'https://example.com/pr-sorter/test/'), 'https://example.com/pr-sorter/library/liked/');
    assert.equal(libraryHref('https://example.com/pr-sorter/', 'https://example.com/pr-sorter/external/source/list/', 'above-threshold'),
        'https://example.com/pr-sorter/library/rated/');
});

test('the library returns to the main overview, including when hosted in a subdirectory', () => {
    assert.equal(libraryOverviewHref('https://example.com/library/'), 'https://example.com/');
    assert.equal(libraryOverviewHref('https://example.com/pr-sorter/library/liked/'), 'https://example.com/pr-sorter/');
    assert.equal(libraryOverviewHref('https://example.com/pr-sorter/library/rated'), 'https://example.com/pr-sorter/');
});
