import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Empty, Page } from '@/components/ui';

export default function NotFound() {
  return (
    <Page>
      <Empty icon={Compass} title="This page doesn't exist" action={<Link to="/" className="text-accent-deep hover:underline text-body-s">Back to dashboard</Link>}>
        The link may be out of date, or the item may have been moved to the Trash.
      </Empty>
    </Page>
  );
}
