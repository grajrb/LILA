// Quick test of EnvironmentSynchronizer functionality
const { EnvironmentSynchronizer } = require('./app/utils/EnvironmentSynchronizer.ts');

async function testEnvironmentSynchronizer() {
  try {
    const synchronizer = EnvironmentSynchronizer.getInstance();
    
    console.log('Testing Environment Synchronizer...');
    
    // Test validation
    const validationResults = synchronizer.validateRequiredVariables();
    console.log('Validation Results:', validationResults.length, 'variables checked');
    
    // Test sync check
    const syncStatus = await synchronizer.checkEnvironmentSync();
    console.log('Sync Status:', syncStatus.inSync ? 'In Sync' : 'Out of Sync');
    
    // Test validation report
    const report = synchronizer.generateValidationReport();
    console.log('Validation Report Generated:', report.environment);
    
    console.log('✅ Environment Synchronizer test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEnvironmentSynchronizer();