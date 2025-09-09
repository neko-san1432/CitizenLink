import { performance } from 'perf_hooks';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Performance metrics storage
const metrics = {
  precompressed: {
    requests: 0,
    totalTime: 0,
    totalSize: 0,
    avgTime: 0,
    avgSize: 0
  },
  runtime: {
    requests: 0,
    totalTime: 0,
    totalSize: 0,
    avgTime: 0,
    avgSize: 0
  },
  uncompressed: {
    requests: 0,
    totalTime: 0,
    totalSize: 0,
    avgTime: 0,
    avgSize: 0
  }
};

// Benchmark a single file operation
function benchmarkFileOperation(operation, filePath, originalSize) {
  const startTime = performance.now();
  const result = operation();
  const endTime = performance.now();
  
  const duration = endTime - startTime;
  const compressedSize = result ? result.length : originalSize;
  
  return {
    duration,
    originalSize,
    compressedSize,
    compressionRatio: ((1 - compressedSize / originalSize) * 100).toFixed(2)
  };
}

// Test pre-compression performance
function testPrecompression(filePath) {
  const gzPath = filePath + '.gz';
  
  if (!existsSync(gzPath)) {
    return null;
  }
  
  const originalSize = statSync(filePath).size;
  
  return benchmarkFileOperation(() => {
    return readFileSync(gzPath);
  }, filePath, originalSize);
}

// Test runtime compression performance
function testRuntimeCompression(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  
  const originalContent = readFileSync(filePath);
  const originalSize = originalContent.length;
  
  return benchmarkFileOperation(() => {
    return gzipSync(originalContent, { level: 6 });
  }, filePath, originalSize);
}

// Test uncompressed serving
function testUncompressed(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  
  const originalSize = statSync(filePath).size;
  
  return benchmarkFileOperation(() => {
    return readFileSync(filePath);
  }, filePath, originalSize);
}

// Run comprehensive benchmark
function runBenchmark() {
  console.log('🚀 Starting comprehensive compression benchmark...\n');
  
  const testFiles = [
    'index.html',
    'css/styles.css',
    'js/main.js',
    'citizen/dashboard.html',
    'lgu/dashboard.html'
  ];
  
  let totalPrecompressed = 0;
  let totalRuntime = 0;
  let totalUncompressed = 0;
  
  console.log('📊 File-by-File Performance Analysis:');
  console.log('=' .repeat(80));
  
  for (const file of testFiles) {
    const filePath = join(__dirname, file);
    
    if (!existsSync(filePath)) {
      console.log(`⚠️  File not found: ${file}`);
      continue;
    }
    
    console.log(`\n📁 Testing: ${file}`);
    console.log('-'.repeat(50));
    
    // Test pre-compression
    const precompressedResult = testPrecompression(filePath);
    if (precompressedResult) {
      console.log(`✅ Pre-compressed: ${precompressedResult.duration.toFixed(2)}ms | ${precompressedResult.originalSize} → ${precompressedResult.compressedSize} bytes (${precompressedResult.compressionRatio}% reduction)`);
      totalPrecompressed += precompressedResult.duration;
    } else {
      console.log('❌ Pre-compressed: Not available');
    }
    
    // Test runtime compression
    const runtimeResult = testRuntimeCompression(filePath);
    if (runtimeResult) {
      console.log(`🔄 Runtime: ${runtimeResult.duration.toFixed(2)}ms | ${runtimeResult.originalSize} → ${runtimeResult.compressedSize} bytes (${runtimeResult.compressionRatio}% reduction)`);
      totalRuntime += runtimeResult.duration;
    } else {
      console.log('❌ Runtime: Failed');
    }
    
    // Test uncompressed
    const uncompressedResult = testUncompressed(filePath);
    if (uncompressedResult) {
      console.log(`📄 Uncompressed: ${uncompressedResult.duration.toFixed(2)}ms | ${uncompressedResult.originalSize} bytes`);
      totalUncompressed += uncompressedResult.duration;
    } else {
      console.log('❌ Uncompressed: Failed');
    }
    
    // Performance comparison
    if (precompressedResult && runtimeResult) {
      const speedup = (runtimeResult.duration / precompressedResult.duration).toFixed(2);
      console.log(`⚡ Pre-compression is ${speedup}x faster than runtime compression`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📈 OVERALL PERFORMANCE SUMMARY');
  console.log('='.repeat(80));
  console.log(`🚀 Pre-compressed total time: ${totalPrecompressed.toFixed(2)}ms`);
  console.log(`🔄 Runtime compression total time: ${totalRuntime.toFixed(2)}ms`);
  console.log(`📄 Uncompressed total time: ${totalUncompressed.toFixed(2)}ms`);
  
  if (totalPrecompressed > 0 && totalRuntime > 0) {
    const overallSpeedup = (totalRuntime / totalPrecompressed).toFixed(2);
    const timeSaved = (totalRuntime - totalPrecompressed).toFixed(2);
    console.log(`\n⚡ Pre-compression is ${overallSpeedup}x faster overall`);
    console.log(`⏱️  Time saved per request cycle: ${timeSaved}ms`);
  }
  
  console.log('\n💡 Performance Impact Analysis:');
  console.log('   • Pre-compression: Minimal CPU usage, maximum speed');
  console.log('   • Runtime compression: Higher CPU usage, slower response');
  console.log('   • Uncompressed: Fastest serving, largest file sizes');
  console.log('\n🎯 Recommendation: Use pre-compression for production!');
}

// Run the benchmark
runBenchmark();
