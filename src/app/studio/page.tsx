import { MultiTransBendApp } from '@/components/multitransbend/MultiTransBendApp';

export const metadata = {
  title: 'MultiTransBend',
  description:
    'Split the spectrum into up to six bands; give every band its own transient shaping and its own analog-flavoured saturation engine.',
};

export default function StudioPage() {
  return <MultiTransBendApp />;
}
