import { writeFileSync } from 'fs';
import { ConformanceResult } from './types.js';

export async function generateBadge(result: ConformanceResult): Promise<void> {
  // Save detailed results
  writeFileSync('conformance.json', JSON.stringify(result, null, 2));
  
  // Generate shield.io badge URL
  const { passRate } = result.summary;
  const color = passRate >= 90 ? 'brightgreen' : passRate >= 75 ? 'yellow' : 'red';
  const badgeUrl = `https://img.shields.io/badge/conformance-${passRate}%25-${color}`;
  
  // Create conformance report
  const readmeContent = `## Conformance

![Conformance Badge](${badgeUrl})

**Last tested:** ${result.timestamp}  
**Target:** ${result.target}  
**Results:** ${result.summary.passed}/${result.summary.total} tests passed

### Test Categories

${generateCategorySummary(result)}

### Failed Tests

${generateFailedTestsSummary(result)}

See [conformance.json](./conformance.json) for detailed results.

### Usage

\`\`\`bash
# Test against local API
pnpm test:conformance

# Test against remote deployment  
BASE_URL=https://your-api.com pnpm test:conformance:remote
\`\`\`
`;
  
  writeFileSync('CONFORMANCE.md', readmeContent.trim());
  
  console.log(`\n📋 Generated conformance badge: ${passRate}%`);
  console.log(`   Badge URL: ${badgeUrl}`);
  console.log(`   Results saved to: conformance.json`);
  console.log(`   Report saved to: CONFORMANCE.md`);
}

function generateCategorySummary(result: ConformanceResult): string {
  const categories = new Map<string, { passed: number; total: number }>();
  
  for (const testResult of result.results) {
    const category = testResult.id.split('-')[0];
    const current = categories.get(category) || { passed: 0, total: 0 };
    current.total++;
    if (testResult.passed) current.passed++;
    categories.set(category, current);
  }
  
  let summary = '';
  for (const [category, stats] of categories.entries()) {
    const status = stats.passed === stats.total ? '✅' : '❌';
    summary += `- **${category}**: ${status} ${stats.passed}/${stats.total}\n`;
  }
  
  return summary || 'No test results available.';
}

function generateFailedTestsSummary(result: ConformanceResult): string {
  const failedTests = result.results.filter(r => !r.passed);
  
  if (failedTests.length === 0) {
    return '🎉 All tests passed!';
  }
  
  let summary = '';
  for (const test of failedTests) {
    summary += `- **${test.id}**: ${test.error}\n`;
  }
  
  return summary;
}
