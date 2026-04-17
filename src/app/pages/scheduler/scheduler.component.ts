import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { AdminService, SchedulerJob } from '../../services/admin.service';

interface DisplayJob {
  id:          number;
  name:        string;
  desc:        string;
  icon:        string;
  iconBg:      string;
  iconColor:   string;
  cron:        string;
  humanCron:   string;
  status:      string;
  enabled:     boolean;
  lastRun:     string;
  lastStatus:  string;
  nextRun:     string;
  avgDuration: string;
  successRate: number;
  totalRuns:   number;
  owner:       string;
  runsToday:   number;
  runHistory:  Array<{ id: number; started: string; duration: string; status: string; records: string }>;
}

const JOB_META: Record<string, { icon: string; iconBg: string; iconColor: string; humanCron: string; owner: string }> = {
  'expired-orders': {
    icon: 'timer_off', iconBg: 'rgba(255,71,87,0.12)', iconColor: 'var(--danger)',
    humanCron: 'Every 5 minutes', owner: 'Trading Team',
  },
  'price-snapshot': {
    icon: 'trending_up', iconBg: 'rgba(0,212,255,0.12)', iconColor: 'var(--accent-cyan)',
    humanCron: 'Every hour', owner: 'Data Team',
  },
  'maturity-alerts': {
    icon: 'event', iconBg: 'rgba(255,193,7,0.12)', iconColor: 'var(--warning)',
    humanCron: 'Daily at 07:00 UTC', owner: 'Ops Team',
  },
};

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [NgClass],
  templateUrl: './scheduler.component.html',
  styleUrl: './scheduler.component.css',
})
export class SchedulerComponent implements OnInit {
  private readonly adminSvc = inject(AdminService);

  loading      = signal(true);
  jobFilter    = signal('All');
  selectedJob  = signal<DisplayJob | null>(null);
  showNewJob   = signal(false);
  jobFilters   = ['All', 'Success', 'Failed', 'Idle'];

  private _jobs = signal<DisplayJob[]>([]);

  schedulerStats = signal([
    { label: 'Total Jobs',    value: '—', icon: 'schedule',      iconBg: 'rgba(0,212,255,0.1)',  iconColor: 'var(--accent-cyan)', color: 'var(--text-primary)' },
    { label: 'Successful',    value: '—', icon: 'check_circle',  iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)',     color: 'var(--success)'      },
    { label: 'Failed',        value: '—', icon: 'error',         iconBg: 'rgba(255,71,87,0.1)',  iconColor: 'var(--danger)',      color: 'var(--danger)'       },
    { label: "Today's Runs",  value: '—', icon: 'play_circle',   iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)', color: 'var(--accent-teal)'  },
  ]);

  todayTimeline: Array<{ time: string; job: string; result: string; success: boolean }> = [];

  ngOnInit() {
    this.adminSvc.getSchedulerJobs().subscribe({
      next: (data: SchedulerJob[]) => {
        const display = data.map((j, i) => this.toDisplay(j, i));
        this._jobs.set(display);
        this.loading.set(false);
        this.updateStats(data);
        this.buildTimeline(display);
      },
      error: () => this.loading.set(false),
    });
  }

  private toDisplay(j: SchedulerJob, idx: number): DisplayJob {
    const meta = JOB_META[j.name] ?? {
      icon: 'schedule', iconBg: 'rgba(0,212,255,0.12)', iconColor: 'var(--accent-cyan)',
      humanCron: j.schedule, owner: '—',
    };
    const statusLabel = j.lastStatus === 'success' ? 'Success'
                      : j.lastStatus === 'failed'  ? 'Failed'
                      : 'Idle';
    const lastRunHistory = j.lastRunAt ? [{
      id:       1,
      started:  new Date(j.lastRunAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      duration: this.fmtDuration(j.lastDurationMs),
      status:   statusLabel,
      records:  '—',
    }] : [];

    return {
      id:          idx + 1,
      name:        j.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      desc:        j.description,
      icon:        meta.icon,
      iconBg:      meta.iconBg,
      iconColor:   meta.iconColor,
      cron:        j.schedule,
      humanCron:   meta.humanCron,
      status:      statusLabel,
      enabled:     true,
      lastRun:     j.lastRunAt ? this.relativeTime(j.lastRunAt) : 'Never',
      lastStatus:  statusLabel,
      nextRun:     '—',
      avgDuration: this.fmtDuration(j.lastDurationMs),
      successRate: j.lastStatus === 'failed' ? 0 : 100,
      totalRuns:   j.runsToday,
      owner:       meta.owner,
      runsToday:   j.runsToday,
      runHistory:  lastRunHistory,
    };
  }

  private updateStats(jobs: SchedulerJob[]) {
    const successful  = jobs.filter(j => j.lastStatus === 'success').length;
    const failed      = jobs.filter(j => j.lastStatus === 'failed').length;
    const runsToday   = jobs.reduce((s, j) => s + j.runsToday, 0);
    this.schedulerStats.set([
      { label: 'Total Jobs',    value: String(jobs.length), icon: 'schedule',     iconBg: 'rgba(0,212,255,0.1)',  iconColor: 'var(--accent-cyan)', color: 'var(--text-primary)' },
      { label: 'Successful',    value: String(successful),  icon: 'check_circle', iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)',     color: 'var(--success)'      },
      { label: 'Failed',        value: String(failed),      icon: 'error',        iconBg: 'rgba(255,71,87,0.1)',  iconColor: 'var(--danger)',      color: 'var(--danger)'       },
      { label: "Today's Runs",  value: String(runsToday),   icon: 'play_circle',  iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)', color: 'var(--accent-teal)'  },
    ]);
  }

  private buildTimeline(jobs: DisplayJob[]) {
    this.todayTimeline = jobs
      .filter(j => j.lastRun !== 'Never')
      .map(j => ({
        time:    j.runHistory[0]?.started ?? '—',
        job:     j.name,
        result:  `${this.fmtDuration(null)} · ${j.status}`,
        success: j.lastStatus === 'Success',
      }));
  }

  filteredJobs(): DisplayJob[] {
    const f = this.jobFilter();
    if (f === 'All') return this._jobs();
    return this._jobs().filter(j => j.status.toLowerCase() === f.toLowerCase());
  }

  runJob(job: DisplayJob) {
    job.status = 'Running';
    setTimeout(() => { job.status = 'Idle'; }, 3000);
  }

  private fmtDuration(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1000)   return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  jobStatusBadge(s: string) {
    return { 'badge-info': s === 'Running', 'badge-success': s === 'Success' || s === 'Idle', 'badge-warning': s === 'Disabled', 'badge-danger': s === 'Failed' || s === 'Error' };
  }
}
