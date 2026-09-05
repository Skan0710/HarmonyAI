// Comprehensive HarmonyAI backend test runner - invokes all major test suites
import { runAdaptivePipelineTests } from './src/__tests__/adaptiveRecommendationRankingPipeline.test.js';
import { runAdaptiveRecommendationIntegrationTests } from './src/__tests__/adaptiveRecommendationIntegration.test.js';
import { runSmartAutoplayServiceTests } from './src/__tests__/smartAutoplayService.test.js';
import { runTemporalPreferenceLearningTests } from './src/__tests__/temporalPreferenceLearning.test.js';
import { runLayeredTemporalTasteProfileServiceTests } from './src/__tests__/layeredTemporalTasteProfileService.test.js';
import { runDynamicSessionAutoplayAdaptationTests } from './src/__tests__/dynamicSessionAutoplayAdaptation.test.js';
import { runRecommendationIntelligenceTests } from './src/__tests__/recommendationIntelligence.test.js';
import { runComprehensiveExplainabilityTests } from './src/__tests__/recommendationExplainabilityComprehensive.test.js';
import { runSmartAutoplayComprehensiveRefinementTests } from './src/__tests__/smartAutoplayComprehensiveRefinement.test.js';
import { runSmartAutoplayAdaptiveQueueTests } from './src/__tests__/smartAutoplayAdaptiveQueue.test.js';
import { runTemporalPreferenceAggregationServiceTests } from './src/__tests__/temporalPreferenceAggregationService.test.js';
import { runTemporalRecommendationIntegrationTests } from './src/__tests__/temporalRecommendationIntegration.test.js';
import { runRecommendationExplanationFeedbackTests } from './src/__tests__/recommendationExplanationFeedback.test.js';
import { runRecommendationExplanationEndpointTests } from './src/__tests__/recommendationExplanationEndpoint.test.js';
import { runTemporalTasteProfileEndpointTests } from './src/__tests__/temporalTasteProfileEndpoint.test.js';

const suites = [
  { name: 'Adaptive Ranking Pipeline',            fn: runAdaptivePipelineTests },
  { name: 'Adaptive Integration (Day 30 T7)',     fn: runAdaptiveRecommendationIntegrationTests },
  { name: 'Smart Autoplay Service',               fn: runSmartAutoplayServiceTests },
  { name: 'Temporal Preference Learning',         fn: runTemporalPreferenceLearningTests },
  { name: 'Layered Temporal Taste Profile',       fn: runLayeredTemporalTasteProfileServiceTests },
  { name: 'Dynamic Session Autoplay Adaptation',  fn: runDynamicSessionAutoplayAdaptationTests },
  { name: 'Recommendation Intelligence',          fn: runRecommendationIntelligenceTests },
  { name: 'Explainability Comprehensive',         fn: runComprehensiveExplainabilityTests },
  { name: 'Smart Autoplay Comprehensive',         fn: runSmartAutoplayComprehensiveRefinementTests },
  { name: 'Smart Autoplay Adaptive Queue',        fn: runSmartAutoplayAdaptiveQueueTests },
  { name: 'Temporal Preference Aggregation',      fn: runTemporalPreferenceAggregationServiceTests },
  { name: 'Temporal Recommendation Integration',  fn: runTemporalRecommendationIntegrationTests },
  { name: 'Explanation Feedback',                 fn: runRecommendationExplanationFeedbackTests },
  { name: 'Explanation Endpoint',                 fn: runRecommendationExplanationEndpointTests },
  { name: 'Temporal Taste Profile Endpoint',      fn: runTemporalTasteProfileEndpointTests },
];

let passed = 0;
let failed = 0;
const failures: { name: string; error: string }[] = [];

async function main() {
  for (const suite of suites) {
    process.stdout.write(`\n${'─'.repeat(60)}\n▶ Running: ${suite.name}\n${'─'.repeat(60)}\n`);
    try {
      await suite.fn();
      passed++;
      process.stdout.write(`✅ PASSED: ${suite.name}\n`);
    } catch (err: any) {
      failed++;
      const msg = err?.message || String(err);
      failures.push({ name: suite.name, error: msg });
      process.stderr.write(`❌ FAILED: ${suite.name}\n   ${msg}\n`);
    }
  }

  process.stdout.write(`\n${'═'.repeat(60)}\n`);
  process.stdout.write(`RESULTS: ${passed} passed, ${failed} failed / ${suites.length} total\n`);
  process.stdout.write(`${'═'.repeat(60)}\n`);

  if (failures.length > 0) {
    process.stdout.write('\nFAILED SUITES:\n');
    failures.forEach(f => process.stdout.write(`  ✗ ${f.name}\n    ${f.error}\n`));
    process.exit(1);
  } else {
    process.stdout.write('\n🎉 ALL SUITES PASSED!\n');
  }
}

main().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});

