import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { readScoresFromFirstSheet, writeRanksToFirstSheet, writeScoresToFirstSheet } from '../src/google/sheetsClient';

const options = {
    spreadsheetId: 'test-spreadsheet',
    token: 'test-token',
    scoreColumnHeader: 'Score (optional)',
    scoresBySongId: new Map([[1, 9.5], [2, 0]]),
};

function mockSheet(t: TestContext, values: unknown[][]) {
    const writes: Array<{ valueInputOption: string; data: Array<{ range: string; values: number[][] }> }> = [];
    t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
            assert.equal(url, 'https://sheets.googleapis.com/v4/spreadsheets/test-spreadsheet/values:batchUpdate');
            writes.push(JSON.parse(String(init.body)));
            return Response.json({});
        }
        if (url.includes('/values/')) {
            assert.ok(url.includes("'Sheet4'"));
            return Response.json({ values });
        }
        return Response.json({ sheets: [{ properties: { title: 'Sheet4', index: 0, sheetType: 'GRID' } }] });
    });
    return writes;
}

for (const [configuredHeader, sheetHeader] of [
    ['Score (optional)', 'Score (optional)'],
    ['Score', 'Score'],
]) {
    test(`writes ${sheetHeader} when configured as ${configuredHeader}`, async (t) => {
        const writes = mockSheet(t, [['ID', sheetHeader, 'Rank'], [2], [1]]);
        const count = await writeScoresToFirstSheet({ ...options, scoreColumnHeader: configuredHeader });
        assert.equal(count, 2);
        assert.deepEqual(writes, [{ valueInputOption: 'RAW', data: [
            { range: "'Sheet4'!B3", values: [[9.5]] },
            { range: "'Sheet4'!B2", values: [[0]] },
        ] }]);
    });

    test(`reads ${sheetHeader} when configured as ${configuredHeader}`, async (t) => {
        const writes = mockSheet(t, [['ID', ` ${sheetHeader} `], [2, 0], [1, 9.5]]);
        const scores = await readScoresFromFirstSheet({ ...options, scoreColumnHeader: configuredHeader, songIds: [1, 2] });
        assert.deepEqual(scores, new Map([[2, '0'], [1, '9.5']]));
        assert.deepEqual(writes, []);
    });
}

test('prefers the configured score column when both standard names exist', async (t) => {
    const writes = mockSheet(t, [['ID', 'Score', 'Score (optional)'], [1], [2]]);
    await writeScoresToFirstSheet(options);
    assert.deepEqual(writes[0].data.map((update) => update.range), ["'Sheet4'!C2", "'Sheet4'!C3"]);
});

for (const [headers, scoreColumnHeader, message] of [
    [['ID', 'Rating'], 'Score (optional)', /Score header "Score \(optional\)" was not found/],
    [['ID', 'Score'], 'My score', /Score header "My score" was not found/],
    [['ID', 'Score (optional)', 'Score (optional)'], 'Score (optional)', /appears more than once/],
    [['ID', 'Score', 'Score'], 'Score', /appears more than once/],
    [['ID', 'Score'], 'Score (optional)', /was not found/],
    [['ID', 'Score (optional)'], 'Score', /was not found/],
] as const) {
    test(`rejects missing or duplicate score headers: ${headers.join(', ')} (${scoreColumnHeader})`, async (t) => {
        const writes = mockSheet(t, [[...headers], [1], [2]]);
        await assert.rejects(writeScoresToFirstSheet({ ...options, scoreColumnHeader }), message);
        assert.deepEqual(writes, [], 'validation must stop before writing any cells');
    });
}

test('writes ranks and scores together using the configured score column', async (t) => {
    const writes = mockSheet(t, [['ID', 'Score', 'Rank'], [1], [2]]);
    const count = await writeRanksToFirstSheet({ ...options, scoreColumnHeader: 'Score', rankColumnHeader: 'Rank', ranksBySongId: new Map([[1, 1], [2, 2]]) });
    assert.equal(count, 4);
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].data, [
        { range: "'Sheet4'!C2", values: [[1]] },
        { range: "'Sheet4'!C3", values: [[2]] },
        { range: "'Sheet4'!B2", values: [[9.5]] },
        { range: "'Sheet4'!B3", values: [[0]] },
    ]);
});

test('aborts combined rank and score writes if the score column is missing', async (t) => {
    const writes = mockSheet(t, [['ID', 'Rank'], [1], [2]]);
    await assert.rejects(writeRanksToFirstSheet({ ...options, rankColumnHeader: 'Rank', ranksBySongId: new Map([[1, 1], [2, 2]]) }), /Score header/);
    assert.deepEqual(writes, []);
});
