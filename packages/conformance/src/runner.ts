import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { TestFixture, ConformanceResult, TestResult } from './types.js';
import { executeTest } from './executor.js';
import { generateBadge } from './badge.js';
import { validateCanonicalization } from './vectors.js';

export class ConformanceRunner {
  private baseUrl: string;
  private fixtures: TestFixture[];
  
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.fixtures = this.loadFixtures();
  }
  
  private loadFixtures(): TestFixture[] {
    const fixturesPath = resolve(process.cwd(), 'fixtures/');
    const categories = ['valid', 'invalid-signature', 'expired', 'audience', 'revoked', 'replay'];
    
    const fixtures: TestFixture[] = [];
    
    for (const category of categories) {
      const categoryPath = resolve(fixturesPath, `${category}.json`);
      
      if (!existsSync(categoryPath)) {
        console.warn(chalk.yellow(`⚠️  Missing fixture file: ${categoryPath}`));
        continue;
      }
      
      try {
        const categoryData = JSON.parse(readFileSync(categoryPath, 'utf-8'));
        
        fixtures.push(...categoryData.tests.map((test: any) => ({
          ...test,
          category: category as TestFixture['category'],
          id: `${category}-${test.name}`
        })));
      } catch (error) {
        console.error(chalk.red(`❌ Failed to load fixture ${categoryPath}:`, error));
      }
    }
    
    return fixtures;
  }
  
  async run(): Promise<ConformanceResult> {
    console.log(chalk.blue(`🧪 Running AgentOAuth Conformance Tests`));
    console.log(chalk.gray(`   Target: ${this.baseUrl}`));
    console.log(chalk.gray(`   Fixtures: ${this.fixtures.length} tests\n`));
    
    // First, validate test vectors
    await this.validateTestVectors();
    
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;
    
    for (const fixture of this.fixtures) {
      try {
        const result = await executeTest(fixture, this.baseUrl);
        results.push(result);
        
        if (result.passed) {
          console.log(chalk.green(`✅ ${result.id}`));
          passed++;
        } else {
          console.log(chalk.red(`❌ ${result.id}: ${result.error}`));
          failed++;
        }
      } catch (error) {
        const result: TestResult = {
          id: fixture.id,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0
        };
        results.push(result);
        console.log(chalk.red(`❌ ${fixture.id}: ${result.error}`));
        failed++;
      }
    }
    
    const conformanceResult: ConformanceResult = {
      target: this.baseUrl,
      timestamp: new Date().toISOString(),
      summary: {
        total: this.fixtures.length,
        passed,
        failed,
        passRate: Math.round((passed / this.fixtures.length) * 100)
      },
      results
    };
    
    console.log(`\n📊 Conformance Results:`);
    console.log(`   Total: ${conformanceResult.summary.total}`);
    console.log(`   ${chalk.green(`Passed: ${conformanceResult.summary.passed}`)}`);
    console.log(`   ${chalk.red(`Failed: ${conformanceResult.summary.failed}`)}`);
    console.log(`   Pass Rate: ${conformanceResult.summary.passRate}%`);
    
    // Generate badge and save results
    await generateBadge(conformanceResult);
    
    return conformanceResult;
  }
  
  private async validateTestVectors(): Promise<void> {
    const vectorsPath = resolve(process.cwd(), 'fixtures/test-vectors.json');
    
    if (!existsSync(vectorsPath)) {
      console.warn(chalk.yellow(`⚠️  No test vectors found at ${vectorsPath}`));
      return;
    }
    
    try {
      const vectorsData = JSON.parse(readFileSync(vectorsPath, 'utf-8'));
      const isValid = validateCanonicalization(vectorsData.vectors);
      
      if (isValid) {
        console.log(chalk.green(`✅ Test vectors validation passed`));
      } else {
        console.log(chalk.red(`❌ Test vectors validation failed`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to validate test vectors:`, error));
    }
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const runner = new ConformanceRunner(baseUrl);
  
  runner.run()
    .then(result => {
      process.exit(result.summary.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('❌ Conformance runner failed:'), error);
      process.exit(1);
    });
}
