import type {
  BankApplication,
  Client,
  Deal,
  DocumentItem,
  Interaction,
  Task,
  User,
} from '../types';

/** Everything the app stores. One object so it persists and resets as a unit. */
export interface Dataset {
  users: User[];
  clients: Client[];
  deals: Deal[];
  applications: BankApplication[];
  documents: DocumentItem[];
  interactions: Interaction[];
  tasks: Task[];
}

/** The `?state=empty` dataset: users exist (so the shell renders), no business data. */
export function emptyDataset(users: User[]): Dataset {
  return {
    users,
    clients: [],
    deals: [],
    applications: [],
    documents: [],
    interactions: [],
    tasks: [],
  };
}
