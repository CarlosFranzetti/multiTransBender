import { TransbandApp } from '@/components/transband/TransbandApp';

export const metadata = {
  title: 'TRANSBAND — multiTransBender',
  description:
    'Split the spectrum into up to six bands; give every band its own transient shaping and its own analog-flavoured saturation engine.',
};

export default function StudioPage() {
  return <TransbandApp />;
}
