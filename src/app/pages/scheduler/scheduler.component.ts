import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div class="scheduler-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Scheduler</h2>
          <p>Manage cron jobs — coupon payments, maturity processing and cleanup tasks</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-cron">Node-cron</span>
          <button class="btn btn-secondary"><span class="material-icons-round">history</span> Run History</button>
          <button class="btn btn-primary" (click)="showNewJob.set(true)">
            <span class="material-icons-round">add</span> New Job
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px">
        @for (s of schedulerStats; track s.label) {
          <div class="stat-card" style="padding:14px">
            <div class="stat-icon" [style.background]="s.iconBg" style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:8px">
              <span class="material-icons-round" [style.color]="s.iconColor" style="font-size:16px">{{ s.icon }}</span>
            </div>
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" style="font-size:18px" [style.color]="s.color">{{ s.value }}</div>
          </div>
        }
      </div>

      <div class="scheduler-layout">

        <!-- Job List -->
        <div class="jobs-col">
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <h4 style="font-size:14px;font-weight:700">Cron Jobs ({{ jobs.length }})</h4>
              <div style="display:flex;gap:8px">
                @for (f of jobFilters; track f) {
                  <span class="chip" [class.active]="jobFilter() === f" (click)="jobFilter.set(f)">{{ f }}</span>
                }
              </div>
            </div>
            <div class="jobs-list">
              @for (job of filteredJobs(); track job.id) {
                <div class="job-row" [class.selected]="selectedJob()?.id === job.id" (click)="selectedJob.set(job)">
                  <div class="job-status-indicator" [ngClass]="'ind-' + job.status.toLowerCase()"></div>

                  <div class="job-icon" [style.background]="job.iconBg">
                    <span class="material-icons-round" [style.color]="job.iconColor">{{ job.icon }}</span>
                  </div>

                  <div class="job-info">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                      <strong>{{ job.name }}</strong>
                      <span class="badge" [ngClass]="jobStatusBadge(job.status)">{{ job.status }}</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary)">{{ job.desc }}</div>
                    <div style="display:flex;align-items:center;gap:12px;margin-top:6px">
                      <div class="cron-expr">
                        <span class="material-icons-round" style="font-size:12px">schedule</span>
                        <code>{{ job.cron }}</code>
                      </div>
                      <span style="font-size:11px;color:var(--text-muted)">{{ job.humanCron }}</span>
                    </div>
                  </div>

                  <div class="job-timing">
                    <div class="timing-item">
                      <span>Last Run</span>
                      <strong [style.color]="job.lastStatus === 'Success' ? 'var(--success)' : 'var(--danger)'">{{ job.lastRun }}</strong>
                    </div>
                    <div class="timing-item">
                      <span>Next Run</span>
                      <strong class="text-cyan">{{ job.nextRun }}</strong>
                    </div>
                    <div class="timing-item">
                      <span>Avg Duration</span>
                      <strong>{{ job.avgDuration }}</strong>
                    </div>
                  </div>

                  <div class="job-actions" (click)="$event.stopPropagation()">
                    <button class="btn btn-success btn-sm" title="Run Now" (click)="runJob(job)">
                      <span class="material-icons-round" style="font-size:14px">play_arrow</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" title="{{ job.enabled ? 'Disable' : 'Enable' }}" (click)="job.enabled = !job.enabled">
                      <span class="material-icons-round" style="font-size:14px">{{ job.enabled ? 'pause' : 'play_arrow' }}</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" title="Edit">
                      <span class="material-icons-round" style="font-size:14px">edit</span>
                    </button>
                    <button class="btn btn-danger btn-sm" title="Delete">
                      <span class="material-icons-round" style="font-size:14px">delete</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Right: Job Detail + Recent Runs -->
        <div class="detail-col">
          @if (selectedJob()) {
            <div class="card job-detail fade-in">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
                <div class="job-icon" [style.background]="selectedJob()!.iconBg">
                  <span class="material-icons-round" [style.color]="selectedJob()!.iconColor" style="font-size:22px">{{ selectedJob()!.icon }}</span>
                </div>
                <div>
                  <h3 style="font-size:16px">{{ selectedJob()!.name }}</h3>
                  <p style="font-size:12px;color:var(--text-secondary)">{{ selectedJob()!.desc }}</p>
                </div>
                <span class="badge" style="margin-left:auto" [ngClass]="jobStatusBadge(selectedJob()!.status)">{{ selectedJob()!.status }}</span>
              </div>

              <div class="detail-fields">
                <div class="df-item">
                  <span>Cron Expression</span>
                  <code style="color:var(--accent-cyan);font-size:14px">{{ selectedJob()!.cron }}</code>
                </div>
                <div class="df-item">
                  <span>Schedule</span>
                  <strong>{{ selectedJob()!.humanCron }}</strong>
                </div>
                <div class="df-item">
                  <span>Last Run</span>
                  <strong [style.color]="selectedJob()!.lastStatus === 'Success' ? 'var(--success)' : 'var(--danger)'">{{ selectedJob()!.lastRun }}</strong>
                </div>
                <div class="df-item">
                  <span>Next Run</span>
                  <strong class="text-cyan">{{ selectedJob()!.nextRun }}</strong>
                </div>
                <div class="df-item">
                  <span>Avg Duration</span>
                  <strong>{{ selectedJob()!.avgDuration }}</strong>
                </div>
                <div class="df-item">
                  <span>Success Rate</span>
                  <strong style="color:var(--success)">{{ selectedJob()!.successRate }}%</strong>
                </div>
                <div class="df-item">
                  <span>Total Runs</span>
                  <strong>{{ selectedJob()!.totalRuns }}</strong>
                </div>
                <div class="df-item">
                  <span>Owner</span>
                  <strong>{{ selectedJob()!.owner }}</strong>
                </div>
              </div>

              <div class="divider"></div>

              <h4 style="font-size:13px;margin-bottom:12px">Recent Execution History</h4>
              <table class="data-table">
                <thead><tr><th>Run #</th><th>Started</th><th>Duration</th><th>Status</th><th>Records</th></tr></thead>
                <tbody>
                  @for (run of selectedJob()!.runHistory; track run.id) {
                    <tr>
                      <td style="color:var(--text-muted)">#{{ run.id }}</td>
                      <td style="color:var(--text-secondary)">{{ run.started }}</td>
                      <td>{{ run.duration }}</td>
                      <td><span class="badge" [ngClass]="run.status === 'Success' ? 'badge-success' : 'badge-danger'">{{ run.status }}</span></td>
                      <td>{{ run.records }}</td>
                    </tr>
                  }
                </tbody>
              </table>

              <div class="divider"></div>

              <div style="display:flex;gap:10px">
                <button class="btn btn-success" style="flex:1;justify-content:center" (click)="runJob(selectedJob()!)">
                  <span class="material-icons-round">play_arrow</span> Run Now
                </button>
                <button class="btn btn-secondary" style="flex:1;justify-content:center">
                  <span class="material-icons-round">edit</span> Edit Schedule
                </button>
              </div>
            </div>
          } @else {
            <div class="card empty-state">
              <span class="material-icons-round empty-icon">schedule</span>
              <h4>Select a job</h4>
              <p>Click a cron job to view details and execution history</p>
            </div>
          }

          <!-- System Timeline -->
          <div class="card timeline-card">
            <h4 style="margin-bottom:14px;font-size:14px">Today's Execution Timeline</h4>
            <div class="timeline-list">
              @for (ev of todayTimeline; track ev.time) {
                <div class="tl-item">
                  <span class="tl-time">{{ ev.time }}</span>
                  <span class="tl-dot" [style.background]="ev.success ? 'var(--success)' : 'var(--danger)'"></span>
                  <div class="tl-info">
                    <strong>{{ ev.job }}</strong>
                    <small [style.color]="ev.success ? 'var(--success)' : 'var(--danger)'">{{ ev.result }}</small>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .scheduler-layout { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }

    .jobs-list { display: flex; flex-direction: column; }

    .job-row {
      display: flex; align-items: center; gap: 14px; padding: 16px 20px;
      border-bottom: 1px solid rgba(30,58,95,0.4); cursor: pointer; transition: background 0.15s; position: relative;
      &:hover { background: var(--bg-card-hover); }
      &.selected { background: rgba(0,212,255,0.04); }
      &:last-child { border-bottom: none; }
    }

    .job-status-indicator { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 0; }
    .ind-running { background: var(--accent-cyan); }
    .ind-idle    { background: var(--success); }
    .ind-disabled{ background: var(--text-muted); }
    .ind-error   { background: var(--danger); }

    .job-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; .material-icons-round { font-size: 20px; } }

    .job-info { flex: 1; }

    .cron-expr { display: flex; align-items: center; gap: 4px; color: var(--text-muted); code { font-size: 11px; color: var(--accent-cyan); } }

    .job-timing { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }

    .timing-item { display: flex; flex-direction: column; span { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; } strong { font-size: 11px; } }

    .job-actions { display: flex; gap: 4px; flex-shrink: 0; }

    .job-detail { padding: 20px; }

    .detail-fields { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; }

    .df-item { display: flex; flex-direction: column; gap: 4px; span { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; } strong { font-size: 13px; } }

    .detail-col { display: flex; flex-direction: column; gap: 16px; }

    .timeline-card { padding: 18px; }

    .timeline-list { display: flex; flex-direction: column; gap: 10px; }

    .tl-item { display: flex; align-items: center; gap: 12px; }

    .tl-time { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; width: 50px; }

    .tl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

    .tl-info { display: flex; flex-direction: column; gap: 2px; strong { font-size: 12px; } small { font-size: 10px; } }
  `],
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
