#!/usr/bin/env node
import { Monitor } from '../monitoring/Monitor.js';
import { Logger } from '../monitoring/Logger.js';
async function showHealthCheck() {
    const monitor = Monitor.getInstance();
    const health = await monitor.healthCheck();
    console.log('🏥 System Health Check');
    console.log('='.repeat(40));
    console.log(`Overall Status: ${getStatusEmoji(health.status)} ${health.status.toUpperCase()}`);
    console.log();
    for (const [check, result] of Object.entries(health.checks)) {
        const emoji = result.status === 'pass' ? '✅' : '❌';
        const duration = result.duration ? ` (${result.duration}ms)` : '';
        console.log(`${emoji} ${check}${duration}`);
        if (result.message) {
            console.log(`   ${result.message}`);
        }
    }
    console.log();
}
async function showMetrics() {
    const monitor = Monitor.getInstance();
    const metrics = await monitor.getMetrics();
    console.log('📊 Performance Metrics');
    console.log('='.repeat(40));
    // Request metrics
    console.log('🌐 Requests:');
    console.log(`   Total: ${metrics.requests.total}`);
    console.log(`   Successful: ${metrics.requests.successful} (${getPercentage(metrics.requests.successful, metrics.requests.total)}%)`);
    console.log(`   Failed: ${metrics.requests.failed} (${getPercentage(metrics.requests.failed, metrics.requests.total)}%)`);
    console.log(`   Avg Response Time: ${metrics.requests.avgResponseTime.toFixed(2)}ms`);
    console.log(`   95th Percentile: ${metrics.requests.p95ResponseTime.toFixed(2)}ms`);
    console.log();
    // Learning metrics
    console.log('🧠 Learning System:');
    console.log(`   Total Patterns: ${metrics.learning.totalPatterns}`);
    console.log(`   Average Confidence: ${(metrics.learning.averageConfidence * 100).toFixed(1)}%`);
    console.log(`   Improvement Rate: ${(metrics.learning.improvementRate * 100).toFixed(1)}%`);
    console.log();
    // System metrics
    console.log('⚙️  System:');
    console.log(`   Uptime: ${formatUptime(metrics.system.uptime)}`);
    console.log(`   Memory Usage: ${metrics.system.memoryUsage.toFixed(2)}MB`);
    console.log(`   CPU Usage: ${metrics.system.cpuUsage.toFixed(2)}ms`);
    console.log();
    // Error metrics
    console.log('🚨 Errors:');
    console.log(`   Total Errors: ${metrics.errors.totalErrors}`);
    console.log(`   Error Rate: ${(metrics.errors.errorRate * 100).toFixed(1)}%`);
    if (metrics.errors.topErrors.length > 0) {
        console.log('   Top Errors:');
        for (const error of metrics.errors.topErrors) {
            console.log(`     ${error.code}: ${error.count}`);
        }
    }
    console.log();
}
function showRecentLogs() {
    const logger = Logger.getInstance();
    const logs = logger.getRecentLogs(10);
    console.log('📝 Recent Logs (Last 10)');
    console.log('='.repeat(40));
    if (logs.length === 0) {
        console.log('No recent logs available');
        return;
    }
    for (const log of logs) {
        const timestamp = new Date(log.timestamp).toLocaleString();
        const level = log.level.toString().padEnd(5);
        const correlationId = log.correlationId ? `[${log.correlationId}] ` : '';
        console.log(`${timestamp} [${level}] ${correlationId}${log.message}`);
    }
    console.log();
}
function getStatusEmoji(status) {
    switch (status) {
        case 'healthy': return '🟢';
        case 'degraded': return '🟡';
        case 'unhealthy': return '🔴';
        default: return '⚪';
    }
}
function getPercentage(value, total) {
    if (total === 0)
        return '0';
    return ((value / total) * 100).toFixed(1);
}
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0)
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0)
        return `${hours}h ${minutes % 60}m`;
    if (minutes > 0)
        return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'all';
    console.log('🔍 CodeSight Monitoring Dashboard');
    console.log('Timestamp:', new Date().toISOString());
    console.log();
    try {
        switch (command) {
            case 'health':
                await showHealthCheck();
                break;
            case 'metrics':
                await showMetrics();
                break;
            case 'logs':
                showRecentLogs();
                break;
            case 'all':
            default:
                await showHealthCheck();
                await showMetrics();
                showRecentLogs();
                break;
        }
    }
    catch (error) {
        console.error('❌ Error running monitoring dashboard:', error);
        process.exit(1);
    }
}
// Run main function if this is the main module
main();
//# sourceMappingURL=monitor.js.map