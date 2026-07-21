import { Component, inject } from '@angular/core';
import { JobService } from '../../services/job';
import { Job, JobStatus, JobUpdate } from '../../models/job.model';
import { UserService } from '../../services/user';
import { AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../models/user.model';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, FormsModule, DatePipe, MarkdownModule],
  templateUrl: './dashboard.html'
})
export class Dashboard {
  private jobService = inject(JobService);
  private userService = inject(UserService);

  editedJob?: Job;
  viewedJob?: Job;
  editedUser?: Promise<User>

  jobs = this.jobService.getJobs();

  beginJobEdit() {
    this.editedJob = {
      company: '',
      role: '',
      jobDescription: '',
      jobUpdates: []
    };
  }

  cancelJobEdit() {
    this.editedJob = undefined;
  }

  saveJob() {
    this.editedJob!.jobUpdates = [{
      status: JobStatus.NEW,
      updatedAt: new Date()
    }]
    this.jobService.addJob(this.editedJob!);
    this.editedJob = undefined;
    this.jobs = this.jobService.getJobs();
  }

  editUser() {
    this.editedUser = this.userService.getUser().then(user => {
      if(user) {
        return user;
      } else {
        return { email: '', cv: '' };
      }
    })
  }

  cancelUserEdit() {
    this.editedUser = undefined;
  }

  saveUser() {
    this.editedUser?.then(user => {
      this.userService.updateUser(user);
      this.editedUser = undefined;
    });
  }

  toggleDetails(job: Job) {
    if(this.viewedJob?.id === job.id) {
      this.viewedJob = undefined;
    } else {
      this.viewedJob = job;
    }
  }

  getLatestJobUpdate(job: Job): JobUpdate {
    return job.jobUpdates.reduce((latest, current) => {
      return current.updatedAt > latest.updatedAt ? current : latest;
    });
  }

  async updateJobStatus(job: Job, newStatus: JobStatus) {
    await this.jobService.updateJobStatus(job.id!, newStatus);
    job.jobUpdates.push({ status: newStatus, updatedAt: new Date() });
  }

  getStatuses() {
    return Object.values(JobStatus);
  }
}
