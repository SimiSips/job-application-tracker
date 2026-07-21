export enum JobStatus {
  NEW = 'new',
  APPLIED = 'applied',
  INTERVIEW = 'interview',
  OFFER = 'offer',
  REJECTED = 'rejected',
  ACCEPTED = 'accepted'
}

export interface JobUpdate {
  status: JobStatus;
  updatedAt: Date;
}

export interface Job {
  id?: string;
  company?: string;
  role?: string;

  jobUpdates: JobUpdate[];
  jobDescription: string;

  generatedCoverLetter?: string;
  generatedCv?: string;
}
