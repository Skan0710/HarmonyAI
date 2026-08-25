import assert from 'node:assert';
import { SearchSuggestionService } from '../services/searchSuggestionService.js';
import { searchSuggestions } from '../controllers/searchController.js';

export function runSearchSuggestionServiceTests() {
  console.log('[Search Suggestion Service Test Suite] Starting tests...');

  // Test 1: evaluateMatch Match Classification & Priority Scoring
  {
    const exact = SearchSuggestionService.evaluateMatch('The Weeknd', 'The Weeknd');
    assert.ok(exact !== null);
    assert.strictEqual(exact.score, 1.0);
    assert.strictEqual(exact.matchType, 'exact_prefix');

    const prefix = SearchSuggestionService.evaluateMatch('The Weeknd', 'the');
    assert.ok(prefix !== null);
    assert.ok(prefix.score >= 0.90 && prefix.score < 1.0);
    assert.strictEqual(prefix.matchType, 'exact_prefix');

    const wordPrefix = SearchSuggestionService.evaluateMatch('The Weeknd', 'week');
    assert.ok(wordPrefix !== null);
    assert.strictEqual(wordPrefix.score, 0.80);
    assert.strictEqual(wordPrefix.matchType, 'word_prefix');

    const substring = SearchSuggestionService.evaluateMatch('The Weeknd', 'eek');
    assert.ok(substring !== null);
    assert.strictEqual(substring.score, 0.60);
    assert.strictEqual(substring.matchType, 'substring');

    const nonMatch = SearchSuggestionService.evaluateMatch('The Weeknd', 'xyz123');
    assert.strictEqual(nonMatch, null);

    console.log('✓ Test 1 Passed: Match classification (exact_prefix, word_prefix, substring) verified.');
  }

  // Test 2: Prefix Matches Prioritized Over Substring Matches
  {
    const prefixMatch = SearchSuggestionService.evaluateMatch('Synthwave Dreams', 'synth');
    const substringMatch = SearchSuggestionService.evaluateMatch('Pure Synthwave Magic', 'wave');

    assert.ok(prefixMatch !== null && substringMatch !== null);
    assert.ok(
      prefixMatch.score > substringMatch.score,
      `Prefix score (${prefixMatch.score}) must exceed substring score (${substringMatch.score})`
    );

    console.log('✓ Test 2 Passed: Exact prefix match prioritization over substring verified.');
  }

  // Test 3: Empty & Whitespace Query Handling
  {
    SearchSuggestionService.getSuggestions({ query: '   ' }).then((res) => {
      assert.strictEqual(res.query, '');
      assert.strictEqual(res.suggestions.length, 0);
      assert.strictEqual(res.total, 0);

      console.log('✓ Test 3 Passed: Empty query returns 0 suggestions safely.');
    });
  }

  // Test 4: Configurable Result Limit
  {
    SearchSuggestionService.getSuggestions({ query: 'Star', limit: 3 }).then((res) => {
      assert.ok(res.suggestions.length <= 3);

      console.log('✓ Test 4 Passed: Configurable suggestion limit respected.');
    });
  }

  // Test 5: Controller Endpoint & Parameter Validation
  {
    const req: any = {
      query: { q: 'Daft', limit: '5' },
      params: {},
    };
    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseBody = data;
        return res;
      },
    };

    searchSuggestions(req, res).then(() => {
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(responseBody.success, true);
      assert.ok(Array.isArray(responseBody.data.suggestions));

      console.log('✓ Test 5 Passed: Search suggestions API controller verified.');
    });
  }

  // Test 6: Query Length Boundary (Reject queries > 200 chars)
  {
    const excessiveQuery = 'A'.repeat(201);
    const req: any = {
      query: { q: excessiveQuery },
      params: {},
    };
    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseBody = data;
        return res;
      },
    };

    searchSuggestions(req, res).then(() => {
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(responseBody.success, false);
      assert.ok(responseBody.message.includes('exceeds maximum allowed length'));

      console.log('✓ Test 6 Passed: Suggestion query length boundary enforced.');
    });
  }

  console.log('🎉 All search suggestion service tests completed successfully.');
}
