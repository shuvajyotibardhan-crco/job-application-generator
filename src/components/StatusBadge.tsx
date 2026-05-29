export type ApplicationStatus = 'Submitted' | 'In Progress' | 'Completed';

const styles: Record<ApplicationStatus, string> = {
  'Submitted':  'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed':  'bg-green-100 text-green-800',
};

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
