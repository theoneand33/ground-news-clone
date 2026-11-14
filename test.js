const test = require('node:test');
const assert = require('node:assert');
const { parseFeed, cluster } = require('./server.js');

test('parseFeed strips source suffix, decodes entities, drops non-https links', () => {
  const xml = `<rss><channel>
    <item><title>Fed &amp; markets: rates held - Reuters</title><link>https://example.com/a</link>
      <pubDate>Sat, 14 Nov 2026 03:45:21 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item>
    <item><title>Bad link</title><link>javascript:alert(1)</link><source>Reuters</source></item>
  </channel></rss>`;
  const items = parseFeed(xml, 'reuters.com');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Fed & markets: rates held');
  assert.equal(items[0].bias, 'C');
});

test('cluster groups the same story across outlets and counts bias', () => {
  const a = (title, source, bias) => ({ title, source, bias, link: 'https://x', time: 1 });
  const stories = cluster([
    a('Senate passes sweeping border security bill after marathon vote', 'A', 'L'),
    a('Border security bill passes Senate in late-night marathon vote', 'B', 'R'),
    a('Senate border bill: marathon vote ends with passage of security package', 'B', 'R'),
    a('Hurricane makes landfall on Florida coast as thousands evacuate', 'C', 'C'),
  ]);
  assert.equal(stories.length, 2);
  assert.deepEqual(stories[0].counts, { L: 1, C: 0, R: 1 }); // outlet B counted once
});
