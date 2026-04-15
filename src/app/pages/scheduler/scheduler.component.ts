import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './scheduler.component.html',
  styleUrl: './scheduler.component.css',
})
export class SchedulerComponent {
  jobFilter = signal('All');
  selectedJob = signal<any>(null);
  showNewJob = signal(false);

  jobFilters = ['All', 'Running', 'Idle', 'Disabled'];

  schedulerStats = [
    { label: 'Total Jobs', value: '14', icon: 'schedule', iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)', color: 'var(--text-primary)' },
    { label: 'Running', value: '1', icon: 'sync', iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' },
    { label: 'Idle', value: '11', icon: 'check_circle', iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)', color: 'var(--success)' },
    { label: 'Disabled', value: '2', icon: 'pause_circle', iconBg: 'rgba(255,165,2,0.1)', iconColor: 'var(--warning)', color: 'var(--warning)' },
    { label: "Today's Runs", value: '87', icon: 'play_circle', iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)', color: 'var(--accent-teal)' },
  ];

  jobs = [
    {
      id: 1, name: 'Coupon Payment Processor', desc: 'Calculate and distribute coupon payments to bondholders',
      icon: 'payments', iconBg: 'rgba(0,212,255,0.12)', iconColor: 'var(--accent-cyan)',
      cron: '0 9 * * 1-5', humanCron: 'Every weekday at 09:00 AST',
      status: 'Idle', enabled: true, lastRun: '2h ago', lastStatus: 'Success', nextRun: 'Tomorrow 09:00', avgDuration: '4m 32s', successRate: 99.8, totalRuns: 1247, owner: 'Finance Team',
      runHistory: [{ id: 1247, started: 'Today 09:00', duration: '4m 12s', status: 'Success', records: '12 bonds · SAR 1.2M' }, { id: 1246, started: 'Yesterday 09:00', duration: '4m 45s', status: 'Success', records: '8 bonds · SAR 840K' }, { id: 1245, started: 'Apr 13 09:00', duration: '3m 58s', status: 'Success', records: '15 bonds · SAR 1.8M' }],
    },
    {
      id: 2, name: 'Bond Maturity Checker', desc: 'Identify bonds reaching maturity and initiate redemption process',
      icon: 'event', iconBg: 'rgba(255,193,7,0.12)', iconColor: 'var(--warning)',
      cron: '0 8 * * *', humanCron: 'Every day at 08:00 AST',
      status: 'Idle', enabled: true, lastRun: '6h ago', lastStatus: 'Success', nextRun: 'Tomorrow 08:00', avgDuration: '1m 15s', successRate: 100, totalRuns: 365, owner: 'Ops Team',
      runHistory: [{ id: 365, started: 'Today 08:00', duration: '1m 08s', status: 'Success', records: '3 bonds maturing in 30 days' }, { id: 364, started: 'Yesterday 08:00', duration: '1m 22s', status: 'Success', records: 'No bonds maturing' }],
    },
    {
      id: 3, name: 'Settlement T+1 Job', desc: 'Process pending T+1 settlements and notify counterparties',
      icon: 'task_alt', iconBg: 'rgba(23,195,178,0.12)', iconColor: 'var(--accent-teal)',
      cron: '0 7 * * 1-5', humanCron: 'Every weekday at 07:00 AST',
      status: 'Running', enabled: true, lastRun: 'Running now', lastStatus: 'Success', nextRun: 'Tomorrow 07:00', avgDuration: '8m 47s', successRate: 98.2, totalRuns: 892, owner: 'Clearing Team',
      runHistory: [{ id: 892, started: 'Today 07:00', duration: 'Running...', status: 'Running', records: '34 trades in queue' }, { id: 891, started: 'Yesterday 07:00', duration: '8m 22s', status: 'Success', records: '28 trades settled' }],
    },
    {
      id: 4, name: 'Database Cleanup Job', desc: 'Archive old records, purge temp files and optimize indexes',
      icon: 'cleaning_services', iconBg: 'rgba(124,77,255,0.12)', iconColor: 'var(--accent-purple)',
      cron: '0 2 * * 0', humanCron: 'Every Sunday at 02:00 AST',
      status: 'Idle', enabled: true, lastRun: '5 days ago', lastStatus: 'Success', nextRun: 'Apr 21 02:00', avgDuration: '22m 14s', successRate: 97.1, totalRuns: 104, owner: 'DevOps',
      runHistory: [{ id: 104, started: 'Apr 14 02:00', duration: '21m 48s', status: 'Success', records: '2.4GB archived' }, { id: 103, started: 'Apr 7 02:00', duration: '19m 33s', status: 'Success', records: '1.8GB archived' }],
    },
    {
      id: 5, name: 'Price Feed Sync', desc: 'Sync bond prices from Bloomberg and Refinitiv data feeds',
      icon: 'sync', iconBg: 'rgba(0,230,118,0.12)', iconColor: 'var(--success)',
      cron: '*/5 * * * 1-5', humanCron: 'Every 5 min on weekdays',
      status: 'Idle', enabled: true, lastRun: '3 min ago', lastStatus: 'Success', nextRun: 'In 2 min', avgDuration: '12s', successRate: 99.5, totalRuns: 48720, owner: 'Data Team',
      runHistory: [{ id: 48720, started: '14:30:00', duration: '11s', status: 'Success', records: '1,847 prices updated' }, { id: 48719, started: '14:25:00', duration: '13s', status: 'Success', records: '1,847 prices updated' }],
    },
    {
      id: 6, name: 'AML Scan Job', desc: 'Run automated AML pattern detection on recent transactions',
      icon: 'security', iconBg: 'rgba(255,71,87,0.12)', iconColor: 'var(--danger)',
      cron: '*/10 * * * *', humanCron: 'Every 10 minutes',
      status: 'Disabled', enabled: false, lastRun: '2h ago', lastStatus: 'Success', nextRun: 'Disabled', avgDuration: '45s', successRate: 100, totalRuns: 8640, owner: 'Compliance',
      runHistory: [{ id: 8640, started: '12:30:00', duration: '43s', status: 'Success', records: '127 transactions scanned' }],
    },
  ];

  todayTimeline = [
    { time: '14:30', job: 'Price Feed Sync', result: '1,847 updated · 11s', success: true },
    { time: '14:25', job: 'Price Feed Sync', result: '1,847 updated · 13s', success: true },
    { time: '09:00', job: 'Coupon Payment Processor', result: '12 bonds · SAR 1.2M · 4m 12s', success: true },
    { time: '08:00', job: 'Bond Maturity Checker', result: '3 bonds nearing maturity · 1m 08s', success: true },
    { time: '07:00', job: 'Settlement T+1 Job', result: 'Running... · 34 in queue', success: true },
  ];

  filteredJobs() {
    const f = this.jobFilter();
    if (f === 'All') return this.jobs;
    return this.jobs.filter(j => j.status.toLowerCase() === f.toLowerCase());
  }

  runJob(job: any) { job.status = 'Running'; setTimeout(() => job.status = 'Idle', 3000); }

  jobStatusBadge(s: string) { return { 'badge-info': s === 'Running', 'badge-success': s === 'Idle', 'badge-warning': s === 'Disabled', 'badge-danger': s === 'Error' }; }
}
