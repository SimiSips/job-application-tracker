import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { firestore, firebaseAuth } from '../firebase';
import { Job, JobStatus, JobUpdate } from '../models/job.model';

@Injectable({ providedIn: 'root' })
export class JobService {
  private db = firestore;

  // Every user gets their own subcollection: users/{uid}/jobs/{jobId}.
  // Returns the collection reference for the CURRENT signed-in user.
  private jobsCollection() {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) {
      throw new Error('Cannot access jobs: no user is signed in.');
    }
    return collection(this.db, 'users', uid, 'jobs');
  }

  async getJobs(): Promise<Job[]> {
    const snapshot = await getDocs(this.jobsCollection());
    // Each Firestore document -> a Job. The document id becomes job.id.
    return snapshot.docs.map((d) => this.toJob(d.id, d.data()));
  }

  async addJob(job: Job): Promise<Job> {
    // A brand-new job starts at status NEW so it always has at least one
    // update (the dashboard's getLatestJobUpdate() can't handle an empty array).
    const jobUpdates =
      job.jobUpdates.length > 0
        ? job.jobUpdates
        : [{ status: JobStatus.NEW, updatedAt: new Date() }];

    // addDoc lets Firestore generate the document id for us.
    const docRef = await addDoc(this.jobsCollection(), {
      company: job.company ?? '',
      role: job.role ?? '',
      jobDescription: job.jobDescription ?? '',
      jobUpdates: jobUpdates.map((u) => ({
        status: u.status,
        updatedAt: u.updatedAt
      }))
    });
    return { ...job, id: docRef.id, jobUpdates };
  }

  async updateJobStatus(jobId: string, newStatus: JobStatus): Promise<Job | undefined> {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) return undefined;

    const jobRef = doc(this.db, 'users', uid, 'jobs', jobId);
    // arrayUnion appends the new status update without overwriting the array.
    await updateDoc(jobRef, {
      jobUpdates: arrayUnion({ status: newStatus, updatedAt: new Date() })
    });
    return undefined;
  }

  // Firestore stores JS Dates as Timestamps. Convert them back so the
  // dashboard's DatePipe and date comparisons keep working.
  private toJob(id: string, data: DocumentData): Job {
    const jobUpdates: JobUpdate[] = (data['jobUpdates'] ?? []).map((u: any) => ({
      status: u.status,
      updatedAt: u.updatedAt instanceof Timestamp ? u.updatedAt.toDate() : u.updatedAt
    }));

    return {
      id,
      company: data['company'],
      role: data['role'],
      jobDescription: data['jobDescription'] ?? '',
      jobUpdates
    };
  }
}
