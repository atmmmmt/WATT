import { Injectable } from '@nestjs/common';
import * as os from 'node:os';
import { statfs } from 'node:fs/promises';

function bytes(value: number) {
  return Math.max(0, Math.round(value));
}

function percent(used: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Number(((used / total) * 100).toFixed(1))));
}

function healthLevel(cpuPercent: number, memoryPercent: number, diskPercent: number) {
  const peak = Math.max(cpuPercent, memoryPercent, diskPercent);
  if (peak >= 90) return 'critical';
  if (peak >= 75) return 'warning';
  return 'healthy';
}

@Injectable()
export class ServerMetricsService {
  private previousCpuSample: { idle: number; total: number } | null = null;

  async getMetrics() {
    const cpuPercent = this.sampleCpuPercent();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    let diskTotal = 0;
    let diskFree = 0;
    try {
      const disk = await statfs('/');
      diskTotal = Number(disk.blocks) * Number(disk.bsize);
      diskFree = Number(disk.bavail) * Number(disk.bsize);
    } catch {
      // Disk metrics remain zero if the host filesystem cannot expose statfs.
    }
    const diskUsed = Math.max(0, diskTotal - diskFree);

    const memoryPercent = percent(usedMemory, totalMemory);
    const diskPercent = percent(diskUsed, diskTotal);
    const nodeMemory = process.memoryUsage();

    return {
      generatedAt: new Date().toISOString(),
      host: {
        hostname: os.hostname(),
        platform: os.platform(),
        architecture: os.arch(),
        cpuCores: os.cpus().length,
        uptimeSeconds: Math.round(os.uptime()),
        loadAverage: os.loadavg().map((value) => Number(value.toFixed(2))),
      },
      cpu: {
        percent: cpuPercent,
      },
      memory: {
        totalBytes: bytes(totalMemory),
        usedBytes: bytes(usedMemory),
        freeBytes: bytes(freeMemory),
        percent: memoryPercent,
      },
      disk: {
        totalBytes: bytes(diskTotal),
        usedBytes: bytes(diskUsed),
        freeBytes: bytes(diskFree),
        percent: diskPercent,
      },
      process: {
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
        rssBytes: bytes(nodeMemory.rss),
        heapUsedBytes: bytes(nodeMemory.heapUsed),
        heapTotalBytes: bytes(nodeMemory.heapTotal),
        externalBytes: bytes(nodeMemory.external),
        nodeVersion: process.version,
      },
      health: {
        level: healthLevel(cpuPercent, memoryPercent, diskPercent),
        thresholds: {
          warningPercent: 75,
          criticalPercent: 90,
        },
      },
    };
  }

  private sampleCpuPercent() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
    }

    const previous = this.previousCpuSample;
    this.previousCpuSample = { idle, total };

    if (!previous) {
      const normalizedLoad = cpus.length ? os.loadavg()[0] / cpus.length : 0;
      return Number(Math.max(0, Math.min(100, normalizedLoad * 100)).toFixed(1));
    }

    const totalDelta = total - previous.total;
    const idleDelta = idle - previous.idle;
    if (totalDelta <= 0) return 0;
    return Number(Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)).toFixed(1));
  }
}
